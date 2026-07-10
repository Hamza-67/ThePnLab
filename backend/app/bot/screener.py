"""
bot_screener.py — ThePnLab AI Bot
Screener algorithmique haute-performance :
  - Univers élargi : actions US high-beta, ETFs, crypto, CAC40
  - ADX (force de tendance), ATR (volatilité), momentum 1j + 5j
  - Téléchargement parallèle (ThreadPoolExecutor) pour <10s
  - Score composite amélioré [-15, +15]
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as _FuturesTimeoutError
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

# ─── Univers élargi ──────────────────────────────────────────────────────────
UNIVERSE: dict[str, list[str]] = {
    "US_TECH":     ["NVDA", "AAPL", "MSFT", "META", "AMD", "TSLA"],          # 6 — plus liquides
    "US_HIGHBETA": ["PLTR", "COIN", "MSTR", "MARA", "IONQ", "HOOD", "RDDT"], # 7 — high-beta purs
    "US_LEVERAGED":["TQQQ", "SOXL", "NVDL", "SPXL"],                         # 4 — ETFs levés clés
    "US_FINANCE":  ["JPM", "GS", "V"],                                        # 3 — représentatifs
    "US_HEALTH":   ["LLY", "MRNA"],                                           # 2 — volatils
    "US_ENERGY":   ["XOM", "CVX"],                                            # 2 — majors
    "ETF":         ["SPY", "QQQ", "SOXX"],                                    # 3 — indices clés
    "CRYPTO":      ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD"],  # 6 — 24/7
    "CAC40":       ["MC.PA", "TTE.PA", "AIR.PA"],                             # 3 — top CAC
}

ALL_TICKERS: list[str] = list({t for tickers in UNIVERSE.values() for t in tickers})


@dataclass
class ScreenedAsset:
    ticker: str
    price: float
    rsi: float
    macd_signal: str          # "BULL" | "BEAR" | "NEUTRAL"
    volume_surge: float       # ratio volume_today / volume_avg20
    momentum_5d: float        # % change 5 jours
    momentum_1d: float        # % change 1 jour (intraday)
    bb_position: str          # "LOWER" | "UPPER" | "MID"
    adx: float = 0.0          # Average Directional Index — force de tendance [0-100]
    atr_pct: float = 0.0      # ATR en % du prix — volatilité
    macd_hist_slope: float = 0.0  # Accélération momentum MACD
    above_sma50: bool | None = None  # Prix > SMA50
    score: float = 0.0        # score composite [-20, +20]
    category: str = ""
    indicators: dict = field(default_factory=dict)


def _compute_rsi(closes: pd.Series, period: int = 14) -> float:
    delta = closes.diff().dropna()
    gain  = delta.clip(lower=0)
    loss  = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean().iloc[-1]
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    return round(100 - 100 / (1 + avg_gain / avg_loss), 2)


def _compute_macd(closes: pd.Series) -> tuple[float, float]:
    ema12  = closes.ewm(span=12, adjust=False).mean()
    ema26  = closes.ewm(span=26, adjust=False).mean()
    macd   = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return float(macd.iloc[-1]), float(signal.iloc[-1])


def _compute_bb(closes: pd.Series, window: int = 20) -> tuple[float, float, float]:
    sma   = closes.rolling(window).mean()
    std   = closes.rolling(window).std()
    upper = sma + 2 * std
    lower = sma - 2 * std
    return float(upper.iloc[-1]), float(sma.iloc[-1]), float(lower.iloc[-1])


def _compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    """ADX : mesure la force de la tendance. >25 = tendance forte."""
    try:
        if len(close) < period * 2:
            return 0.0
        tr   = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
        atr  = tr.ewm(span=period, adjust=False).mean()

        up_move   = high.diff()
        down_move = (-low.diff())
        plus_dm   = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
        minus_dm  = down_move.where((down_move > up_move) & (down_move > 0), 0.0)

        plus_di  = 100 * plus_dm.ewm(span=period, adjust=False).mean() / atr
        minus_di = 100 * minus_dm.ewm(span=period, adjust=False).mean() / atr
        dx       = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, 1))
        adx      = dx.ewm(span=period, adjust=False).mean().iloc[-1]
        return round(float(adx), 1) if adx == adx else 0.0
    except Exception:
        return 0.0


def _compute_atr_pct(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> float:
    """ATR en % du prix courant."""
    try:
        tr  = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
        atr = tr.rolling(period).mean().iloc[-1]
        px  = float(close.iloc[-1])
        return round(float(atr) / px * 100, 2) if px > 0 else 0.0
    except Exception:
        return 0.0


def _score_asset(asset: ScreenedAsset) -> float:
    """
    Score composite [-20, +20] v3 — optimisé pour +300% rapide.
    Priorise : momentum fort + tendance confirmée + volume + high-beta.
    """
    score = 0.0

    # ── RSI : zone momentum idéale = 50-68 (force confirmée, pas suracheté)
    if 50 <= asset.rsi <= 68:
        score += 3.0   # momentum parfait
    elif 42 <= asset.rsi < 50:
        score += 1.5   # bonne entrée
    elif asset.rsi < 30:
        score += 2.0   # rebond survendu
    elif 30 <= asset.rsi < 42:
        score += 0.5
    elif asset.rsi > 80:
        score -= 3.5   # extrêmement suracheté → danger
    elif asset.rsi > 72:
        score -= 1.5

    # ── MACD : signal directionnel principal
    if asset.macd_signal == "BULL":
        score += 3.5   # tendance haussière confirmée
    elif asset.macd_signal == "BEAR":
        score -= 2.5

    # ── ADX : force de tendance (>25 = tendance, >40 = tendance très forte)
    if asset.adx >= 45:
        score += 3.5   # tendance exceptionnellement forte
    elif asset.adx >= 35:
        score += 2.5
    elif asset.adx >= 25:
        score += 1.5
    elif asset.adx < 18:
        score -= 1.5   # sans direction = éviter

    # ── Volume surge : confirmation institutionnelle
    if asset.volume_surge > 4.0:
        score += 3.5   # explosion institutionnelle
    elif asset.volume_surge > 2.5:
        score += 2.0
    elif asset.volume_surge > 1.8:
        score += 1.0
    elif asset.volume_surge < 0.6:
        score -= 1.0   # volume mort = éviter

    # ── Momentum 5j : tendance récente
    if asset.momentum_5d > 10:
        score += 2.5
    elif asset.momentum_5d > 5:
        score += 1.5
    elif asset.momentum_5d > 2:
        score += 0.8
    elif asset.momentum_5d < -10:
        score -= 2.5
    elif asset.momentum_5d < -5:
        score -= 1.5

    # ── Momentum 1j : signal intraday
    if asset.momentum_1d > 3:
        score += 1.5   # breakout journalier
    elif asset.momentum_1d > 1.5:
        score += 0.8
    elif asset.momentum_1d < -4:
        score -= 2.0
    elif asset.momentum_1d < -2:
        score -= 1.0

    # ── Bollinger Bands position
    if asset.bb_position == "LOWER":
        score += 1.5   # rebond sur support
    elif asset.bb_position == "UPPER":
        score -= 1.0   # résistance, prudence
    # MID is neutral (0)

    # ── Prime volatilité (ATR) : actifs volatils → plus d'alpha potentiel
    if asset.atr_pct > 5:
        score += 1.5   # très volatil = opportunités
    elif asset.atr_pct > 3:
        score += 0.8

    # ── MACD histogram slope : momentum qui accélère = signal fort
    if asset.macd_hist_slope > 0.02:
        score += 2.0   # momentum BULL qui accélère fortement
    elif asset.macd_hist_slope > 0.005:
        score += 1.0
    elif asset.macd_hist_slope < -0.02:
        score -= 2.0   # momentum BEAR qui accélère
    elif asset.macd_hist_slope < -0.005:
        score -= 1.0

    # ── SMA50 : price above/below trend
    if asset.above_sma50 is True:
        score += 1.5   # dans la tendance haussière principale
    elif asset.above_sma50 is False:
        score -= 1.0   # sous la tendance = risque baissier

    # ── Prime catégorie high-beta/leveraged (x1.5 multiplicateur de gain)
    if asset.category in ("US_HIGHBETA", "US_LEVERAGED", "CRYPTO"):
        score += 1.5   # prime risque-rendement élevée
    elif asset.category == "US_TECH":
        score += 0.5   # légère prime tech

    return round(score, 2)


def _fetch_single(ticker: str) -> Optional[ScreenedAsset]:
    try:
        df = yf.download(ticker, period="2mo", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or len(df) < 30:
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        closes  = df["Close"].dropna()
        volumes = df["Volume"].dropna()

        if len(closes) < 26:
            return None

        high  = df["High"].dropna()
        low   = df["Low"].dropna()
        price = float(closes.iloc[-1])

        # ── Indicateurs de base
        rsi             = _compute_rsi(closes)
        macd_val, macd_sig = _compute_macd(closes)
        macd_hist = macd_val - macd_sig  # histogram (positif = bull, négatif = bear)
        # Slope du histogram : momentum qui accélère ou décélère
        ema12  = closes.ewm(span=12, adjust=False).mean()
        ema26  = closes.ewm(span=26, adjust=False).mean()
        macd_s = ema12 - ema26
        signal_s = macd_s.ewm(span=9, adjust=False).mean()
        hist_series = macd_s - signal_s
        macd_hist_slope = float(hist_series.iloc[-1]) - float(hist_series.iloc[-3]) if len(hist_series) >= 3 else 0.0
        macd_signal     = "BULL" if macd_val > macd_sig else ("NEUTRAL" if abs(macd_hist) < abs(macd_val) * 0.05 else "BEAR")
        bb_upper, bb_mid, bb_lower = _compute_bb(closes)

        # ── SMA50 cross
        sma50 = float(closes.rolling(50).mean().iloc[-1]) if len(closes) >= 50 else None
        above_sma50 = (price > sma50) if sma50 else None

        # ── Volume
        vol_today = float(volumes.iloc[-1])
        vol_avg20 = float(volumes.iloc[-21:-1].mean()) if len(volumes) > 21 else vol_today
        volume_surge = vol_today / vol_avg20 if vol_avg20 > 0 else 1.0

        # ── Momentum
        momentum_5d = (
            (float(closes.iloc[-1]) - float(closes.iloc[-6])) / float(closes.iloc[-6]) * 100
            if len(closes) >= 6 else 0.0
        )
        momentum_1d = (
            (float(closes.iloc[-1]) - float(closes.iloc[-2])) / float(closes.iloc[-2]) * 100
            if len(closes) >= 2 else 0.0
        )

        # ── Bollinger position
        price_range  = bb_upper - bb_lower
        if price_range > 0:
            bb_pct      = (price - bb_lower) / price_range
            bb_position = "LOWER" if bb_pct < 0.2 else ("UPPER" if bb_pct > 0.8 else "MID")
        else:
            bb_position = "MID"

        # ── ADX + ATR
        adx     = _compute_adx(high, low, closes)
        atr_pct = _compute_atr_pct(high, low, closes)

        cat = next(
            (cat for cat, tickers in UNIVERSE.items() if ticker in tickers),
            "OTHER"
        )

        asset = ScreenedAsset(
            ticker=ticker,
            price=price,
            rsi=rsi,
            macd_signal=macd_signal,
            volume_surge=round(volume_surge, 2),
            momentum_5d=round(momentum_5d, 2),
            momentum_1d=round(momentum_1d, 2),
            bb_position=bb_position,
            adx=adx,
            atr_pct=atr_pct,
            macd_hist_slope=round(macd_hist_slope, 5),
            above_sma50=above_sma50,
            category=cat,
            indicators={
                "rsi":            rsi,
                "macd":           round(macd_val, 4),
                "macd_signal":    round(macd_sig, 4),
                "macd_hist":      round(macd_hist, 4),
                "macd_hist_slope":round(macd_hist_slope, 5),
                "bb_upper":       round(bb_upper, 2),
                "bb_lower":       round(bb_lower, 2),
                "sma20":          round(bb_mid, 2),
                "sma50":          round(sma50, 2) if sma50 else None,
                "above_sma50":    above_sma50,
                "volume_surge":   round(volume_surge, 2),
                "momentum_5d":    round(momentum_5d, 2),
                "momentum_1d":    round(momentum_1d, 2),
                "adx":            adx,
                "atr_pct":        atr_pct,
            },
        )
        asset.score = _score_asset(asset)
        return asset

    except Exception as e:
        logger.warning(f"Screener skip {ticker}: {e}")
        return None


def run_screener(top_n: int = 10) -> list[ScreenedAsset]:
    """
    Lance le screener en parallèle sur tout l'univers.
    ThreadPoolExecutor : 4-5x plus rapide que séquentiel.
    Retourne les TOP top_n actifs triés par score absolu.
    """
    logger.info(f"Screener: analyse parallèle de {len(ALL_TICKERS)} actifs...")
    results: list[ScreenedAsset] = []

    # IMPORTANT : on n'utilise PAS `with ThreadPoolExecutor() as executor:` car
    # __exit__ appelle shutdown(wait=True) qui BLOQUE si un thread yfinance est pendu.
    # On gère manuellement avec shutdown(wait=False) pour ne jamais bloquer le cycle.
    executor = ThreadPoolExecutor(max_workers=12)
    futures = {executor.submit(_fetch_single, ticker): ticker for ticker in ALL_TICKERS}
    try:
        for future in as_completed(futures, timeout=30):
            try:
                asset = future.result()
                if asset:
                    results.append(asset)
            except Exception as e:
                logger.debug(f"Screener future error {futures[future]}: {e}")
    except _FuturesTimeoutError:
        logger.warning(f"Screener global timeout (30s) — résultats partiels : {len(results)} actifs")
    finally:
        executor.shutdown(wait=False)  # CRITIQUE : ne pas attendre les threads yfinance pendants

    # Trier par score DESC — les actifs BULLISH en tête (on veut acheter les meilleurs)
    # Garder aussi les très baissiers en fin de liste pour les signaux SELL
    results.sort(key=lambda a: a.score, reverse=True)
    # Top bullish + quelques bearish (pour SELL signals sur positions existantes)
    top_bull  = [a for a in results if a.score > 0][:top_n - 3]
    top_bear  = [a for a in results if a.score <= 0][:3]
    top = top_bull + top_bear

    logger.info(
        f"Screener: {len(top)}/{len(results)} actifs sélectionnés — "
        f"{[f'{a.ticker}({a.score:+.1f})' for a in top[:8]]}"
    )
    return top
