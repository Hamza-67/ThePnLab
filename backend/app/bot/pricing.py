"""
pricing.py — fetch + validation des prix d'exécution du bot.
Chaîne : cache intra-cycle → CoinGecko (crypto) → yfinance fast_info → download.
Deux défenses contre les prix corrompus (glitch yfinance, cross-ticker, stale) :
  1. _validate_price  — mouvement journalier vs prev_close + cross-check intraday 5m
  2. _sanity_check_exec_price — ratio exec/avg_price (données internes DB)
"""
from __future__ import annotations

import logging
import time as _time
from typing import Optional

import yfinance as yf
import pandas as pd

from app.bot.params import CRYPTO_TICKERS, LEVERAGED_ETFS, MAX_DAILY_MOVE
from app.services.market_data import COINGECKO_IDS, fetch_coingecko_prices

logger = logging.getLogger(__name__)

# ── Cache prix intra-cycle ────────────────────────────────────────────────────
_price_cache_cycle: dict[str, tuple[float, float]] = {}  # ticker -> (price, monotonic_time)
_PRICE_CACHE_CYCLE_TTL = 300  # 5 min — couvre la durée totale d'un cycle


def clear_price_cache() -> None:
    _price_cache_cycle.clear()


def _price_round(val: float) -> float:
    """Précision adaptative selon l'ordre de grandeur du prix."""
    if val < 0.01:  return round(val, 8)
    if val < 1.0:   return round(val, 6)
    if val < 100.0: return round(val, 4)
    return round(val, 2)


def _price_category(ticker: str) -> str:
    if ticker in LEVERAGED_ETFS:   return "leveraged"
    if ticker in CRYPTO_TICKERS:   return "crypto"
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
    max_move = MAX_DAILY_MOVE[_price_category(ticker)]
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
    if ticker in COINGECKO_IDS:
        cg_prices = fetch_coingecko_prices([ticker])
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
    if ticker in LEVERAGED_ETFS:
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
