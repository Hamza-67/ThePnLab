"""
bot_engine.py — ThePnLab AI Bot v2
Orchestrateur principal :
  - Stratégie momentum équilibrée v4 (MAX_PCT 20%, MIN_CASH 15%, MAX_POSITIONS 4)
  - Sizing basé sur la confiance (HIGH=20%, MEDIUM=13%, LOW=8%, cap $3000)
  - TP/SL automatiques par portfolio : TP +15%, SL -5%, Pyramiding +10%
  - VIX : normal=100%, >28=65%, >40=SELL TOUT + aucun BUY (panic mode)
  - Circuit breaker SPY : -3% → no BUY US stocks (crypto+EU OK)
  - ML blacklist : WR<35% sur ≥5 trades OU 3 pertes consécutives → banni
  - Multi-exchange : NYSE + Euronext + Crypto 24/7 + Weekend crypto
  - Scheduler natif threading (compatible Railway) — heartbeat 20s
"""
from __future__ import annotations

import logging
import time as _time
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor as _TPE, as_completed as _ac

import requests as _requests
import pytz
import yfinance as yf
import pandas as pd

from app.database import SessionLocal
from app.models.portfolio import Portfolio, Position, Trade, EquitySnapshot
from app.models.user import User
from app.routers.bot_screener import run_screener
from app.routers.bot_brain import run_bot_brain, BotDecision
from app.routers.bot_logger import save_bot_cycle, BotCycleLog
from app.config import FEE_RATE, SLIPPAGE_BPS

logger = logging.getLogger(__name__)
PARIS_TZ = pytz.timezone("Europe/Paris")
NY_TZ    = pytz.timezone("America/New_York")

BOT_PORTFOLIO_NAME = "AI"
BOT_ACTOR          = "BOT"

# ── État temps-réel du bot (partagé entre threads) ───────────────────────────
import threading as _threading
_bot_running       = False
_bot_running_lock  = _threading.Lock()
_bot_last_start    : Optional[str] = None

# ── Cache prix intra-cycle ────────────────────────────────────────────────────
_price_cache_cycle : dict[str, tuple[float, float]] = {}  # ticker -> (price, monotonic_time)
_PRICE_CACHE_CYCLE_TTL = 300  # 5 min — couvre la durée totale d'un cycle

# ── CoinGecko — source primaire pour la crypto (officielle, gratuite, fiable) ─
# yfinance retourne parfois des prix corrompus pour la crypto (cross-ticker,
# stale data, etc.). CoinGecko est l'API crypto la plus fiable au monde.
# Free tier : 10-50 req/min, pas de clé requise.
_COINGECKO_IDS: dict[str, str] = {
    "BTC-USD":  "bitcoin",
    "ETH-USD":  "ethereum",
    "SOL-USD":  "solana",
    "BNB-USD":  "binancecoin",
    "XRP-USD":  "ripple",
    "DOGE-USD": "dogecoin",
    "ADA-USD":  "cardano",
    "AVAX-USD": "avalanche-2",
    "DOT-USD":  "polkadot",
    "LINK-USD": "chainlink",
    "MARA-USD": None,  # stock, pas crypto — géré par yfinance
}
# Cache CoinGecko partagé entre cycles (TTL 60s pour la crypto)
_coingecko_cache: dict[str, tuple[float, float]] = {}
_COINGECKO_TTL = 60  # secondes


def _fetch_coingecko_prices(tickers: list[str]) -> dict[str, float]:
    """
    Fetche les prix crypto depuis CoinGecko en un seul appel batch.
    Retourne un dict {ticker: price}. Silencieux en cas d'échec (fallback yfinance).
    """
    ids_needed = {t: _COINGECKO_IDS[t] for t in tickers
                  if t in _COINGECKO_IDS and _COINGECKO_IDS[t] is not None}
    if not ids_needed:
        return {}

    # Filtrer ce qui est déjà en cache
    ts_now = _time.monotonic()
    result: dict[str, float] = {}
    ids_to_fetch = {}
    for ticker, cg_id in ids_needed.items():
        if ticker in _coingecko_cache:
            price, ts = _coingecko_cache[ticker]
            if ts_now - ts < _COINGECKO_TTL:
                result[ticker] = price
                continue
        ids_to_fetch[ticker] = cg_id

    if not ids_to_fetch:
        return result

    try:
        ids_str = ",".join(ids_to_fetch.values())
        resp = _requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": ids_str, "vs_currencies": "usd"},
            timeout=8,
        )
        if resp.status_code != 200:
            logger.warning(f"CoinGecko HTTP {resp.status_code}")
            return result

        data = resp.json()
        for ticker, cg_id in ids_to_fetch.items():
            price = data.get(cg_id, {}).get("usd")
            if price and float(price) > 0:
                p = float(price)
                result[ticker] = p
                _coingecko_cache[ticker] = (p, ts_now)
                logger.debug(f"[CoinGecko] {ticker} = ${p:.4f}")
            else:
                logger.warning(f"[CoinGecko] pas de prix pour {ticker} ({cg_id})")
    except Exception as e:
        logger.warning(f"[CoinGecko] erreur batch: {e}")

    return result

# ── Sanity check — mouvement journalier max acceptable par catégorie ──────────
# Au-delà de ces seuils, le prix est suspect (glitch yfinance, données stales,
# mauvais ticker). Le trade est annulé plutôt que d'exécuter à un mauvais prix.
# Exemples de bug détecté :
#   TQQQ $47→$398 (+747%) → bien > 40% → ANNULÉ  ✓
#   ETH  $2000→$145 (-92.75%) → bien > 25% → ANNULÉ  ✓
#   TQQQ crash légitime -33% (SPY -11%) → < 40% → ACCEPTÉ  ✓
_LEVERAGED_ETFS = {
    "TQQQ","SOXL","SPXL","NVDL","TECL","UDOW","LABU",
    "FAS","UPRO","TNA","BULZ","WEBL","WANT","HIBL","FNGU",
}
_MAX_DAILY_MOVE: dict[str, float] = {
    "leveraged": 0.40,  # ETF 3x → jusqu'à ±40% sur un crash extrême
    "crypto":    0.25,  # crypto — volatilité naturelle élevée
    "default":   0.18,  # stocks & ETFs standard — crash 1987 = -22% en 1j
}


def is_bot_running() -> bool:
    global _bot_running
    with _bot_running_lock:
        if not _bot_running:
            return False
        # Safety: auto-reset si stuck >4 minutes (avant le timeout frontend de 6min)
        if _bot_last_start:
            try:
                elapsed = (datetime.now(PARIS_TZ) - datetime.fromisoformat(_bot_last_start)).total_seconds()
                if elapsed > 240:
                    logger.warning(f"Bot running flag auto-reset after {elapsed:.0f}s (likely stuck)")
                    _bot_running = False
                    return False
            except Exception:
                pass
        return True


def get_bot_last_start() -> Optional[str]:
    with _bot_running_lock:
        return _bot_last_start

# ── Paramètres de risque v5 — prudence renforcée ─────────────────────────────
# v4 : -$250 sur bot AI → trop de trades en baisse de marché + SL trop serré
# v5 : MAX_PCT réduit, SL élargi pour absorber volatilité intraday, cash +
MAX_PCT_HIGH   = 0.15   # HIGH : 15% max (était 20% — trop exposé sur 1 trade)
MAX_PCT_MEDIUM = 0.10   # MEDIUM : 10% (était 13%)
MAX_PCT_LOW    = 0.06   # LOW : 6% (était 8%)
MIN_CASH_RESERVE = 0.20 # Garder 20% de cash (était 15% — plus de buffer)
MAX_OPEN_POSITIONS = 4  # Max 4 positions (diversification > concentration)

# Tickers protégés — jamais bannis par le ML (liquidité mondiale, piliers crypto)
# même après 10 pertes consécutives : BTC/ETH sont le dernier recours 24/7
NEVER_BAN_TICKERS = {"BTC-USD", "ETH-USD"}

# ── Circuit breaker + VIX ────────────────────────────────────────────────────
SPY_DROP_THRESHOLD = -0.050  # -5% → circuit breaker (était -3.5% — trop sensible, correction normale)
VIX_HIGH_THRESHOLD = 25.0    # Réduction sizing au-dessus (était 28)
VIX_EXTREME        = 40.0    # Panic mode — SELL ALL + 0 BUY

# ── TP/SL thresholds ─────────────────────────────────────────────────────────
TP_THRESHOLD  = 0.15   # Take profit à +15%
SL_THRESHOLD  = -0.07  # Stop-loss à -7% (était -5% — trop serré pour ETF 3x)
PYRAMID_THRESHOLD = 0.10  # Pyramiding à +10%

# ── Univers crypto 24/7 ────────────────────────────────────────────────────────
CRYPTO_TICKERS = {"BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD", "XRP-USD", "DOGE-USD"}


# ═══════════════════════════════════════════════════════════════════════════════
# CHECK MARCHÉ OUVERT
# ═══════════════════════════════════════════════════════════════════════════════

def _is_market_open() -> tuple[bool, str]:
    """
    Crypto : 24h/7j.
    EU (Euronext) : lun-ven 9h00-17h30 CET.
    US (NYSE) : lun-ven 9h30-16h00 ET.
    Retourne toujours True — crypto toujours tradable.
    """
    now_paris = datetime.now(PARIS_TZ)
    now_ny    = datetime.now(NY_TZ)
    weekday   = now_paris.weekday()

    if weekday >= 5:
        day_name = "samedi" if weekday == 5 else "dimanche"
        return True, f"Weekend ({day_name}) — Crypto 24/7 actif"

    eu_open  = now_paris.replace(hour=9,  minute=0,  second=0, microsecond=0)
    eu_close = now_paris.replace(hour=17, minute=30, second=0, microsecond=0)
    eu_ok    = eu_open <= now_paris <= eu_close

    us_open  = now_ny.replace(hour=9,  minute=30, second=0, microsecond=0)
    us_close = now_ny.replace(hour=16, minute=0,  second=0, microsecond=0)
    us_ok    = us_open <= now_ny <= us_close

    markets = ["Crypto 24/7"]
    if eu_ok: markets.append(f"Euronext {now_paris.strftime('%H:%M')} CET")
    if us_ok: markets.append(f"NYSE {now_ny.strftime('%H:%M')} ET")

    return True, f"Ouvert : {', '.join(markets)}"


def _get_tradable_tickers(tickers: list[str]) -> list[str]:
    """Filtre les tickers tradables selon l'heure — crypto toujours OK."""
    now_paris = datetime.now(PARIS_TZ)
    now_ny    = datetime.now(NY_TZ)
    weekday   = now_paris.weekday()

    eu_ok = us_ok = False
    if weekday < 5:
        eu_open  = now_paris.replace(hour=9,  minute=0,  second=0, microsecond=0)
        eu_close = now_paris.replace(hour=17, minute=30, second=0, microsecond=0)
        eu_ok    = eu_open <= now_paris <= eu_close
        us_open  = now_ny.replace(hour=9,  minute=30, second=0, microsecond=0)
        us_close = now_ny.replace(hour=16, minute=0,  second=0, microsecond=0)
        us_ok    = us_open <= now_ny <= us_close

    result = []
    for t in tickers:
        if t in CRYPTO_TICKERS or "=F" in t:
            result.append(t)          # 24/7
        elif t.endswith(".PA") or t.endswith(".AS") or t.endswith(".DE"):
            if eu_ok: result.append(t)
        else:
            if us_ok: result.append(t)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# MARKET CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

def _get_spy_change() -> Optional[float]:
    try:
        df = yf.download("SPY", period="5d", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or len(df) < 2:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        closes = df["Close"].dropna()
        change = (float(closes.iloc[-1]) - float(closes.iloc[-2])) / float(closes.iloc[-2])
        return round(change, 4)
    except Exception as e:
        logger.warning(f"SPY fetch error: {e}")
        return None


def _get_vix() -> Optional[float]:
    try:
        df = yf.download("^VIX", period="5d", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return float(df["Close"].dropna().iloc[-1])
    except Exception as e:
        logger.warning(f"VIX fetch error: {e}")
        return None


def _get_evite_tickers(db) -> set[str]:
    """
    Calcule dynamiquement les tickers à bannir selon la performance ML réelle.
    Critère de ban automatique (ANY satisfait) :
      A) WR < 35% sur >= 5 trades SELL BOT
      B) 3 derniers trades consécutifs tous en perte (revenge-trading guard)
    Ces tickers sont EXCLUS de tout cycle — même le force-crypto 24/7 est bloqué.
    Ce n'est PAS une soft rule (prompt) — c'est une HARD exclusion en code.
    """
    from app.models.portfolio import Trade as _Trade
    try:
        rows = db.query(_Trade.ticker, _Trade.profit, _Trade.id).filter(
            _Trade.actor == "BOT",
            _Trade.side == "SELL",
        ).order_by(_Trade.id.asc()).all()

        # Agrège les stats par ticker
        stats: dict[str, dict] = {}
        for row in rows:
            t = row.ticker
            if t not in stats:
                stats[t] = {"wins": 0, "total": 0, "recent": []}
            stats[t]["total"] += 1
            profit = float(row.profit or 0)
            if profit > 0:
                stats[t]["wins"] += 1
                stats[t]["recent"].append(True)
            else:
                stats[t]["recent"].append(False)

        evite: set[str] = set()
        for ticker, s in stats.items():
            # BTC-USD et ETH-USD ne sont jamais bannis — dernier recours 24/7
            if ticker in NEVER_BAN_TICKERS:
                continue

            total = s["total"]
            wins  = s["wins"]
            recent = s["recent"]

            # Critère A : WR < 35% sur >= 8 trades (était 5 — trop rapide à bannir)
            if total >= 8 and (wins / total) < 0.35:
                evite.add(ticker)
                logger.warning(
                    f"[ML-BAN] {ticker} — WR={wins}/{total}={wins/total*100:.0f}% < 35% "
                    f"→ exclu du cycle"
                )
                continue

            # Critère B : 4 derniers trades consécutifs en perte (était 3)
            if len(recent) >= 4 and not any(recent[-4:]):
                evite.add(ticker)
                logger.warning(
                    f"[ML-BAN] {ticker} — 4 pertes consécutives récentes → exclu du cycle"
                )

        return evite
    except Exception as e:
        logger.warning(f"_get_evite_tickers error: {e}")
        return set()


def _get_position_multiplier(vix: Optional[float]) -> tuple[float, str]:
    if vix is None:
        return 1.0, "VIX indisponible"
    if vix >= VIX_EXTREME:
        return 0.35, f"VIX extrême {vix:.1f} — positions réduites à 35%"
    if vix >= VIX_HIGH_THRESHOLD:
        return 0.65, f"VIX élevé {vix:.1f} — positions réduites à 65%"
    return 1.0, f"VIX normal {vix:.1f}"


def _get_macro_news(limit: int = 8) -> str:
    """Récupère les news macro directement via NewsAPI."""
    try:
        import requests as _req
        from app.config import NEWSAPI_KEY
        if not NEWSAPI_KEY:
            return "News non disponibles (clé manquante)."
        query = (
            '(Fed OR ECB OR inflation OR recession OR GDP OR "interest rates" '
            'OR oil OR OPEC OR sanctions OR war OR tariffs OR earnings) '
            'AND (market OR stocks OR bonds OR commodities)'
        )
        r = _req.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": limit,
                "apiKey": NEWSAPI_KEY,
            },
            timeout=8,
        )
        if r.status_code != 200:
            return "News non disponibles."
        articles = r.json().get("articles", []) or []
        if not articles:
            return "Aucune news disponible."
        lines = []
        for a in articles[:limit]:
            title  = (a.get("title") or "").strip()
            source = ((a.get("source") or {}).get("name") or "")
            if title and "[Removed]" not in title:
                lines.append(f"  * [{source}] {title}")
        return "NEWS MACRO RECENTES :\n" + "\n".join(lines) if lines else "Aucune news disponible."
    except Exception as e:
        logger.warning(f"News fetch error: {e}")
        return "News non disponibles (erreur reseau)."


# ═══════════════════════════════════════════════════════════════════════════════
# PRIX + STRIKES
# ═══════════════════════════════════════════════════════════════════════════════

def _price_round(val: float) -> float:
    """Précision adaptative selon l'ordre de grandeur du prix."""
    if val < 0.01:  return round(val, 8)
    if val < 1.0:   return round(val, 6)
    if val < 100.0: return round(val, 4)
    return round(val, 2)


def _price_category(ticker: str) -> str:
    if ticker in _LEVERAGED_ETFS:   return "leveraged"
    if ticker in CRYPTO_TICKERS:    return "crypto"
    return "default"


def _validate_price(ticker: str, candidate: float, prev_close: float) -> Optional[float]:
    """
    Valide un prix candidat en le comparant au close précédent.
    Si le mouvement dépasse le seuil de la catégorie :
      1. Tente un download intraday 5m pour confirmer
      2. Si intraday aussi suspect (vs prev_close) → retourne None (TRADE ANNULÉ)
      3. Si intraday est cohérent → retourne le prix intraday
    Retourne le prix validé ou None.
    """
    max_move = _MAX_DAILY_MOVE[_price_category(ticker)]
    move     = abs(candidate / prev_close - 1) if prev_close > 0 else 0.0

    if move <= max_move:
        return candidate  # ✓ prix dans les bornes normales

    # ── Prix suspect : cross-validation intraday ─────────────────────────────
    logger.warning(
        f"[PRICE SANITY] {ticker}: close=${candidate:.4f} vs prev_close=${prev_close:.4f} "
        f"(move={move*100:.1f}% > seuil {max_move*100:.0f}%) — cross-validation intraday..."
    )
    try:
        df2 = yf.download(
            ticker, period="1d", interval="5m",
            progress=False, auto_adjust=False, timeout=10,
        )
        if df2 is not None and not df2.empty:
            if isinstance(df2.columns, pd.MultiIndex):
                df2.columns = df2.columns.get_level_values(0)
            intraday_closes = df2["Close"].dropna()
            if not intraday_closes.empty:
                intraday_price = float(intraday_closes.iloc[-1])
                if intraday_price > 0:
                    intraday_move = abs(intraday_price / prev_close - 1)
                    if intraday_move <= max_move:
                        logger.info(
                            f"[PRICE SANITY OK] {ticker}: intraday=${intraday_price:.4f} validé "
                            f"(move={intraday_move*100:.1f}% ≤ {max_move*100:.0f}%)"
                        )
                        return _price_round(intraday_price)
                    # intraday aussi incohérent
                    logger.error(
                        f"[PRICE SANITY FAIL] {ticker}: intraday=${intraday_price:.4f} aussi suspect "
                        f"(move={intraday_move*100:.1f}%) → TRADE ANNULÉ pour ce ticker ce cycle"
                    )
                    return None
    except Exception as e:
        logger.error(f"[PRICE SANITY] {ticker}: intraday cross-validation error: {e}")

    # ── Pas de données intraday disponibles → refuser plutôt que risquer ─────
    logger.error(
        f"[PRICE SANITY FAIL] {ticker}: impossible de valider ${candidate:.4f} "
        f"sans données intraday → TRADE ANNULÉ"
    )
    return None


def _get_price(ticker: str) -> Optional[float]:
    """
    Fetche et valide le prix d'exécution d'un ticker.

    Ordre de priorité :
      1. Cache intra-cycle (évite les appels répétés)
      2. CoinGecko (crypto uniquement) — source officielle, aucun bug cross-ticker
      3. yfinance + sanity check (stocks, ETFs, et fallback crypto)

    Retourne None si le prix ne peut pas être validé → trade annulé.
    """
    ts_now = _time.monotonic()
    if ticker in _price_cache_cycle:
        cached_val, cached_ts = _price_cache_cycle[ticker]
        if ts_now - cached_ts < _PRICE_CACHE_CYCLE_TTL:
            return cached_val

    # ── 1. CoinGecko pour la crypto (primaire — fiable, officiel) ────────────
    if ticker in _COINGECKO_IDS and _COINGECKO_IDS[ticker] is not None:
        cg_prices = _fetch_coingecko_prices([ticker])
        if ticker in cg_prices:
            val = _price_round(cg_prices[ticker])
            _price_cache_cycle[ticker] = (val, ts_now)
            logger.debug(f"[PRICE CoinGecko] {ticker} = ${val}")
            return val
        # CoinGecko a échoué → fallback yfinance
        logger.warning(f"[PRICE] CoinGecko indisponible pour {ticker} — fallback yfinance")

    # ── 2a. yfinance fast_info (quote temps-réel — endpoint distinct de l'historique) ──
    # Priorité au fast_info car il est servi par l'API quote Yahoo (pas l'API historique)
    # → immunisé aux bugs split-unadjusted / stale historical data qui corrompent yf.download
    try:
        ticker_obj   = yf.Ticker(ticker)
        fi           = ticker_obj.fast_info
        last_p       = fi.last_price
        prev_close_fi = getattr(fi, "previous_close", None)

        if last_p is not None and float(last_p) > 0:
            val = float(last_p)
            # Valider contre previous_close du même objet fast_info (source identique)
            if prev_close_fi is not None and float(prev_close_fi) > 0:
                validated = _validate_price(ticker, val, float(prev_close_fi))
                if validated is None:
                    logger.warning(
                        f"[PRICE] {ticker}: fast_info=${val:.4f} rejeté par _validate_price "
                        f"(prev_close_fi=${float(prev_close_fi):.4f}) → fallback download"
                    )
                    # Ne pas retourner None ici → laisser le fallback download tenter
                    last_p = None  # force fallback
                else:
                    val = _price_round(validated)
                    _price_cache_cycle[ticker] = (val, ts_now)
                    logger.debug(f"[PRICE fast_info] {ticker} = ${val}")
                    return val
            else:
                # Pas de previous_close disponible → utiliser fast_info sans validation
                val = _price_round(val)
                _price_cache_cycle[ticker] = (val, ts_now)
                logger.debug(f"[PRICE fast_info no-prev] {ticker} = ${val}")
                return val
    except Exception as e:
        logger.debug(f"[PRICE] fast_info error {ticker}: {e}")

    # ── 2b. yfinance download (fallback si fast_info indisponible ou rejeté) ────
    # Note : ce chemin est plus sujet aux corruptions historiques (split-unadjusted,
    # stale data, cross-ticker bugs). _validate_price cross-valide contre l'intraday
    # si le mouvement semble suspect.
    try:
        df = yf.download(
            ticker, period="5d", interval="1d",
            progress=False, auto_adjust=False, timeout=8,
        )
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        closes = df["Close"].dropna()
        if closes.empty:
            return None

        val = float(closes.iloc[-1])
        if val != val or val <= 0:
            return None

        # ── Sanity check : compare au close J-1 (même dataset, 0 appel réseau) ──
        if len(closes) >= 2:
            prev_close = float(closes.iloc[-2])
            if prev_close > 0:
                validated = _validate_price(ticker, val, prev_close)
                if validated is None:
                    return None
                val = validated

        val = _price_round(val)
        _price_cache_cycle[ticker] = (val, ts_now)
        return val
    except Exception as e:
        logger.warning(f"Price fetch error {ticker}: {e}")
        return None


def _get_strike_levels(ticker: str) -> dict:
    try:
        df = yf.download(ticker, period="1y", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or df.empty or len(df) < 20:
            return {}
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna(subset=["Close", "High", "Low"])

        price   = float(df["Close"].iloc[-1])
        high52w = float(df["High"].max())
        low52w  = float(df["Low"].min())
        sma200  = float(df["Close"].rolling(200).mean().iloc[-1]) if len(df) >= 200 else None
        sma50   = float(df["Close"].rolling(50).mean().iloc[-1])  if len(df) >= 50  else None

        pct_from_high = round((price - high52w) / high52w * 100, 1) if high52w else None
        pct_from_low  = round((price - low52w)  / low52w  * 100, 1) if low52w  else None

        return {
            "price":         round(price, 2),
            "high52w":       round(high52w, 2),
            "low52w":        round(low52w, 2),
            "sma200":        round(sma200, 2) if sma200 else None,
            "sma50":         round(sma50, 2)  if sma50  else None,
            "near_high":     price >= high52w * 0.97,
            "near_low":      price <= low52w  * 1.04,
            "above_sma200":  (price > sma200) if sma200 else None,
            "above_sma50":   (price > sma50)  if sma50  else None,
            "pct_from_high": pct_from_high,
            "pct_from_low":  pct_from_low,
        }
    except Exception as e:
        logger.warning(f"Strike levels error {ticker}: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# PERFORMANCE POSITIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _get_positions_performance(db, portfolio: Portfolio) -> list[dict]:
    positions = db.query(Position).filter(
        Position.portfolio_id == portfolio.id,
        Position.quantity > 0,
    ).all()
    result = []
    for pos in positions:
        current_price = _get_price(pos.ticker)
        if not current_price:
            continue
        avg = float(pos.avg_price) if pos.avg_price else 0
        qty = float(pos.quantity)
        pnl = (current_price - avg) * qty if avg > 0 else 0
        pnl_pct = (current_price - avg) / avg * 100 if avg > 0 else 0
        result.append({
            "ticker":    pos.ticker,
            "qty":       qty,
            "avg_price": round(avg, 2),
            "current":   round(current_price, 2),
            "pnl":       round(pnl, 2),
            "pnl_pct":   round(pnl_pct, 1),
            "value_usd": round(current_price * qty, 2),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# EXÉCUTION TRADES — Sizing basé sur confiance
# ═══════════════════════════════════════════════════════════════════════════════

def _max_pct_for_confidence(confidence: str) -> float:
    """Retourne le % max du portfolio selon le niveau de confiance."""
    if confidence == "HIGH":
        return MAX_PCT_HIGH
    if confidence == "MEDIUM":
        return MAX_PCT_MEDIUM
    return MAX_PCT_LOW


def _sanity_check_exec_price(
    ticker: str,
    exec_price: float,
    avg_price: float,
    action: str,
) -> tuple[bool, str]:
    """
    Défense n°2 (après _validate_price) :
    Compare le prix d'exécution au avg_price de la position ouverte.
    Indépendante de yfinance — utilise uniquement les données internes DB.

    Exemples de bugs détectés :
      SOL sell @ $73,925 vs avg $94    → ratio 786x  → ANNULÉ ✓
      BTC sell @ $94 vs avg $73,999    → ratio 0.001x → ANNULÉ ✓
      TQQQ sell @ $398 vs avg $47.64   → ratio 8.35x  → ANNULÉ ✓
      ETH sell @ $145 vs avg $2307     → ratio 0.063x → ANNULÉ ✓

    Bornes larges pour couvrir positions longues (semaines/mois) :
      MAX ratio : 15x  (ex: SOL × 15 en bull run = exceptionnel mais possible)
      MIN ratio : 0.05 (ex: stock -95% suite faillite = rare mais réel)
    Ces bornes ne bloquent PAS les mouvements légitimes extrêmes mais
    bloquent toujours les erreurs de cross-ticker qui donnent des ratios × 800.
    """
    if avg_price <= 0 or exec_price <= 0:
        return True, ""  # pas de référence → on ne peut pas vérifier

    ratio = exec_price / avg_price
    # Leveraged ETFs : borne MAX plus stricte (6x) car un ETF 3x qui ×6 son prix
    # implique un underlying ×2 → exceptionnel sur quelques mois, vraisemblablement
    # une corruption de données si observé sur une position récente.
    # Stocks / crypto : 15x (bulle possible sur plusieurs mois, ex: SOL × 12 en 2021)
    if ticker in _LEVERAGED_ETFS:
        MAX_RATIO = 6.0
    else:
        MAX_RATIO = 15.0
    MIN_RATIO = 0.05

    if ratio > MAX_RATIO or ratio < MIN_RATIO:
        logger.error(
            f"[EXEC SANITY FAIL] {action} {ticker}: "
            f"exec_price=${exec_price:.4f} vs avg_price=${avg_price:.4f} "
            f"(ratio={ratio:.3f}x hors bornes [{MIN_RATIO}x, {MAX_RATIO}x]) "
            f"→ TRADE ANNULÉ — probable erreur prix yfinance (cross-ticker/stale data)"
        )
        return False, (
            f"Prix suspect ${exec_price:.2f} vs avg ${avg_price:.2f} "
            f"(ratio {ratio:.1f}x — max autorisé {MAX_RATIO}x)"
        )
    return True, ""


def _execute(
    db,
    portfolio: Portfolio,
    decision: BotDecision,
    price: float,
    position_multiplier: float,
) -> tuple[bool, str]:
    FEE  = float(FEE_RATE)
    SLIP = float(SLIPPAGE_BPS) / 10_000

    positions = db.query(Position).filter(
        Position.portfolio_id == portfolio.id, Position.quantity > 0
    ).all()
    pos_value = sum((_get_price(p.ticker) or float(p.avg_price)) * float(p.quantity) for p in positions)
    equity = float(portfolio.cash) + pos_value

    max_pct = _max_pct_for_confidence(decision.confidence)

    if decision.action == "BUY":
        raw_usd   = decision.amount_usd * position_multiplier
        cash_avail = max(0.0, float(portfolio.cash) - equity * MIN_CASH_RESERVE)
        spend_usd = min(raw_usd, cash_avail, equity * max_pct)

        if spend_usd < 1.0:
            return False, f"Cash insuffisant (dispo: ${float(portfolio.cash):.0f})"

        exec_price = price * (1 + SLIP)
        qty        = spend_usd / exec_price
        cost       = exec_price * qty
        fee        = cost * FEE
        total      = cost + fee

        if total > float(portfolio.cash):
            qty   = (float(portfolio.cash) * 0.99) / (exec_price * (1 + FEE))
            cost  = exec_price * qty
            fee   = cost * FEE
            total = cost + fee
            # Re-check minimum après recalcul — évite des trades ridicules de $0.50
            if total < 1.0:
                return False, f"Cash résiduel insuffisant (${float(portfolio.cash):.2f} dispo < $1)"

        if qty < 1e-6:
            return False, "Montant insuffisant"

        pos = db.query(Position).filter(
            Position.portfolio_id == portfolio.id,
            Position.ticker == decision.ticker,
        ).one_or_none()

        # ── Sanity check BUY : comparer exec_price au avg existant (pyramiding) ──
        if pos and float(pos.quantity) > 0 and float(pos.avg_price) > 0:
            ok, reason = _sanity_check_exec_price(
                decision.ticker, exec_price, float(pos.avg_price), "BUY"
            )
            if not ok:
                return False, f"BUY annulé — {reason}"

        if not pos:
            from app.models.portfolio import Position as Pos
            pos = Pos(portfolio_id=portfolio.id, ticker=decision.ticker, quantity=0.0, avg_price=0.0)
            db.add(pos)
            db.flush()

        new_qty = float(pos.quantity) + qty
        pos.avg_price = (
            (float(pos.avg_price) * float(pos.quantity) + exec_price * qty) / new_qty
            if float(pos.quantity) > 0 else exec_price
        )
        pos.quantity  = new_qty
        portfolio.cash = float(portfolio.cash) - total

        db.add(Trade(
            portfolio_id=portfolio.id,
            ticker=decision.ticker,
            side="BUY",
            price=round(exec_price, 4),
            quantity=round(qty, 6),
            profit=0.0,
            actor=BOT_ACTOR,
            rationale=decision.rationale_fr,
        ))
        return True, f"BUY ${spend_usd:.0f} -> {qty:.4f} x {decision.ticker} @ ${exec_price:.2f} [{decision.confidence}]"

    elif decision.action == "SELL":
        pos = db.query(Position).filter(
            Position.portfolio_id == portfolio.id,
            Position.ticker == decision.ticker,
        ).one_or_none()
        if not pos or float(pos.quantity) <= 0:
            return False, "Aucune position"

        exec_price  = price * (1 - SLIP)

        # ── Sanity check SELL : comparer exec_price au avg_price de la position ──
        # C'est ici que les bugs cross-ticker sont bloqués :
        #   SOL sell @ $73,925 vs avg $94  → ratio 786x  → bloqué ✓
        #   BTC sell @ $94 vs avg $73,999  → ratio 0.001x → bloqué ✓
        avg_for_check = float(pos.avg_price) if pos.avg_price else 0
        if avg_for_check > 0:
            ok, reason = _sanity_check_exec_price(
                decision.ticker, exec_price, avg_for_check, "SELL"
            )
            if not ok:
                return False, f"SELL annulé — {reason}"

        qty_to_sell = decision.amount_usd / exec_price

        # Si on vendrait 80%+ de la position, tout vendre
        if qty_to_sell >= float(pos.quantity) * 0.80:
            qty_to_sell = float(pos.quantity)
        qty_to_sell = min(qty_to_sell, float(pos.quantity))

        if qty_to_sell <= 1e-9:
            return False, "Quantité nulle"

        revenue = exec_price * qty_to_sell
        fee     = revenue * FEE
        net     = revenue - fee
        avg     = float(pos.avg_price) if pos.avg_price else 0
        profit  = (exec_price - avg) * qty_to_sell if avg > 0 else 0

        pos.quantity = float(pos.quantity) - qty_to_sell
        if float(pos.quantity) < 1e-9:
            pos.quantity  = 0.0
            pos.avg_price = 0.0
        portfolio.cash = float(portfolio.cash) + net

        db.add(Trade(
            portfolio_id=portfolio.id,
            ticker=decision.ticker,
            side="SELL",
            price=round(exec_price, 4),
            quantity=round(qty_to_sell, 6),
            profit=round(profit - fee, 2),
            actor=BOT_ACTOR,
            rationale=decision.rationale_fr,
        ))
        return True, f"SELL {qty_to_sell:.4f} x {decision.ticker} @ ${exec_price:.2f} PnL=${profit:.2f}"

    return False, "HOLD"


def _snapshot(db, portfolio: Portfolio):
    positions = db.query(Position).filter(
        Position.portfolio_id == portfolio.id, Position.quantity > 0
    ).all()
    pos_val = sum((_get_price(p.ticker) or float(p.avg_price)) * float(p.quantity) for p in positions)
    db.add(EquitySnapshot(
        portfolio_id=portfolio.id,
        equity=float(portfolio.cash) + pos_val,
        cash=float(portfolio.cash),
    ))


# ═══════════════════════════════════════════════════════════════════════════════
# RESET PORTFOLIO IA
# ═══════════════════════════════════════════════════════════════════════════════

def reset_bot_portfolio(db, user_id: int) -> dict:
    """
    Réinitialise le portfolio IA de l'utilisateur demandeur UNIQUEMENT.
    CRITIQUE : filtre par user_id — évite de reset les portfolios des autres users.
    """
    from app.config import STARTING_CASH

    pf = db.query(Portfolio).filter(
        Portfolio.name == BOT_PORTFOLIO_NAME,
        Portfolio.user_id == user_id,   # ← filtre par user : SEUL son portfolio
    ).first()

    if not pf:
        return {"ok": False, "message": "Portfolio IA introuvable pour cet utilisateur"}

    db.query(Position).filter(Position.portfolio_id == pf.id).delete()
    db.query(Trade).filter(Trade.portfolio_id == pf.id).delete()
    db.query(EquitySnapshot).filter(EquitySnapshot.portfolio_id == pf.id).delete()
    pf.cash = float(STARTING_CASH)
    db.commit()
    logger.info(f"Portfolio IA user={user_id} réinitialisé — cash=${float(STARTING_CASH):,.0f}")
    return {"ok": True, "message": f"Ton portfolio IA a été réinitialisé — capital remis à ${float(STARTING_CASH):,.0f}"}


# ═══════════════════════════════════════════════════════════════════════════════
# CYCLE PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

def run_bot_cycle() -> BotCycleLog:
    global _bot_running, _bot_last_start, _price_cache_cycle
    with _bot_running_lock:
        if _bot_running:
            logger.warning("Bot cycle already running — skipping duplicate trigger")
            return BotCycleLog(
                timestamp=datetime.now(PARIS_TZ).isoformat(),
                decisions=[],
                market_summary_fr="Cycle déjà en cours — ignoré",
                market_summary_en="Cycle already running — skipped",
                users_processed=0,
                total_trades=0,
                screened_assets=[],
                errors=["duplicate_trigger"],
            )
        _bot_running = True
        _bot_last_start = datetime.now(PARIS_TZ).isoformat()

    # ── HARD TIMEOUT GUARD : force reset _bot_running après 3 min max ─────────
    # Protège contre tout hang résiduel (yfinance, API IA, DB) quel que soit
    # l'endroit du cycle. Garantit que le flag revient à False en < 3 min.
    def _force_reset_flag():
        global _bot_running
        logger.error("BOT CYCLE FORCE TIMEOUT (3min) — resetting _bot_running flag")
        with _bot_running_lock:
            _bot_running = False

    _hard_timeout = _threading.Timer(180, _force_reset_flag)
    _hard_timeout.daemon = True
    _hard_timeout.start()

    # Vider le cache prix — on veut des prix frais pour ce cycle
    _price_cache_cycle.clear()
    _cycle_start = _time.monotonic()

    now = datetime.now(PARIS_TZ)
    logger.info(f"=== BOT CYCLE START {now.isoformat()} ===")

    db = None
    cycle_log = BotCycleLog(
        timestamp=now.isoformat(),
        decisions=[],
        market_summary_fr="",
        market_summary_en="",
        spy_change=None,
        vix=None,
        macro_news="",
        users_processed=0,
        total_trades=0,
        screened_assets=[],
        portfolio_value_before=None,
        portfolio_value_after=None,
        cycle_duration_s=None,
        errors=[],
    )

    try:
        db = SessionLocal()

        # 0. Statut marchés
        market_open, market_status = _is_market_open()
        logger.info(f"Market status: {market_status}")

        # 1+2+3. SPY + VIX + News en PARALLÈLE (étaient séquentiels = 15-30s de perdu)
        # IMPORTANT : PAS de `with _TPE() as ...:` — __exit__ appelle shutdown(wait=True)
        # ce qui BLOQUE si un thread yfinance est pendu. On utilise shutdown(wait=False).
        logger.info("Fetching SPY/VIX/News in parallel...")
        _ex_macro = _TPE(max_workers=3)
        _spy_fut  = _ex_macro.submit(_get_spy_change)
        _vix_fut  = _ex_macro.submit(_get_vix)
        _news_fut = _ex_macro.submit(_get_macro_news, 8)
        try:
            spy_change = _spy_fut.result(timeout=20)
        except Exception:
            spy_change = None
        try:
            vix = _vix_fut.result(timeout=20)
        except Exception:
            vix = None
        try:
            macro_news = _news_fut.result(timeout=15)
        except Exception:
            macro_news = "News non disponibles."
        _ex_macro.shutdown(wait=False)  # CRITIQUE : libère sans attendre les threads pendants
        cycle_log.spy_change = spy_change
        cycle_log.vix = vix
        cycle_log.macro_news = (macro_news or "")[:2000]

        if spy_change is not None and spy_change <= SPY_DROP_THRESHOLD:
            msg = f"Circuit breaker — SPY {spy_change*100:.1f}% aujourd'hui. Aucun trade actions US."
            logger.warning(msg)
            cycle_log.errors.append(msg)

        position_multiplier, vix_reason = _get_position_multiplier(vix)

        # 4a. ── ML BLACKLIST — tickers bannis selon performance réelle ──────────
        # HARD exclusion avant tout : ni screener, ni LLM, ni force-crypto
        # ne peut contourner ce filtre. Basé sur WR réel en DB.
        evite_tickers = _get_evite_tickers(db)
        if evite_tickers:
            logger.warning(f"[ML-BAN] {len(evite_tickers)} ticker(s) exclus ce cycle: {evite_tickers}")

        # 4b. Screener — filtre par marché ouvert
        # top_n=15 pour avoir un pool assez large
        assets_all = run_screener(top_n=15)
        # Appliquer le blacklist ML dès la sortie du screener
        assets_all = [a for a in assets_all if a.ticker not in evite_tickers]
        tradable   = set(_get_tradable_tickers([a.ticker for a in assets_all]))

        # Si circuit breaker SPY, exclure les actions US mais garder crypto + EU
        if spy_change is not None and spy_change <= SPY_DROP_THRESHOLD:
            tradable = {t for t in tradable if t in CRYPTO_TICKERS or t.endswith(".PA")}
            logger.info(f"Circuit breaker actif — restriction à crypto+EU: {tradable}")

        assets = [a for a in assets_all if a.ticker in tradable]

        # ── Garantie crypto 24/7 (sauf actifs bannis) ────────────────────────
        # Toujours garder au moins 3 crypto dans le pool — elles sont 24/7 et
        # évitent que le bot soit bloqué hors heures de marché US/EU.
        # SAUF si ML-banni (pertes confirmées → on ne force jamais un banni).
        crypto_in_assets = {a.ticker for a in assets if a.ticker in CRYPTO_TICKERS}
        if len(crypto_in_assets) < 3:
            from app.routers.bot_screener import _fetch_single
            # Priorité : BTC → ETH → SOL → XRP (liquidité décroissante)
            safe_crypto = [ct for ct in ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"]
                           if ct not in evite_tickers]
            logger.info(f"Peu de crypto tradable ({len(crypto_in_assets)}/3) — ajout: {safe_crypto}")
            for ct in safe_crypto:
                if ct not in crypto_in_assets:
                    existing = next((a for a in assets_all if a.ticker == ct), None)
                    if existing:
                        assets.append(existing)
                        crypto_in_assets.add(ct)   # seulement si ajouté réellement
                    else:
                        ca = _fetch_single(ct)
                        if ca:
                            assets.append(ca)
                            crypto_in_assets.add(ct)   # seulement si fetch réussi
                if len(crypto_in_assets) >= 3:
                    break

        assets = assets[:12]
        cycle_log.screened_assets = [a.ticker for a in assets]
        logger.info(
            f"Screener: {len(assets_all)} actifs -> {len(assets)} tradables "
            f"({market_status}) | bannis={evite_tickers} | "
            f"crypto: {[a.ticker for a in assets if a.ticker in CRYPTO_TICKERS]}"
        )

        if not assets:
            cycle_log.market_summary_fr = f"Aucun actif tradable ({market_status})"
            cycle_log.market_summary_en = f"No tradable assets ({market_status})"
            save_bot_cycle(cycle_log)
            return cycle_log

        # 5. Positions + equity
        first_pf = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).first()
        current_positions: dict = {}
        positions_performance: list = []
        portfolio_equity = 10000.0

        if first_pf:
            current_positions = {
                p.ticker: float(p.quantity)
                for p in db.query(Position).filter(
                    Position.portfolio_id == first_pf.id, Position.quantity > 0
                ).all()
            }
            positions_performance = _get_positions_performance(db, first_pf)
            portfolio_equity = float(first_pf.cash) + sum(p["value_usd"] for p in positions_performance)
            cycle_log.portfolio_value_before = round(portfolio_equity, 2)

        # 5b. Strikes — skipped for speed (1y downloads trop lents, non essentiels)
        # Les indicateurs screener (RSI/MACD/ADX/momentum) suffisent pour Gemini.
        strikes_map: dict[str, dict] = {}

        # 5c. ─── STOP-LOSS & TAKE-PROFIT AUTOMATIQUES (avant l'IA) ───────────────
        # CRITIQUE : chaque portfolio est surveillé INDÉPENDAMMENT.
        # Bug précédent : seul first_pf était vérifié → les autres portfolios
        # pouvaient perdre bien au-delà du SL sans que rien ne se déclenche.
        from app.routers.bot_brain import BotDecision as BD

        all_pf_for_sltp = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).all()

        # VIX PANIC MODE : VIX > 40 → SELL TOTAL de toutes les positions immédiatement
        # Règle absolue : protéger le capital avant tout — plus de BUY tant que VIX > 40
        vix_panic = vix is not None and vix >= VIX_EXTREME

        # Collecte les décisions forcées PAR portfolio
        forced_by_pf: dict[int, list[BD]] = {}
        all_forced_tickers: set[str] = set()

        for _pf in all_pf_for_sltp:
            _positions = _get_positions_performance(db, _pf)
            _pf_forced: list[BD] = []
            for p in _positions:
                pnl_pct = p["pnl_pct"]
                ticker  = p["ticker"]

                if vix_panic:
                    # VIX > 40 : forcer SELL TOTAL de chaque position (capital protection)
                    _pf_forced.append(BD(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 2,  # oversized → sells ALL
                        rationale_fr=f"VIX PANIC {vix:.1f} > 40 — SELL TOTAL pour protéger le capital",
                        rationale_en=f"VIX PANIC {vix:.1f} > 40 — SELL ALL to protect capital",
                        risk_level="HIGH",
                    ))
                    logger.warning(f"  [VIX-PANIC pf={_pf.id}] SELL ALL {ticker} (VIX={vix:.1f})")
                    all_forced_tickers.add(ticker)

                elif pnl_pct <= SL_THRESHOLD * 100:
                    _pf_forced.append(BD(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 2,  # oversized → sells ALL
                        rationale_fr=f"STOP LOSS AUTO {pnl_pct:.1f}% — seuil {SL_THRESHOLD*100:.0f}% atteint",
                        rationale_en=f"AUTO STOP LOSS {pnl_pct:.1f}% — {SL_THRESHOLD*100:.0f}% threshold hit",
                        risk_level="HIGH",
                    ))
                    logger.warning(f"  [SL pf={_pf.id}] {ticker} @ {pnl_pct:.1f}%")
                    all_forced_tickers.add(ticker)

                elif pnl_pct >= TP_THRESHOLD * 100:
                    _pf_forced.append(BD(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 0.60,
                        rationale_fr=f"TAKE PROFIT AUTO +{pnl_pct:.1f}% — seuil +{TP_THRESHOLD*100:.0f}% atteint, vente 60%",
                        rationale_en=f"AUTO TAKE PROFIT +{pnl_pct:.1f}% — +{TP_THRESHOLD*100:.0f}% threshold, selling 60%",
                        risk_level="LOW",
                    ))
                    logger.info(f"  [TP pf={_pf.id}] {ticker} @ +{pnl_pct:.1f}%")
                    all_forced_tickers.add(ticker)

            forced_by_pf[_pf.id] = _pf_forced

        # Fetch les prix une seule fois pour tous les tickers concernés
        forced_prices: dict[str, float] = {}
        for t in all_forced_tickers:
            pr = _get_price(t)
            if pr:
                forced_prices[t] = pr

        # Exécute chaque décision forcée sur le portfolio CONCERNÉ (pas tous !)
        has_forced = any(v for v in forced_by_pf.values())
        if has_forced:
            for _pf in all_pf_for_sltp:
                for fd in forced_by_pf.get(_pf.id, []):
                    pr = forced_prices.get(fd.ticker)
                    if not pr:
                        logger.warning(f"  [FORCED] Prix indisponible pour {fd.ticker}")
                        continue
                    ok, msg = _execute(db, _pf, fd, pr, position_multiplier)
                    if ok:
                        logger.info(f"  [FORCED pf={_pf.id}] {msg}")
            db.commit()
            # Refresh first_pf pour le contexte LLM
            if first_pf:
                positions_performance = _get_positions_performance(db, first_pf)
                portfolio_equity = float(first_pf.cash) + sum(p["value_usd"] for p in positions_performance)

        # 5d. ── Limite positions simultanées (évite sur-diversification / sur-expo) ─
        n_open_positions = len([p for p in positions_performance if p["value_usd"] > 0])
        if n_open_positions >= MAX_OPEN_POSITIONS:
            logger.info(
                f"Positions ouvertes: {n_open_positions}/{MAX_OPEN_POSITIONS} — "
                f"BUY bloqués jusqu'à fermeture d'une position"
            )

        # 6. IA
        market_context = {
            "spy_change_pct":        round(spy_change * 100, 2) if spy_change else None,
            "vix":                   vix,
            "vix_regime":            vix_reason,
            "position_multiplier":   position_multiplier,
            "macro_news":            macro_news,
            "positions_performance": positions_performance,
            "portfolio_equity":      round(portfolio_equity, 2),
            "strikes":               strikes_map,
            "n_open_positions":      n_open_positions,
            "max_open_positions":    MAX_OPEN_POSITIONS,
        }

        decisions, market_fr, market_en = run_bot_brain(
            assets, db, current_positions,
            market_context=market_context,
            evite_tickers=evite_tickers,
        )

        # ── Post-LLM safety filters (cascade) ───────────────────────────────────
        screened_tickers = {a.ticker for a in assets}
        circuit_breaker_active = (
            spy_change is not None and spy_change <= SPY_DROP_THRESHOLD
        )
        pre_filter_count = len(decisions)
        filtered_decisions = []
        for d in decisions:
            if d.action == "BUY":
                # Guard 1 : tickers ML-bannis — jamais, quelles que soient les instructions LLM
                if d.ticker in evite_tickers:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — ML-ban (WR < 35% ou pertes consécutives)")
                    cycle_log.errors.append(f"ML-ban: BUY {d.ticker} bloqué post-LLM")
                    continue

                # Guard 2 : hallucination LLM — le ticker n'était pas dans les actifs screened
                # (le LLM peut inventer des tickers TIER1 comme TQQQ même si absent du screener)
                if d.ticker not in screened_tickers:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — ticker hors screener (hallucination LLM)")
                    cycle_log.errors.append(f"Hallucination: BUY {d.ticker} hors screener bloqué")
                    continue

                # Guard 3 : circuit breaker SPY — pas de BUY actions US
                if circuit_breaker_active:
                    is_us_stock = d.ticker not in CRYPTO_TICKERS and not d.ticker.endswith(".PA")
                    if is_us_stock:
                        logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — circuit breaker SPY actif")
                        cycle_log.errors.append(f"Circuit breaker: BUY {d.ticker} bloqué")
                        continue

                # Guard 4 : VIX > 40 — AUCUN BUY autorisé (panic mode, cash only)
                if vix_panic:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — VIX PANIC {vix:.1f} > 40 (mode cash)")
                    cycle_log.errors.append(f"VIX panic: BUY {d.ticker} bloqué (VIX={vix:.1f})")
                    continue

            filtered_decisions.append(d)

        decisions = filtered_decisions
        if len(decisions) < pre_filter_count:
            blocked = pre_filter_count - len(decisions)
            logger.warning(f"[POST-LLM] {blocked} décision(s) bloquées par les safety filters")

        # ── Si trop de positions ouvertes, bloquer les nouveaux BUY ─────────────
        if n_open_positions >= MAX_OPEN_POSITIONS:
            decisions = [d for d in decisions if d.action != "BUY"]
            logger.info("Max positions atteint — BUY ignorés ce cycle")
        cycle_log.market_summary_fr = market_fr
        cycle_log.market_summary_en = market_en

        if not decisions:
            save_bot_cycle(cycle_log)
            return cycle_log

        # 7. Prix
        prices = {}
        for d in decisions:
            if d.action in ("BUY", "SELL"):
                p = _get_price(d.ticker)
                if p:
                    prices[d.ticker] = p

        # 8. Exécution sur tous les portfolios IA
        all_pf = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).all()

        for decision in decisions:
            if decision.action == "HOLD":
                continue
            price = prices.get(decision.ticker)
            if not price:
                cycle_log.errors.append(f"Prix indisponible: {decision.ticker}")
                continue

            results = []
            for pf in all_pf:
                ok, msg = _execute(db, pf, decision, price, position_multiplier)
                if ok:
                    cycle_log.total_trades += 1
                    logger.info(f"  [{pf.id}] {msg}")
                results.append({"portfolio_id": pf.id, "ok": ok, "msg": msg})

            pos_perf = next((p for p in positions_performance if p["ticker"] == decision.ticker), None)
            cycle_log.decisions.append({
                "ticker":           decision.ticker,
                "action":           decision.action,
                "price":            price,
                "amount_usd":       decision.amount_usd,
                "confidence":       decision.confidence,
                "risk_level":       decision.risk_level,
                "rationale_fr":     decision.rationale_fr,
                "rationale_en":     decision.rationale_en,
                "executed_on":      sum(1 for r in results if r["ok"]),
                "total_portfolios": len(all_pf),
                "position_mult":    position_multiplier,
                "vix":              vix,
                "position_before":  pos_perf,
                "strikes":          strikes_map.get(decision.ticker),
            })

        # 9. Snapshots
        for pf in all_pf:
            _snapshot(db, pf)

        cycle_log.users_processed = len(all_pf)
        db.commit()
        logger.info(f"=== BOT CYCLE END — {cycle_log.total_trades} trades ===")

        # Recalculate portfolio value after execution
        if first_pf:
            try:
                db.refresh(first_pf)
                pos_after = db.query(Position).filter(
                    Position.portfolio_id == first_pf.id, Position.quantity > 0
                ).all()
                equity_after = float(first_pf.cash) + sum(
                    (_get_price(p.ticker) or float(p.avg_price)) * float(p.quantity)
                    for p in pos_after
                )
                cycle_log.portfolio_value_after = round(equity_after, 2)
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Bot cycle error: {e}", exc_info=True)
        cycle_log.errors.append(str(e))
        try:
            if db:
                db.rollback()
        except Exception:
            pass
    finally:
        cycle_log.cycle_duration_s = round(_time.monotonic() - _cycle_start, 1)
        _hard_timeout.cancel()  # cycle terminé normalement — annuler le timer de force-reset
        try:
            if db:
                db.close()
        except Exception:
            pass
        with _bot_running_lock:
            _bot_running = False

    save_bot_cycle(cycle_log)
    return cycle_log


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEDULER — Heartbeat fiable (Railway-proof)
# ═══════════════════════════════════════════════════════════════════════════════

def _should_run_now() -> bool:
    """
    Lun-ven 9h00-22h00 Paris → actions EU + US + crypto
    Weekend → crypto 24/7 (toutes les 30min)
    """
    now = datetime.now(PARIS_TZ)
    if now.weekday() >= 5:
        return True   # weekend : crypto 24/7
    return 9 <= now.hour < 22


def _bot_thread_loop():
    """
    Thread daemon : vérifie toutes les 20 secondes si on est dans une fenêtre
    de déclenchement (:00 ± 2min ou :30 ± 2min, heure Paris).

    Approche HEARTBEAT — 100% fiable, aucun calcul de timing complexe.
    Garantit qu'aucun cycle ne sera manqué même après un redémarrage Railway.

    POURQUOI cette approche ?
    L'ancienne implémentation utilisait _seconds_until_next_half_hour() avec un
    offset -5s qui réveillait le thread trop tôt (minute=29 ou 59). Le
    `else: time.sleep(60)` suivant faisait dépasser la fenêtre, puis le retour
    en haut du while recalculait le PROCHAIN :30 en sautant définitivement le
    cycle courant → le bot ne se déclenchait JAMAIS automatiquement.
    """
    import time
    last_run_key = ""
    logger.info("Bot scheduler démarré — heartbeat 20s, déclenchement :00/:30 Paris")

    while True:
        try:
            now  = datetime.now(PARIS_TZ)

            # Clé unique par fenêtre de déclenchement (une par demi-heure)
            # Ex : "2024-01-15T10:30" pour toute la fenêtre 10:30-10:32
            half    = 0 if now.minute < 30 else 30
            run_key = f"{now.strftime('%Y-%m-%d')}T{now.hour:02d}:{half:02d}"

            # Fenêtre de déclenchement : minutes 0, 1, 2 ou 30, 31, 32
            in_window = now.minute in (0, 1, 2, 30, 31, 32)

            if in_window and run_key != last_run_key:
                last_run_key = run_key
                if _should_run_now():
                    logger.info(
                        f"=== BOT TRIGGER {now.strftime('%A %d/%m %H:%M')} Paris "
                        f"(key={run_key}) ==="
                    )
                    # Lancer le cycle dans un thread séparé pour ne PAS bloquer
                    # le heartbeat — le scheduler doit rester actif pendant le cycle.
                    _cycle_thread = _threading.Thread(
                        target=run_bot_cycle,
                        daemon=True,
                        name=f"bot-cycle-{now.strftime('%H%M')}",
                    )
                    _cycle_thread.start()
                else:
                    logger.info(
                        f"Bot skip — hors fenêtre horaire: {now.strftime('%H:%M')} Paris"
                    )
            else:
                logger.debug(
                    f"Bot heartbeat: {now.strftime('%H:%M:%S')} "
                    f"| in_window={in_window} | last={last_run_key}"
                )

            time.sleep(20)  # vérification toutes les 20s — léger, fiable

        except Exception as e:
            logger.error(f"Bot thread loop error: {e}", exc_info=True)
            import time as _t
            _t.sleep(60)


def start_bot_scheduler():
    """Lance le scheduler heartbeat dans un thread daemon."""
    t = _threading.Thread(
        target=_bot_thread_loop,
        daemon=True,
        name="bot-scheduler",
    )
    t.start()
    logger.info(f"Bot scheduler démarré (thread={t.name}, daemon=True, heartbeat=20s)")
    return t
