"""
market_data.py — source unique pour les données marché partagées.
Avant : COINGECKO_IDS, les horaires de marché et la chaîne de prix étaient
dupliqués dans portfolio.py, market.py et le moteur du bot — trois versions
qui divergeaient. Tout est centralisé ici.

Chaîne de prix : CoinGecko (crypto) → yfinance fast_info → yf.download.
CoinGecko en priorité pour la crypto : yfinance a des bugs cross-ticker
(ex: SOL qui renvoie le prix de BTC → faux +78000%).
"""
from __future__ import annotations

import json
import logging
import threading
import time
import urllib.request
from datetime import datetime, timezone

import pandas as pd
import pytz
import yfinance as yf

logger = logging.getLogger(__name__)

# ── Univers crypto & commodités (24/7) ───────────────────────────────────────
CRYPTO_TICKERS = {
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD",
    "XRP-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "LINK-USD",
}
COMMODITY_TICKERS = {"GC=F", "SI=F", "HG=F", "PL=F", "CL=F", "NG=F", "DX=F"}

COINGECKO_IDS: dict[str, str] = {
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
}

# ── Cache CoinGecko partagé ──────────────────────────────────────────────────
_cg_cache: dict[str, tuple[float, float]] = {}  # ticker → (price, expires_at)
_cg_lock = threading.Lock()
CG_CACHE_TTL = 30  # secondes


def fetch_coingecko_prices(tickers: list[str]) -> dict[str, float]:
    """
    Prix CoinGecko pour une liste de tickers crypto (batch, 1 seul appel API).
    Retourne {ticker: price}. Silencieux en cas d'échec (fallback yfinance).
    """
    now = time.time()
    result: dict[str, float] = {}
    need: dict[str, str] = {}

    with _cg_lock:
        for t in tickers:
            if t in COINGECKO_IDS:
                entry = _cg_cache.get(t)
                if entry and now < entry[1]:
                    result[t] = entry[0]
                else:
                    need[t] = COINGECKO_IDS[t]

    if not need:
        return result

    ids_str = ",".join(need.values())
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ThePnLab/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        expires = now + CG_CACHE_TTL
        with _cg_lock:
            for ticker, cg_id in need.items():
                price = data.get(cg_id, {}).get("usd")
                if price and float(price) > 0:
                    result[ticker] = float(price)
                    _cg_cache[ticker] = (float(price), expires)
        return result
    except Exception as exc:
        logger.warning(f"[CoinGecko] {exc}")
        return result


# ── Horaires de marché ───────────────────────────────────────────────────────
MARKET_HOURS = {
    "US": {"tz": "America/New_York", "open": (9, 30), "close": (16, 0)},
    "EU": {"tz": "Europe/Paris",     "open": (9, 0),  "close": (17, 30)},
}


def get_market_rule(ticker: str) -> str | None:
    """None = 24/7 (crypto, commodités). "US" ou "EU" sinon."""
    if ticker in CRYPTO_TICKERS or ticker in COMMODITY_TICKERS:
        return None
    if "=F" in ticker:
        return None  # futures matières premières : quasi-24/7
    if ticker.endswith((".PA", ".AS", ".DE")):  # Euronext / Xetra
        return "EU"
    return "US"


def check_market_open(ticker: str) -> tuple[bool, str]:
    """
    Le marché du ticker est-il ouvert ? Retourne (ouvert, message).
    - Crypto & commodités : toujours ouvert.
    - US : lun-ven 9h30-16h ET. EU : lun-ven 9h00-17h30 CET.
    """
    rule = get_market_rule(ticker)
    if rule is None:
        return True, "24/7"
    h = MARKET_HOURS[rule]
    tz = pytz.timezone(h["tz"])
    now = datetime.now(tz)
    if now.weekday() >= 5:
        day = "samedi" if now.weekday() == 5 else "dimanche"
        return False, f"Marché fermé ({day}) — rouvre lundi à {h['open'][0]:02d}h{h['open'][1]:02d} ({h['tz']})"
    oh, om = h["open"]
    ch, cm = h["close"]
    open_t = now.replace(hour=oh, minute=om, second=0, microsecond=0)
    close_t = now.replace(hour=ch, minute=cm, second=0, microsecond=0)
    if open_t <= now <= close_t:
        return True, f"Ouvert ({now.strftime('%H:%M')} {h['tz']})"
    if now < open_t:
        return False, f"Marché fermé — ouvre à {oh:02d}h{om:02d} ({h['tz']})"
    return False, f"Marché fermé — a clôturé à {ch:02d}h{cm:02d} ({h['tz']})"


def is_market_open(ticker: str) -> bool:
    return check_market_open(ticker)[0]


# ── Prix temps réel ──────────────────────────────────────────────────────────
_price_cache: dict[str, tuple[float, datetime]] = {}
PRICE_CACHE_TTL = 60  # secondes


def last_price(ticker: str) -> float:
    """
    Prix temps réel avec cache 60s.
    Crypto : CoinGecko → fallback yfinance. Autres : fast_info → download.
    Retourne 0.0 si introuvable.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    cached = _price_cache.get(ticker)
    if cached:
        price, at = cached
        if (now - at).total_seconds() < PRICE_CACHE_TTL and price > 0:
            return price

    # 1. CoinGecko pour la crypto
    if ticker in COINGECKO_IDS:
        cg = fetch_coingecko_prices([ticker])
        price = cg.get(ticker, 0.0)
        if price > 0:
            _price_cache[ticker] = (price, now)
            return price

    # 2. yfinance fast_info
    try:
        p = yf.Ticker(ticker).fast_info.last_price
        if p is not None and float(p) > 0:
            price = float(p)
            _price_cache[ticker] = (price, now)
            return price
    except Exception:
        pass

    # 3. Clôture journalière SANS auto_adjust (évite distorsions leveraged ETFs)
    try:
        df = yf.download(
            ticker, period="5d", interval="1d",
            progress=False, auto_adjust=False, timeout=8,
        )
        if df is None or df.empty:
            return 0.0
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        price = float(df["Close"].dropna().iloc[-1])
        if price > 0:
            _price_cache[ticker] = (price, now)
            return price
        return 0.0
    except Exception:
        return 0.0


def invalidate_price(ticker: str) -> None:
    """Invalide le cache après un ordre — le prochain appel refetch."""
    _price_cache.pop(ticker, None)
