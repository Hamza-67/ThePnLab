"""
overnight.py — traitements quotidiens des dérivés (1x/jour, ~00h15 Paris) :
  1. Financement CFD : chaque position ouverte paie N · 0.08/365 par nuit
  2. Futures : mark-to-market quotidien (cash ± variation vs dernier mark)
  3. Futures : settlement + fermeture à l'échéance

Déclenché par le monitor 10 min (run_key journalier — pas de thread dédié).
"""
from __future__ import annotations

import logging
from datetime import datetime

from app.models.portfolio import Portfolio, Position, Trade
from app.services import margin as mg
from app.services.market_data import last_price
from app.services.timeutils import utcnow

logger = logging.getLogger(__name__)

# run_key du dernier passage — évite de facturer 2x la même nuit
_last_run_day: str = ""


def run_overnight_tasks(db) -> dict:
    """Passe quotidienne sur toutes les positions dérivées ouvertes."""
    stats = {"financed": 0, "marked": 0, "settled": 0}

    positions = db.query(Position).filter(
        Position.instrument_type.in_(["CFD", "FUTURES"]),
        Position.quantity > 0,
    ).all()
    if not positions:
        return stats

    pf_cache: dict[int, Portfolio] = {}

    def _pf(pid: int) -> Portfolio:
        if pid not in pf_cache:
            pf_cache[pid] = db.query(Portfolio).filter(Portfolio.id == pid).one()
        return pf_cache[pid]

    now = utcnow()

    for pos in positions:
        pf  = _pf(pos.portfolio_id)
        qty = float(pos.quantity)
        m   = float(pos.contract_size or 1.0)

        if pos.instrument_type == "CFD":
            # ── Financement overnight : N · taux/365 ─────────────────────────
            try:
                px = last_price(pos.ticker)
            except Exception:
                px = float(pos.avg_price)
            n   = mg.notional(qty, px or float(pos.avg_price), m)
            fin = mg.overnight_financing(n)
            pf.cash = float(pf.cash) - fin
            stats["financed"] += 1
            logger.info(f"[OVERNIGHT] CFD {pos.ticker} pf={pf.id} — financement -${fin:.2f}")

        elif pos.instrument_type == "FUTURES":
            try:
                settle = last_price(pos.ticker)
            except Exception:
                settle = None
            if not settle or settle <= 0:
                continue

            # ── Échéance atteinte → settlement final + fermeture ─────────────
            if pos.expiry_date and now >= pos.expiry_date:
                last_mark = float(pos.last_mark_price or pos.avg_price)
                mtm = mg.mark_to_market(pos.direction, qty, m, settle, last_mark)
                total_pnl = mg.unrealized_pnl(pos.direction, qty, float(pos.avg_price), settle, m)
                pf.cash = float(pf.cash) + mtm + float(pos.margin)
                db.add(Trade(
                    portfolio_id=pos.portfolio_id,
                    ticker=pos.ticker,
                    side="SELL",
                    price=round(settle, 4),
                    quantity=round(qty, 6),
                    profit=round(total_pnl, 2),
                    actor="SYSTEM",
                    rationale=f"SETTLEMENT futures à l'échéance {pos.expiry_date:%Y-%m-%d} — PnL total ${total_pnl:.2f}",
                    instrument_type="FUTURES",
                    direction=pos.direction,
                    leverage=float(pos.leverage),
                ))
                pos.quantity = 0.0
                pos.margin   = 0.0
                stats["settled"] += 1
                logger.info(f"[OVERNIGHT] FUTURES {pos.ticker} pf={pf.id} settled @ {settle:.2f}")

            # ── Sinon : mark-to-market quotidien ─────────────────────────────
            else:
                last_mark = float(pos.last_mark_price or pos.avg_price)
                mtm = mg.mark_to_market(pos.direction, qty, m, settle, last_mark)
                pf.cash = float(pf.cash) + mtm
                pos.last_mark_price = settle
                stats["marked"] += 1
                logger.info(f"[OVERNIGHT] FUTURES {pos.ticker} pf={pf.id} MTM {mtm:+.2f}$ (mark {settle:.2f})")

    db.commit()
    return stats


def maybe_run_overnight(db) -> dict | None:
    """
    À appeler régulièrement (monitor 10 min) : exécute run_overnight_tasks
    une seule fois par jour, dans la fenêtre 00h15-01h00 Paris.

    Fenêtre stricte (pas juste "après 00h15") : le flag _last_run_day est
    en mémoire et perdu à chaque restart Railway — sans fenêtre, un restart
    en journée re-facturerait le financement une 2e fois.
    """
    global _last_run_day
    from app.bot.params import PARIS_TZ

    now_paris = datetime.now(PARIS_TZ)
    day_key = now_paris.strftime("%Y-%m-%d")

    if day_key == _last_run_day:
        return None
    if not (now_paris.hour == 0 and now_paris.minute >= 15):
        return None   # fenêtre 00h15-01h00 uniquement

    _last_run_day = day_key
    stats = run_overnight_tasks(db)
    logger.info(f"[OVERNIGHT] Passe quotidienne {day_key} — {stats}")
    return stats
