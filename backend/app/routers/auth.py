from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User
from app.models.portfolio import Portfolio, Trade
from app.models.waitlist import WaitlistEntry
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.config import STARTING_CASH

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupBody(BaseModel):
    email: EmailStr
    name: str
    school: str = ""
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    school: str


class WaitlistBody(BaseModel):
    email: EmailStr
    source: str = "landing"


@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    if db.query(User).filter(User.name == body.name.strip()).first():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")

    try:
        ph = hash_password(body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        user = User(email=email, name=body.name.strip(), school=body.school.strip(), password_hash=ph)
        db.add(user)
        db.flush()

        db.add(Portfolio(user_id=user.id, name="USER", cash=STARTING_CASH))
        db.add(Portfolio(user_id=user.id, name="AI",   cash=STARTING_CASH))
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de la création du compte — réessaie.")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user_id=user.id, name=user.name, school=user.school or "")


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username.strip().lower()).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user_id=user.id, name=user.name, school=user.school or "")


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "name": user.name, "email": user.email, "school": user.school}


@router.delete("/me")
def delete_account(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.models.portfolio import Position, Trade, EquitySnapshot
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user.id).all()
    for pf in portfolios:
        db.query(EquitySnapshot).filter(EquitySnapshot.portfolio_id == pf.id).delete()
        db.query(Trade).filter(Trade.portfolio_id == pf.id).delete()
        db.query(Position).filter(Position.portfolio_id == pf.id).delete()
    db.query(Portfolio).filter(Portfolio.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "Compte supprimé définitivement"}


# ── Waitlist — collecte d'emails pour lancement commercial ───────────────────
@router.post("/waitlist")
def join_waitlist(body: WaitlistBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return {"ok": True, "message": "Tu es déjà sur la liste — on te contacte bientôt 🚀"}
    db.add(WaitlistEntry(email=email, source=body.source))
    db.commit()
    return {"ok": True, "message": "Bienvenue sur la liste ! Tu seras parmi les premiers informés. 🎉"}


# ── Profil public utilisateur ────────────────────────────────────────────────
@router.get("/users/profile/{user_id}")
def get_public_profile(user_id: int, db: Session = Depends(get_db)):
    """Public profile — no auth required. Never exposes email."""
    from app.models.portfolio import Portfolio, Trade, EquitySnapshot, Position

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    # Portfolio stats
    portfolio = db.query(Portfolio).filter(
        Portfolio.user_id == user_id,
        Portfolio.name == "USER"
    ).first()

    equity = 10000.0
    cash = 10000.0
    pnl = 0.0
    win_rate = 0.0
    total_trades = 0

    if portfolio:
        cash = float(portfolio.cash)
        # Approximate equity from last snapshot
        last_snap = db.query(EquitySnapshot).filter(
            EquitySnapshot.portfolio_id == portfolio.id
        ).order_by(EquitySnapshot.id.desc()).first()
        if last_snap:
            equity = float(last_snap.equity)
        else:
            equity = cash

        # Trades stats
        all_trades = db.query(Trade).filter(
            Trade.portfolio_id == portfolio.id,
            Trade.actor == "USER"
        ).all()
        total_trades = len(all_trades)
        sells = [t for t in all_trades if t.side == "SELL"]
        if sells:
            pnl = sum(float(t.profit) for t in sells)
            wins = [t for t in sells if float(t.profit) > 0]
            win_rate = round(len(wins) / len(sells) * 100, 1)

    # Equity curve (last 30 snapshots)
    equity_curve = []
    if portfolio:
        snaps = db.query(EquitySnapshot).filter(
            EquitySnapshot.portfolio_id == portfolio.id
        ).order_by(EquitySnapshot.id.desc()).limit(30).all()
        equity_curve = [{"equity": float(s.equity), "date": str(s.created_at)[:10]} for s in reversed(snaps)]

    # Leaderboard rank — version optimisée (1 query au lieu de N queries)
    from sqlalchemy import func
    all_portfolios = db.query(Portfolio).filter(Portfolio.name == "USER").all()
    # Récupère le dernier snapshot de chaque portfolio en une seule query (JOIN)
    _max_snap_subq = (
        db.query(
            EquitySnapshot.portfolio_id,
            func.max(EquitySnapshot.id).label("max_id"),
        )
        .group_by(EquitySnapshot.portfolio_id)
        .subquery()
    )
    _latest_snaps = {
        row.portfolio_id: float(row.equity)
        for row in db.query(EquitySnapshot).join(
            _max_snap_subq, EquitySnapshot.id == _max_snap_subq.c.max_id
        ).all()
    }
    ranked = [
        (p.user_id, _latest_snaps.get(p.id, float(p.cash)))
        for p in all_portfolios
    ]
    ranked.sort(key=lambda x: x[1], reverse=True)
    rank = next((i+1 for i, (uid, _) in enumerate(ranked) if uid == user_id), None)

    return {
        "id": user.id,
        "name": user.name,
        "school": user.school or "",
        "joined": str(user.created_at)[:10] if user.created_at else "",
        "equity": round(equity, 2),
        "cash": round(cash, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round((equity - 10000) / 10000 * 100, 2),
        "win_rate": win_rate,
        "total_trades": total_trades,
        "rank": rank,
        "total_users": len(ranked),
        "equity_curve": equity_curve,
    }


# ── Stats publiques — pour la landing page ───────────────────────────────────
@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    user_count    = db.query(User).count()
    trade_count   = db.query(Trade).count()
    waitlist_count = db.query(WaitlistEntry).count()
    return {
        "users":     user_count,
        "trades":    trade_count,
        "waitlist":  waitlist_count,
    }
