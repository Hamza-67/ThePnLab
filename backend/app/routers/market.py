from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import yfinance as yf
import pandas as pd
import numpy as np
import threading
import logging

from app.services.market_data import (
    COINGECKO_IDS,
    CG_CACHE_TTL,
    fetch_coingecko_prices,
    is_market_open as _is_market_open,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/market", tags=["market"])

# ── Cache mémoire pour limiter les appels yfinance ───────────────────────────
# Évite que 100 users simultanés déclenchent 100x yf.download() sur le même ticker

_CACHE: dict[str, tuple[any, float]] = {}  # key → (data, expires_at)
_CACHE_LOCK = threading.Lock()

def _cache_get(key: str):
    import time
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if entry and time.time() < entry[1]:
            return entry[0]
    return None

def _cache_set(key: str, data: any, ttl_seconds: int):
    import time
    with _CACHE_LOCK:
        _CACHE[key] = (data, time.time() + ttl_seconds)
    # Nettoyage si cache trop grand (>500 entrées)
    with _CACHE_LOCK:
        if len(_CACHE) > 500:
            now = time.time()
            expired = [k for k, v in _CACHE.items() if v[1] < now]
            for k in expired:
                del _CACHE[k]

ACTIFS = {
    "Tech US":  {"NVDA": "NVIDIA", "AAPL": "Apple", "MSFT": "Microsoft", "TSLA": "Tesla", "GOOGL": "Google", "META": "Meta", "AMD": "AMD"},
    "CAC 40":   {"MC.PA": "LVMH", "OR.PA": "L'Oréal", "TTE.PA": "TotalEnergies", "AIR.PA": "Airbus", "BNP.PA": "BNP"},
    "Énergie":  {"XOM": "Exxon", "CVX": "Chevron", "CL=F": "WTI"},
    "Métaux":   {"GC=F": "Or", "SI=F": "Argent"},
    "Santé":    {"LLY": "Eli Lilly", "PFE": "Pfizer", "MRNA": "Moderna"},
    "Crypto":   {"BTC-USD": "Bitcoin", "ETH-USD": "Ethereum", "SOL-USD": "Solana"},
}

CRYPTO_TICKERS = {"BTC-USD", "ETH-USD", "SOL-USD"}

VALID_COMBOS = {
    "1m":  "7d",
    "5m":  "60d",
    "15m": "60d",
    "30m": "60d",
    "1h":  "60d",
    "1d":  "2y",
    "1wk": "5y",
    "1mo": "10y",
}

PERIOD_MAP = {
    "1d":  "1d",
    "5d":  "5d",
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y":  "1y",
    "2y":  "2y",
    "5y":  "5y",
}

# Seuils de prix raisonnables par ticker (pour filtrer les valeurs aberrantes)
# Si le prix dépasse ce multiple du prix médian, on le considère corrompu
MAX_PRICE_RATIO = 10.0   # une bougie ne peut pas valoir 10x la médiane
MIN_PRICE_RATIO = 0.1    # ni moins de 10% de la médiane


def _safe_float(val) -> Optional[float]:
    """Convertit en float en filtrant NaN/inf/None."""
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    except Exception:
        return None


def _fetch_price(ticker: str) -> Optional[float]:
    """
    Prix temps réel.
    - Crypto : CoinGecko (source officielle, fiable, pas de cross-ticker)
    - Autres  : yfinance fast_info (quasi temps réel) + fallback download
    """
    cache_key = f"price:{ticker}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # ── 1. CoinGecko pour les tickers crypto ─────────────────────────────────
    if ticker in COINGECKO_IDS:
        cg = fetch_coingecko_prices([ticker])
        price = cg.get(ticker)
        if price and price > 0:
            _cache_set(cache_key, price, CG_CACHE_TTL)
            return price
        # Si CoinGecko échoue, on tombe dans le fallback yfinance ci-dessous

    # ── 2. yfinance fast_info (actions, ETFs, futures) ───────────────────────
    try:
        info = yf.Ticker(ticker).fast_info
        price = _safe_float(getattr(info, "last_price", None))
        if price and price > 0:
            ttl = 30 if ticker in CRYPTO_TICKERS else 60
            _cache_set(cache_key, price, ttl)
            return price
    except Exception:
        pass

    # ── 3. Fallback : download OHLC ──────────────────────────────────────────
    try:
        period = "1d" if _is_market_open(ticker) else "2d"
        interval = "1m" if _is_market_open(ticker) else "1d"
        df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        price = _safe_float(df["Close"].dropna().iloc[-1])
        if price:
            ttl = 20 if ticker in CRYPTO_TICKERS else 45
            _cache_set(cache_key, price, ttl)
        return price
    except Exception:
        return None


def _df_to_candles(df: pd.DataFrame, interval: str) -> list[dict]:
    """
    Convertit un DataFrame yfinance en bougies JSON.
    Filtre les valeurs NaN, inf, et les prix aberrants (bug 10k$).
    """
    if df is None or df.empty:
        return []
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Supprimer les lignes avec NaN dans les colonnes OHLC
    df = df.dropna(subset=["Open", "High", "Low", "Close"])

    # Filtrer les valeurs infinies
    df = df[~df["Close"].apply(lambda x: np.isinf(float(x)) if x is not None else True)]

    if df.empty:
        return []

    # ── Filtrer les candles jours fériés (volume = 0) pour les actifs EU et US
    # Sur les marchés fermés (Noël, 1er Mai…), yfinance retourne parfois une
    # bougie avec volume = 0 et prix identique au jour précédent → aberrant.
    if interval in ("1d", "1wk"):
        vol_col = "Volume" if "Volume" in df.columns else None
        if vol_col is not None:
            # Garder uniquement les candles avec volume > 0
            # Exception : crypto (volume toujours > 0 de toute façon)
            df_vol_ok = df[df[vol_col] > 0]
            if not df_vol_ok.empty:  # ne pas vider si toutes à 0 (rare mais possible)
                df = df_vol_ok

    # Filtrer les prix aberrants : écarter tout ce qui dépasse MAX_PRICE_RATIO * médiane
    median_close = float(df["Close"].median())
    if median_close > 0:
        df = df[
            (df["Close"] <= median_close * MAX_PRICE_RATIO) &
            (df["Close"] >= median_close * MIN_PRICE_RATIO) &
            (df["High"]  <= median_close * MAX_PRICE_RATIO) &
            (df["Low"]   >= median_close * MIN_PRICE_RATIO * 0.5)
        ]

    if df.empty:
        return []

    is_intraday = interval in ("1m", "5m", "15m", "30m", "1h")
    result = []

    for ts, row in df.iterrows():
        o = _safe_float(row["Open"])
        h = _safe_float(row["High"])
        l = _safe_float(row["Low"])
        c = _safe_float(row["Close"])

        # Ignorer les bougies avec des valeurs manquantes
        if any(v is None for v in [o, h, l, c]):
            continue
        # Ignorer les bougies incohérentes (high < low, etc.)
        if h < l or h < o or h < c or l > o or l > c:
            continue

        ts_parsed = pd.Timestamp(ts)
        if is_intraday:
            unix = int(ts_parsed.timestamp())
        else:
            unix = int(ts_parsed.replace(hour=12, minute=0, second=0).timestamp())

        result.append({
            "time":   unix,
            "open":   round(o, 4),
            "high":   round(h, 4),
            "low":    round(l, 4),
            "close":  round(c, 4),
            "volume": int(_safe_float(row.get("Volume", 0)) or 0),
        })

    result.sort(key=lambda x: x["time"])
    return result


def _compute_indicators(df: pd.DataFrame, latest_price: Optional[float] = None) -> dict:
    """
    Calcule RSI, MACD, SMA50, Bollinger sur un DataFrame OHLC.
    Fonctionne quel que soit l'intervalle (1m, 1h, 1d...).
    """
    df = df.copy()

    # RSI(14)
    delta     = df["Close"].diff()
    gain      = delta.clip(lower=0).rolling(14).mean()
    loss      = (-delta.clip(upper=0)).rolling(14).mean()
    rs        = gain / loss.replace(0, 1e-10)
    df["RSI"] = 100 - (100 / (1 + rs))

    # MACD(12,26,9)
    ema12        = df["Close"].ewm(span=12, adjust=False).mean()
    ema26        = df["Close"].ewm(span=26, adjust=False).mean()
    df["MACD"]   = ema12 - ema26
    df["SIGNAL"] = df["MACD"].ewm(span=9, adjust=False).mean()

    # SMA50
    df["SMA50"] = df["Close"].rolling(50).mean()

    # Bollinger(20)
    df["BB_MID"]   = df["Close"].rolling(20).mean()
    bb_std         = df["Close"].rolling(20).std()
    df["BB_UPPER"] = df["BB_MID"] + 2 * bb_std
    df["BB_LOWER"] = df["BB_MID"] - 2 * bb_std

    last  = df.iloc[-1]
    price = latest_price or _safe_float(last["Close"])

    # SMA200
    df["SMA200"] = df["Close"].rolling(200).mean()
    sma200 = _safe_float(last.get("SMA200") or df["SMA200"].iloc[-1])

    # 52-week high/low (use available data, up to 252 trading days)
    window_252 = min(len(df), 252)
    high52w = float(df["High"].iloc[-window_252:].max()) if window_252 > 0 else None
    low52w  = float(df["Low"].iloc[-window_252:].min())  if window_252 > 0 else None
    pct_from_high = round((price - high52w) / high52w * 100, 1) if high52w and price else None
    pct_from_low  = round((price - low52w)  / low52w  * 100, 1) if low52w  and price else None

    return {
        "price":         round(price, 4) if price else None,
        "rsi":           round(_safe_float(last["RSI"])    or 0, 2),
        "macd":          round(_safe_float(last["MACD"])   or 0, 4),
        "signal":        round(_safe_float(last["SIGNAL"]) or 0, 4),
        "sma50":         round(_safe_float(last["SMA50"])  or 0, 4),
        "sma200":        round(sma200, 2) if sma200 else None,
        "bb_upper":      round(_safe_float(last["BB_UPPER"]) or 0, 4),
        "bb_mid":        round(_safe_float(last["BB_MID"])   or 0, 4),
        "bb_lower":      round(_safe_float(last["BB_LOWER"]) or 0, 4),
        # Strike levels
        "high52w":       round(high52w, 2) if high52w else None,
        "low52w":        round(low52w, 2)  if low52w  else None,
        "pct_from_high": pct_from_high,
        "pct_from_low":  pct_from_low,
    }


@router.get("/actifs")
def get_actifs():
    return ACTIFS


@router.get("/price/{ticker}")
def get_price(ticker: str):
    price = _fetch_price(ticker)
    if price is None:
        raise HTTPException(status_code=404, detail=f"Prix introuvable pour {ticker}")
    return {"ticker": ticker, "price": price}


@router.get("/ohlc/{ticker}")
def get_ohlc(
    ticker:   str,
    interval: str = Query("1d",  description="1m|5m|15m|1h|1d|1wk|1mo"),
    period:   str = Query("6mo", description="1d|5d|1mo|3mo|6mo|1y|2y"),
):
    if interval not in VALID_COMBOS:
        raise HTTPException(status_code=400, detail=f"Intervalle invalide: {interval}")

    yf_period = "1d" if interval == "1m" and period == "1d" else (
                "7d" if interval == "1m" else PERIOD_MAP.get(period, period))

    cache_key = f"ohlc:{ticker}:{interval}:{yf_period}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        df = yf.download(ticker, period=yf_period, interval=interval, progress=False, auto_adjust=True)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        candles = _df_to_candles(df, interval)
        if not candles:
            raise HTTPException(status_code=404, detail=f"Aucune donnée pour {ticker}")

        result = {"ticker": ticker, "interval": interval, "period": yf_period, "data": candles}
        # TTL selon intervalle : intraday court, daily/weekly plus long
        ttl = {"1m": 30, "5m": 60, "1h": 120, "1d": 300, "1wk": 600, "1mo": 1800}.get(interval, 120)
        _cache_set(cache_key, result, ttl)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/indicators/{ticker}")
def get_indicators(
    ticker:   str,
    interval: str = Query("1d", description="Intervalle du graphe actif : 1m|5m|1h|1d|1wk|1mo"),
):
    """
    Retourne prix + RSI + MACD + SMA50 + Bollinger calculés sur l'intervalle demandé.
    Ainsi les indicateurs sont synchronisés avec le graphe affiché.
    """
    cache_key = f"ind:{ticker}:{interval}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        # Choisir la période selon l'intervalle pour avoir assez de bougies
        period_for_interval = {
            "1m":  "7d",
            "5m":  "60d",
            "15m": "60d",
            "1h":  "60d",
            "1d":  "6mo",
            "1wk": "2y",
            "1mo": "5y",
        }.get(interval, "6mo")

        df = yf.download(ticker, period=period_for_interval, interval=interval, progress=False, auto_adjust=True)
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="Données introuvables")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Filtrer les NaN et valeurs aberrantes
        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        median_close = float(df["Close"].median())
        if median_close > 0:
            df = df[
                (df["Close"] <= median_close * MAX_PRICE_RATIO) &
                (df["Close"] >= median_close * MIN_PRICE_RATIO)
            ]

        if df.empty:
            raise HTTPException(status_code=404, detail="Données filtrées vides")

        # Prix temps réel (1m) si disponible, sinon dernière bougie
        latest_price = _fetch_price(ticker) if interval != "1m" else None

        indicators = _compute_indicators(df, latest_price)

        # Série BB pour le graphe (uniquement en 1d)
        bb_series = []
        if interval == "1d":
            for ts, row in df.tail(130).iterrows():
                bb_mid = _safe_float(row.get("BB_MID"))
                # recalcul si colonne absente
                if bb_mid is None:
                    df2 = df.copy()
                    df2["BB_MID"]   = df2["Close"].rolling(20).mean()
                    bb_std2         = df2["Close"].rolling(20).std()
                    df2["BB_UPPER"] = df2["BB_MID"] + 2 * bb_std2
                    df2["BB_LOWER"] = df2["BB_MID"] - 2 * bb_std2
                    for ts2, row2 in df2.tail(130).iterrows():
                        u = _safe_float(row2["BB_UPPER"])
                        m = _safe_float(row2["BB_MID"])
                        l = _safe_float(row2["BB_LOWER"])
                        if all(v is not None for v in [u, m, l]):
                            unix = int(pd.Timestamp(ts2).replace(hour=12, minute=0, second=0).timestamp())
                            bb_series.append({"time": unix, "upper": round(u,4), "mid": round(m,4), "lower": round(l,4)})
                    break

        result = {
            "ticker":       ticker,
            "interval":     interval,
            **indicators,
            "bb_series":    bb_series,
            "market_open":  _is_market_open(ticker),
            "last_price_rt": latest_price,  # prix fast_info (quasi temps réel)
        }
        ttl = {"1m": 20, "5m": 45, "1h": 90, "1d": 180, "1wk": 600, "1mo": 1800}.get(interval, 60)
        _cache_set(cache_key, result, ttl)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
