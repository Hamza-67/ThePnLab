from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Position, Trade, EquitySnapshot
from app.config import STARTING_CASH, FEE_RATE, SLIPPAGE_BPS
from app.services.market_data import (
    last_price as _last_price,
    check_market_open as _check_market_open,
    invalidate_price as _invalidate_price,
)
from app.services import margin as mg
from app.services.liquidation import check_liquidations
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


def _position_value(p: Position, px: float) -> float:
    """Valeur d'une position : q·p en spot, équité (marge + uPnL) en dérivés."""
    if p.instrument_type in ("CFD", "FUTURES"):
        upnl = mg.unrealized_pnl(
            p.direction, float(p.quantity), float(p.avg_price or 0), px,
            float(p.contract_size or 1.0),
        )
        return mg.position_equity(float(p.margin or 0.0), upnl)
    return px * float(p.quantity)


def _snapshot_equity(db, pf: Portfolio):
    positions = db.query(Position).filter(
        Position.portfolio_id == pf.id, Position.quantity > 0
    ).all()
    pos_val = sum(_position_value(p, _last_price(p.ticker)) for p in positions)
    db.add(EquitySnapshot(
        portfolio_id=pf.id,
        equity=float(pf.cash) + pos_val,
        cash=float(pf.cash),
    ))


def _get_portfolio(db, user_id: int, name: str) -> Portfolio:
    pf = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.name == name
    ).first()
    if not pf:
        raise HTTPException(status_code=404, detail=f"Portfolio {name} introuvable")
    return pf


@router.get("/summary")
def summary(
    portfolio: str = "USER",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pf = _get_portfolio(db, user.id, portfolio)

    # Vérifie les liquidations de CE portfolio avant d'afficher (positions levier)
    try:
        check_liquidations(db, portfolio_id=pf.id)
    except Exception as e:
        logger.warning(f"check_liquidations in summary failed: {e}")

    positions = db.query(Position).filter(
        Position.portfolio_id == pf.id,
        Position.quantity > 0
    ).all()

    pos_list  = []
    pos_value = 0.0
    for p in positions:
        px  = _last_price(p.ticker)
        avg = float(p.avg_price) if p.avg_price else 0
        row = {
            "position_id":     p.id,
            "ticker":          p.ticker,
            "quantity":        round(float(p.quantity), 6),
            "avg_price":       round(avg, 4),
            "last_price":      round(px, 4),
            "instrument_type": p.instrument_type,
            "direction":       p.direction,
            "leverage":        float(p.leverage or 1.0),
        }

        if p.instrument_type in ("CFD", "FUTURES"):
            # Valeur de la position = équité E = marge + uPnL (pas q·p !)
            m_contract = float(p.contract_size or 1.0)
            upnl   = mg.unrealized_pnl(p.direction, float(p.quantity), avg, px, m_contract)
            margin = float(p.margin or 0.0)
            val    = mg.position_equity(margin, upnl)
            row.update({
                "value":             round(val, 2),
                "pnl":               round(upnl, 2),
                "pnl_pct":           round(upnl / margin * 100, 2) if margin > 0 else 0.0,
                "margin":            round(margin, 2),
                "liquidation_price": round(float(p.liquidation_price), 4) if p.liquidation_price else None,
                "expiry_date":       p.expiry_date.isoformat() if p.expiry_date else None,
            })
        else:
            val     = px * float(p.quantity)
            pnl     = (px - avg) * float(p.quantity)
            pnl_pct = ((px - avg) / avg * 100) if avg > 0 else 0.0
            row.update({
                "value":   round(val, 2),
                "pnl":     round(pnl, 2),
                "pnl_pct": round(pnl_pct, 2),
            })

        pos_value += val
        pos_list.append(row)

    # Trier par valeur décroissante
    pos_list.sort(key=lambda x: x["value"], reverse=True)

    equity      = float(pf.cash) + pos_value
    pnl_total   = equity - STARTING_CASH
    pnl_pct_total = (pnl_total / STARTING_CASH * 100) if STARTING_CASH > 0 else 0.0
    return {
        "portfolio":        portfolio,
        "cash":             round(float(pf.cash), 2),
        "positions_value":  round(pos_value, 2),
        "equity":           round(equity, 2),
        "pnl_total":        round(pnl_total, 2),
        "pnl_pct_total":    round(pnl_pct_total, 2),
        "cash_pct":         round(float(pf.cash) / equity * 100, 1) if equity > 0 else 100.0,
        "positions":        pos_list,
    }


class OrderBody(BaseModel):
    ticker: str
    side: str       # BUY (ouvrir) ou SELL (fermer)
    mode: str       # "qty" ou "amount"
    value: float    # nombre d'unités OU montant en $ (dérivés : marge investie)
    portfolio: str = "USER"
    # ── Dérivés (v2) — défauts = comportement spot inchangé ──────────────────
    instrument_type: str = "SPOT"          # SPOT | CFD | FUTURES
    direction: str = "LONG"                # LONG | SHORT (dérivés uniquement)
    leverage: float = 1.0                  # CFD : x2-x20 actions, x2-x5 crypto
    contract_size: float = 1.0             # futures : multiplicateur
    expiry: Optional[str] = None           # futures : ISO date, défaut = prochain trimestre
    position_id: Optional[int] = None      # fermeture ciblée d'une position dérivée


# ═══════════════════════════════════════════════════════════════════════════════
# DÉRIVÉS — ouverture / fermeture (CFD + Futures)
# ═══════════════════════════════════════════════════════════════════════════════

def _open_derivative(db, pf: Portfolio, body: OrderBody, px: float) -> dict:
    """Ouvre une position CFD ou Futures : bloque la marge, fixe le prix de liq."""
    if body.direction not in ("LONG", "SHORT"):
        raise HTTPException(status_code=400, detail="Direction invalide (LONG ou SHORT)")

    slip = SLIPPAGE_BPS / 10000
    # Ouvrir un LONG = acheter (ask), ouvrir un SHORT = vendre (bid)
    exec_price = px * (1 + slip) if body.direction == "LONG" else px * (1 - slip)

    if body.instrument_type == "CFD":
        leverage = float(body.leverage)
        ok, msg = mg.validate_leverage(body.ticker, leverage)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
        contract_size  = 1.0
        expiry_date    = None
        financing_rate = mg.CFD_FINANCING_RATE
    else:  # FUTURES — levier implicite par la marge 10%
        leverage       = round(1 / mg.FUTURES_MARGIN_RATIO, 2)
        contract_size  = max(1.0, float(body.contract_size))
        financing_rate = 0.0
        if body.expiry:
            try:
                expiry_date = datetime.fromisoformat(body.expiry)
            except ValueError:
                raise HTTPException(status_code=400, detail="Format d'échéance invalide (ISO attendu)")
        else:
            expiry_date = mg.next_quarterly_expiry()

    # mode "amount" = marge investie → quantité déduite du notionnel N = marge · L
    if body.mode == "amount":
        if body.value < 10:
            raise HTTPException(status_code=400, detail="Marge minimum : $10")
        qty = (body.value * leverage) / (exec_price * contract_size)
    else:
        qty = float(body.value)
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Quantité invalide")

    n = mg.notional(qty, exec_price, contract_size)
    margin = (mg.initial_margin_cfd(n, leverage) if body.instrument_type == "CFD"
              else mg.initial_margin_futures(n))
    fee = n * FEE_RATE

    if pf.cash < margin + fee:
        raise HTTPException(
            status_code=400,
            detail=f"Cash insuffisant — marge requise : ${margin:.2f} + frais ${fee:.2f}, disponible : ${pf.cash:.2f}"
        )

    liq = mg.liquidation_price(body.direction, exec_price, leverage)

    pos = Position(
        portfolio_id=pf.id,
        ticker=body.ticker,
        quantity=qty,
        avg_price=exec_price,
        instrument_type=body.instrument_type,
        direction=body.direction,
        leverage=leverage,
        margin=margin,
        liquidation_price=liq,
        contract_size=contract_size,
        expiry_date=expiry_date,
        financing_rate=financing_rate,
        last_mark_price=exec_price if body.instrument_type == "FUTURES" else None,
    )
    db.add(pos)
    pf.cash = float(pf.cash) - margin - fee

    db.add(Trade(
        portfolio_id=pf.id,
        ticker=body.ticker,
        side="BUY",
        price=round(exec_price, 4),
        quantity=round(qty, 6),
        profit=0.0,
        actor="USER",
        rationale=f"Ouverture {body.instrument_type} {body.direction} x{leverage:.0f} (marge ${margin:.2f})",
        instrument_type=body.instrument_type,
        direction=body.direction,
        leverage=leverage,
    ))

    return {
        "ok": True,
        "message": (
            f"{body.instrument_type} {body.direction} x{leverage:.0f} ouvert : "
            f"{round(qty, 6)} × {body.ticker} @ ${exec_price:.2f} — "
            f"marge ${margin:.2f}, liquidation à ${liq:.2f}"
        ),
        "margin": round(margin, 2),
        "liquidation_price": round(liq, 4),
    }


def _close_derivative(db, pf: Portfolio, body: OrderBody, px: float) -> dict:
    """Ferme (totalement ou partiellement) une position CFD/Futures."""
    q = db.query(Position).filter(
        Position.portfolio_id == pf.id,
        Position.quantity > 0,
        Position.instrument_type == body.instrument_type,
    )
    if body.position_id:
        pos = q.filter(Position.id == body.position_id).first()
    else:
        pos = q.filter(
            Position.ticker == body.ticker,
            Position.direction == body.direction,
        ).order_by(Position.id.asc()).first()
    if not pos:
        raise HTTPException(status_code=400, detail=f"Aucune position {body.instrument_type} ouverte sur {body.ticker}")

    slip = SLIPPAGE_BPS / 10000
    # Fermer un LONG = vendre (bid), fermer un SHORT = racheter (ask)
    exec_price = px * (1 - slip) if pos.direction == "LONG" else px * (1 + slip)

    total_qty = float(pos.quantity)
    if body.mode == "qty" and 0 < float(body.value) < total_qty:
        qty_close = float(body.value)
    else:
        qty_close = total_qty   # défaut : fermeture totale

    m_contract = float(pos.contract_size or 1.0)
    fraction   = qty_close / total_qty
    margin_out = float(pos.margin) * fraction
    upnl       = mg.unrealized_pnl(pos.direction, qty_close, float(pos.avg_price), exec_price, m_contract)
    fee        = mg.notional(qty_close, exec_price, m_contract) * FEE_RATE
    profit     = upnl - fee

    pf.cash = float(pf.cash) + margin_out + upnl - fee
    pos.quantity = total_qty - qty_close
    pos.margin   = float(pos.margin) - margin_out
    if pos.quantity < 1e-9:
        pos.quantity = 0.0
        pos.margin   = 0.0

    db.add(Trade(
        portfolio_id=pf.id,
        ticker=pos.ticker,
        side="SELL",
        price=round(exec_price, 4),
        quantity=round(qty_close, 6),
        profit=round(profit, 2),
        actor="USER",
        rationale=f"Fermeture {pos.instrument_type} {pos.direction} x{float(pos.leverage):.0f} — PnL ${profit:.2f}",
        instrument_type=pos.instrument_type,
        direction=pos.direction,
        leverage=float(pos.leverage),
    ))

    return {
        "ok": True,
        "message": (
            f"{pos.instrument_type} {pos.direction} fermé : {round(qty_close, 6)} × {pos.ticker} "
            f"@ ${exec_price:.2f} — PnL ${profit:.2f}"
        ),
        "pnl": round(profit, 2),
    }


@router.post("/order")
def place_order(
    body: OrderBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    is_open, market_msg = _check_market_open(body.ticker)
    if not is_open:
        raise HTTPException(status_code=400, detail=f"⏰ {market_msg}")

    pf = _get_portfolio(db, user.id, body.portfolio)

    px = _last_price(body.ticker)
    if px <= 0:
        raise HTTPException(status_code=400, detail="Prix introuvable pour ce ticker")

    # Invalide le cache pour ce ticker après un ordre
    # → le prochain appel à summary récupère un prix frais
    _invalidate_price(body.ticker)

    # ── Branche dérivés (CFD / Futures) ───────────────────────────────────────
    if body.instrument_type in ("CFD", "FUTURES"):
        if body.portfolio != "USER":
            # Le bot IA reste spot-only — ses calculs de perf supposent du spot
            raise HTTPException(status_code=400, detail="Les dérivés ne sont disponibles que sur le portfolio USER")
        if body.side == "BUY":
            result = _open_derivative(db, pf, body, px)
        else:
            result = _close_derivative(db, pf, body, px)
        _snapshot_equity(db, pf)
        db.commit()
        return result

    if body.instrument_type != "SPOT":
        raise HTTPException(status_code=400, detail="Type d'instrument invalide (SPOT, CFD ou FUTURES)")

    if body.mode == "amount":
        if body.value <= 0:
            raise HTTPException(status_code=400, detail="Montant invalide")
        if body.value < 1:
            raise HTTPException(status_code=400, detail="Montant minimum : $1")
        qty = body.value / px
        if qty < 0.00001:
            raise HTTPException(status_code=400, detail=f"Montant trop faible pour ce prix (${px:.2f})")
    else:
        qty = float(body.value)
        if qty <= 0:
            raise HTTPException(status_code=400, detail="Quantité invalide")

    slip       = SLIPPAGE_BPS / 10000
    exec_price = px * (1 + slip) if body.side == "BUY" else px * (1 - slip)
    fee        = exec_price * qty * FEE_RATE
    total_cost = exec_price * qty + fee

    if body.side == "BUY":
        if pf.cash < total_cost:
            raise HTTPException(
                status_code=400,
                detail=f"Cash insuffisant — disponible : ${pf.cash:.2f}, nécessaire : ${total_cost:.2f}"
            )

        pos = db.query(Position).filter(
            Position.portfolio_id == pf.id,
            Position.ticker == body.ticker,
            Position.instrument_type == "SPOT",
        ).first()

        if pos:
            new_qty       = pos.quantity + qty
            pos.avg_price = ((pos.avg_price * pos.quantity) + (exec_price * qty)) / new_qty
            pos.quantity  = new_qty
        else:
            db.add(Position(
                portfolio_id=pf.id,
                ticker=body.ticker,
                quantity=qty,
                avg_price=exec_price,
            ))

        pf.cash -= total_cost
        profit   = 0.0

    else:  # SELL
        pos = db.query(Position).filter(
            Position.portfolio_id == pf.id,
            Position.ticker == body.ticker,
            Position.instrument_type == "SPOT",
        ).first()
        if not pos or pos.quantity < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Position insuffisante — tu as {round(pos.quantity, 6) if pos else 0} unités"
            )
        profit       = (exec_price - pos.avg_price) * qty - fee
        pos.quantity -= qty
        pf.cash      += exec_price * qty - fee

    db.add(Trade(
        portfolio_id=pf.id,
        ticker=body.ticker,
        side=body.side,
        price=round(exec_price, 4),
        quantity=round(qty, 6),
        profit=round(profit if body.side == "SELL" else 0.0, 2),
        actor="USER",
        rationale=f"Ordre manuel ({body.mode}={body.value})",
    ))

    _snapshot_equity(db, pf)
    db.commit()
    return {
        "ok": True,
        "message": f"{body.side} {round(qty, 6)} × {body.ticker} @ ${exec_price:.2f} — coût total : ${total_cost:.2f}"
    }


@router.get("/trades")
def get_trades(
    portfolio: str = "USER",
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pf = _get_portfolio(db, user.id, portfolio)
    trades = db.query(Trade).filter(
        Trade.portfolio_id == pf.id
    ).order_by(Trade.id.desc()).limit(limit).all()
    return [
        {
            "id":         t.id,
            "ticker":     t.ticker,
            "side":       t.side,
            "price":      t.price,
            "quantity":   t.quantity,
            "profit":     t.profit,
            "actor":      t.actor,
            "created_at": t.created_at.isoformat(),
        }
        for t in trades
    ]


@router.get("/equity")
def get_equity(
    portfolio: str = "USER",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pf = _get_portfolio(db, user.id, portfolio)

    # ── 1. Fetch all snapshots ────────────────────────────────────────────────
    snaps = db.query(EquitySnapshot).filter(
        EquitySnapshot.portfolio_id == pf.id
    ).order_by(EquitySnapshot.id.asc()).limit(2000).all()

    # ── 2. Deduplicate: keep latest snapshot per calendar day ─────────────────
    day_map: dict[str, dict] = {}
    for s in snaps:
        day = s.created_at.strftime("%Y-%m-%d")
        day_map[day] = {
            "time":   s.created_at.isoformat(),
            "equity": round(float(s.equity), 2),
            "cash":   round(float(s.cash),   2),
        }

    # ── 3. Compute live current equity and upsert as today ────────────────────
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        positions = db.query(Position).filter(
            Position.portfolio_id == pf.id,
            Position.quantity > 0
        ).all()
        live_pos_val = sum(_position_value(p, _last_price(p.ticker)) for p in positions)
        live_equity  = round(float(pf.cash) + live_pos_val, 2)
    except Exception:
        live_equity = round(float(pf.cash), 2)

    day_map[today_str] = {
        "time":   datetime.now(timezone.utc).isoformat(),
        "equity": live_equity,
        "cash":   round(float(pf.cash), 2),
    }

    # ── 4. Sort chronologically ───────────────────────────────────────────────
    sorted_days = sorted(day_map.keys())

    # ── 5. Inject $10k anchor one day before the first real data point ────────
    result: list[dict] = []
    if sorted_days:
        first_dt  = datetime.strptime(sorted_days[0], "%Y-%m-%d")
        anchor_dt = first_dt - timedelta(days=1)
        anchor_str = anchor_dt.strftime("%Y-%m-%d")
        if anchor_str not in day_map:
            result.append({
                "time":   anchor_str + "T00:00:00",
                "equity": 10000.0,
                "cash":   10000.0,
            })

    result += [day_map[d] for d in sorted_days]

    # ── 6. If nothing at all, return a flat $10k point for today ─────────────
    if not result:
        result = [{"time": today_str + "T00:00:00", "equity": 10000.0, "cash": 10000.0}]

    return result


@router.get("/audit")
def audit_portfolio(
    portfolio: str = "AI",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Audit complet du portfolio — reconstruit le cash running trade par trade.
    Permet de vérifier si la perte affichée est cohérente avec les trades enregistrés.
    """
    from app.config import STARTING_CASH as SC
    pf = _get_portfolio(db, user.id, portfolio)

    all_trades = db.query(Trade).filter(
        Trade.portfolio_id == pf.id
    ).order_by(Trade.id.asc()).all()

    running_cash = float(SC)
    trade_log = []
    for t in all_trades:
        price = float(t.price or 0)
        qty   = float(t.quantity or 0)
        profit= float(t.profit or 0)
        cost  = price * qty
        fee   = cost * float(FEE_RATE)
        if t.side == "BUY":
            cash_delta = -(cost + fee)
        else:
            revenue    = price * qty
            fee        = revenue * float(FEE_RATE)
            cash_delta = revenue - fee
        running_cash += cash_delta
        trade_log.append({
            "id":          t.id,
            "ticker":      t.ticker,
            "side":        t.side,
            "price":       round(price, 4),
            "qty":         round(qty, 6),
            "cost_or_rev": round(abs(cash_delta), 2),
            "cash_delta":  round(cash_delta, 2),
            "cash_after":  round(running_cash, 2),
            "profit":      round(profit, 2),
            "actor":       t.actor,
            "date":        t.created_at.isoformat() if t.created_at else "",
        })

    # Positions ouvertes actuelles
    positions = db.query(Position).filter(
        Position.portfolio_id == pf.id, Position.quantity > 0
    ).all()
    open_positions = []
    pos_live_value = 0.0
    for p in positions:
        px  = _last_price(p.ticker)
        val = px * float(p.quantity)
        avg = float(p.avg_price or 0)
        unreal_pnl = (px - avg) * float(p.quantity)
        pos_live_value += val
        open_positions.append({
            "ticker":      p.ticker,
            "qty":         round(float(p.quantity), 6),
            "avg_price":   round(avg, 4),
            "last_price":  round(px, 4),
            "value":       round(val, 2),
            "unrealized_pnl": round(unreal_pnl, 2),
            "unrealized_pct": round((unreal_pnl / (avg * float(p.quantity)) * 100) if avg > 0 else 0, 2),
        })

    db_cash      = round(float(pf.cash), 2)
    live_equity  = round(db_cash + pos_live_value, 2)
    expected_pnl = round(live_equity - float(SC), 2)
    audit_cash_pnl = round(running_cash - float(SC), 2)

    return {
        "portfolio_name":   portfolio,
        "starting_cash":    float(SC),
        "db_cash":          db_cash,
        "pos_live_value":   round(pos_live_value, 2),
        "live_equity":      live_equity,
        "displayed_pnl":    expected_pnl,
        "audit_cash_pnl":   audit_cash_pnl,         # PnL reconstruit trade par trade
        "discrepancy":      round(db_cash - running_cash, 2),  # 0 = pas de bug
        "total_trades":     len(all_trades),
        "open_positions":   open_positions,
        "trade_log":        trade_log,               # historique complet avec cash running
    }


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    portfolios = db.query(Portfolio).filter(Portfolio.name == "USER").all()
    if not portfolios:
        return []

    # ── Bulk-load users en une seule query (évite N+1) ───────────────────────
    user_ids  = [pf.user_id for pf in portfolios]
    users_map = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()
    }

    # ── Bulk-load toutes les positions ouvertes en une seule query ───────────
    pf_ids = [pf.id for pf in portfolios]
    all_positions = db.query(Position).filter(
        Position.portfolio_id.in_(pf_ids),
        Position.quantity > 0,
    ).all()
    pos_by_pf: dict[int, list] = {}
    for p in all_positions:
        pos_by_pf.setdefault(p.portfolio_id, []).append(p)

    rows = []
    for pf in portfolios:
        user = users_map.get(pf.user_id)
        if not user:
            continue
        positions = pos_by_pf.get(pf.id, [])
        # _last_price utilise un cache 60s — 1 seul appel réseau par ticker unique
        pos_val = sum(_position_value(p, _last_price(p.ticker)) for p in positions)
        equity  = float(pf.cash) + pos_val
        pnl     = equity - STARTING_CASH
        pnl_pct = (pnl / STARTING_CASH * 100) if STARTING_CASH > 0 else 0.0
        rows.append({
            "user_id": user.id,
            "name":    user.name,
            "school":  user.school or "—",
            "equity":  round(equity, 2),
            "pnl":     round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
        })
    rows.sort(key=lambda x: x["equity"], reverse=True)
    return rows


@router.post("/reset")
def reset_portfolio(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    for pf_name in ["USER", "AI"]:
        pf = db.query(Portfolio).filter(
            Portfolio.user_id == user.id,
            Portfolio.name == pf_name
        ).first()
        if not pf:
            continue
        db.query(Position).filter(Position.portfolio_id == pf.id).delete()
        db.query(Trade).filter(Trade.portfolio_id == pf.id).delete()
        db.query(EquitySnapshot).filter(EquitySnapshot.portfolio_id == pf.id).delete()
        pf.cash = STARTING_CASH
    db.commit()
    return {"ok": True, "message": "Portfolio réinitialisé — capital remis à $10 000"}
