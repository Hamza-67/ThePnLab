"""
liquidation.py — vérifie et exécute les liquidations des positions à levier.

Une position CFD/Futures est liquidée quand le prix franchit son
liquidation_price (calculé à l'ouverture). Le broker ferme au prix de liq :
l'utilisateur récupère l'équité résiduelle (= maintenance margin, 0.5·M).

Appelé :
  - toutes les 10 min par le monitor TP/SL (tous les utilisateurs)
  - à chaque GET /api/portfolio/summary (positions de l'utilisateur courant)
"""
from __future__ import annotations

import logging

from app.models.portfolio import Portfolio, Position, Trade
from app.services import margin as mg
from app.services.market_data import last_price
from app.config import FEE_RATE

logger = logging.getLogger(__name__)


def _liquidate_position(db, pos: Position, mark: float) -> dict:
    """Ferme une position liquidée au prix de liquidation. Retourne le récap."""
    pf = db.query(Portfolio).filter(Portfolio.id == pos.portfolio_id).one()

    liq_price = float(pos.liquidation_price)
    qty       = float(pos.quantity)
    m         = float(pos.contract_size or 1.0)
    entry     = float(pos.avg_price)

    # Fermeture AU prix de liquidation (pas au mark) — c'est là que le broker coupe
    upnl    = mg.unrealized_pnl(pos.direction, qty, entry, liq_price, m)
    equity  = mg.position_equity(float(pos.margin), upnl)   # ≈ 0.5·M par construction
    fee     = mg.notional(qty, liq_price, m) * float(FEE_RATE)
    payout  = max(0.0, equity - fee)

    pf.cash = float(pf.cash) + payout
    loss    = payout - float(pos.margin)

    db.add(Trade(
        portfolio_id=pos.portfolio_id,
        ticker=pos.ticker,
        side="SELL",
        price=round(liq_price, 4),
        quantity=round(qty, 6),
        profit=round(loss, 2),
        actor="SYSTEM",
        rationale=(
            f"LIQUIDATION {pos.instrument_type} {pos.direction} x{pos.leverage:.0f} — "
            f"prix {mark:.2f} a franchi le seuil {liq_price:.2f}"
        ),
        instrument_type=pos.instrument_type,
        direction=pos.direction,
        leverage=float(pos.leverage),
    ))

    pos.quantity = 0.0
    pos.margin   = 0.0

    logger.warning(
        f"[LIQUIDATION pf={pf.id}] {pos.ticker} {pos.direction} x{pos.leverage:.0f} "
        f"@ {liq_price:.2f} — perte {loss:.2f}$, récupéré {payout:.2f}$"
    )
    return {"ticker": pos.ticker, "direction": pos.direction, "loss": round(loss, 2)}


def check_liquidations(db, portfolio_id: int | None = None) -> list[dict]:
    """
    Passe en revue les positions à levier ouvertes et liquide celles dont
    le prix a franchi liquidation_price. Retourne la liste des liquidations.
    """
    q = db.query(Position).filter(
        Position.instrument_type.in_(["CFD", "FUTURES"]),
        Position.quantity > 0,
        Position.liquidation_price.isnot(None),
    )
    if portfolio_id is not None:
        q = q.filter(Position.portfolio_id == portfolio_id)

    liquidated = []
    for pos in q.all():
        try:
            mark = last_price(pos.ticker)
        except Exception:
            continue
        if not mark or mark <= 0:
            continue
        if mg.is_liquidated(pos.direction, mark, float(pos.liquidation_price)):
            liquidated.append(_liquidate_position(db, pos, mark))

    if liquidated:
        db.commit()
    return liquidated
