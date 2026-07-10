"""
execution.py — exécution des trades du bot (BUY/SELL), snapshots, reset.
Sizing basé sur la confiance, réserve de cash, sanity checks avant exécution.
"""
from __future__ import annotations

import logging

from app.models.portfolio import Portfolio, Position, Trade, EquitySnapshot, TradeFeature
from app.config import FEE_RATE, SLIPPAGE_BPS
from app.bot.brain import BotDecision
from app.bot.params import (
    BOT_ACTOR, BOT_PORTFOLIO_NAME,
    MAX_PCT_HIGH, MAX_PCT_MEDIUM, MAX_PCT_LOW, MIN_CASH_RESERVE,
)
from app.bot.pricing import _get_price, _sanity_check_exec_price

logger = logging.getLogger(__name__)


def _max_pct_for_confidence(confidence: str) -> float:
    """Retourne le % max du portfolio selon le niveau de confiance."""
    if confidence == "HIGH":
        return MAX_PCT_HIGH
    if confidence == "MEDIUM":
        return MAX_PCT_MEDIUM
    return MAX_PCT_LOW


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


def _execute(
    db,
    portfolio: Portfolio,
    decision: BotDecision,
    price: float,
    position_multiplier: float,
    features: dict | None = None,
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
            pos = Position(portfolio_id=portfolio.id, ticker=decision.ticker, quantity=0.0, avg_price=0.0)
            db.add(pos)
            db.flush()

        new_qty = float(pos.quantity) + qty
        pos.avg_price = (
            (float(pos.avg_price) * float(pos.quantity) + exec_price * qty) / new_qty
            if float(pos.quantity) > 0 else exec_price
        )
        pos.quantity  = new_qty
        portfolio.cash = float(portfolio.cash) - total

        trade = Trade(
            portfolio_id=portfolio.id,
            ticker=decision.ticker,
            side="BUY",
            price=round(exec_price, 4),
            quantity=round(qty, 6),
            profit=0.0,
            actor=BOT_ACTOR,
            rationale=decision.rationale_fr,
        )
        db.add(trade)

        # ── Feature logging (dataset XGBoost) — capturé au moment du BUY ─────
        if features:
            db.flush()  # obtenir trade.id
            db.add(TradeFeature(trade_id=trade.id, ticker=decision.ticker, **features))

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
