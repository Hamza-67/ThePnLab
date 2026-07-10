"""
margin.py — source unique des maths de marge (CFD + Futures).

Conventions :
  s = +1 (LONG) / -1 (SHORT)
  N = notionnel = q · p0 (CFD) ou q · m · p0 (futures, m = contract_size)
  M = marge initiale = N / L (CFD) ou FUTURES_MARGIN_RATIO · N (futures)
  MM = maintenance = MAINTENANCE_MARGIN_RATIO · M
  Équité position : E = M + uPnL — liquidée quand E <= MM

Le frontend a un miroir de ces formules dans src/lib/margin.js
(preview live marge + prix liq dans OrderPanel) — garder les deux synchros.
"""
from __future__ import annotations

import os

# ── Paramètres (overridables par env) ──────────────────────────────────────────
MAINTENANCE_MARGIN_RATIO = float(os.getenv("MAINTENANCE_MARGIN_RATIO", "0.5"))
CFD_FINANCING_RATE       = float(os.getenv("CFD_FINANCING_RATE", "0.08"))   # annuel
FUTURES_MARGIN_RATIO     = float(os.getenv("FUTURES_MARGIN_RATIO", "0.10"))

# Caps de levier par catégorie
LEVERAGE_MIN        = 2
LEVERAGE_MAX_STOCK  = 20   # actions + ETF classiques
LEVERAGE_MAX_CRYPTO = 5


def _sign(direction: str) -> int:
    return 1 if direction == "LONG" else -1


# ── Notionnel & marges ─────────────────────────────────────────────────────────

def notional(qty: float, price: float, contract_size: float = 1.0) -> float:
    return qty * contract_size * price


def initial_margin_cfd(notional: float, leverage: float) -> float:
    return notional / leverage


def initial_margin_futures(notional: float) -> float:
    return notional * FUTURES_MARGIN_RATIO


def maintenance_margin(initial_margin: float) -> float:
    return initial_margin * MAINTENANCE_MARGIN_RATIO


# ── P&L & équité ───────────────────────────────────────────────────────────────

def unrealized_pnl(direction: str, qty: float, entry: float, price: float,
                   contract_size: float = 1.0) -> float:
    return _sign(direction) * qty * contract_size * (price - entry)


def position_equity(margin: float, upnl: float) -> float:
    return margin + upnl


# ── Liquidation ────────────────────────────────────────────────────────────────

def liquidation_price(direction: str, entry: float, leverage: float,
                      mm_ratio: float = MAINTENANCE_MARGIN_RATIO) -> float:
    """
    Prix auquel E = MM exactement.
    Long  : p0 · (1 − (1−mm)/L)
    Short : p0 · (1 + (1−mm)/L)
    """
    move = (1 - mm_ratio) / leverage
    if direction == "LONG":
        return entry * (1 - move)
    return entry * (1 + move)


def is_liquidated(direction: str, mark_price: float, liquidation_price: float) -> bool:
    if direction == "LONG":
        return mark_price <= liquidation_price
    return mark_price >= liquidation_price


# ── Financement overnight (CFD) ────────────────────────────────────────────────

def overnight_financing(notional: float, nights: int = 1) -> float:
    """Frais débités du cash pour chaque nuit où un CFD reste ouvert."""
    return notional * CFD_FINANCING_RATE / 365 * nights


# ── Futures : mark-to-market quotidien ─────────────────────────────────────────

def mark_to_market(direction: str, qty: float, contract_size: float,
                   settle: float, last_mark: float) -> float:
    """Variation de cash au settlement quotidien : s · q · m · (p_settle − last_mark)."""
    return _sign(direction) * qty * contract_size * (settle - last_mark)


# ── Échéances futures (trimestrielles) ─────────────────────────────────────────

def next_quarterly_expiry(from_date=None):
    """3e vendredi de mars/juin/sept/déc — première échéance strictement future."""
    from datetime import datetime, timedelta
    from app.services.timeutils import utcnow

    now = from_date or utcnow()
    for year in (now.year, now.year + 1):
        for month in (3, 6, 9, 12):
            d = datetime(year, month, 1)
            # 3e vendredi du mois
            offset = (4 - d.weekday()) % 7   # vendredi = 4
            third_friday = d + timedelta(days=offset + 14)
            expiry = third_friday.replace(hour=22, minute=0)  # ~clôture US
            if expiry > now:
                return expiry
    raise RuntimeError("unreachable")


# ── Validation levier ──────────────────────────────────────────────────────────

def validate_leverage(ticker: str, leverage: float) -> tuple[bool, str]:
    """
    Caps : x2-x20 actions/ETF, x2-x5 crypto.
    ETF leveraged (TQQQ, SOXL…) exclus — pas de levier sur du levier.
    """
    from app.bot.params import CRYPTO_TICKERS, LEVERAGED_ETFS

    if ticker in LEVERAGED_ETFS:
        return False, f"{ticker} est un ETF leveraged — CFD non disponible (levier sur levier)"

    if leverage < LEVERAGE_MIN:
        return False, f"Levier minimum : x{LEVERAGE_MIN}"

    cap = LEVERAGE_MAX_CRYPTO if ticker in CRYPTO_TICKERS else LEVERAGE_MAX_STOCK
    if leverage > cap:
        return False, f"Levier maximum pour {ticker} : x{cap}"

    return True, ""
