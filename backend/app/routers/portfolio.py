from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Position, Trade, EquitySnapshot
from app.config import STARTING_CASH, FEE_RATE, SLIPPAGE_BPS
import yfinance as yf
import pandas as pd
from datetime import datetime, timezone, timedelta
import pytz
import urllib.request
import json as _json
import threading as _threading
import time as _time
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# ── Crypto & commodités : 24/7 ──────────────────────────────────────────────
CRYPTO_TICKERS = {
    "BTC-USD","ETH-USD","SOL-USD","BNB-USD","ADA-USD",
    "XRP-USD","DOGE-USD","AVAX-USD","DOT-USD","LINK-USD",
}
COMMODITY_TICKERS = {"GC=F","SI=F","HG=F","PL=F","CL=F","NG=F","DX=F"}

# ── CoinGecko — source fiable pour les prix crypto dans le portfolio ──────────
# Évite les bugs cross-ticker yfinance (ex: SOL → prix de BTC $73,925 → faux +78000%)
_CG_IDS: dict[str, str] = {
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
_CG_PRICE_CACHE: dict[str, tuple[float, float]] = {}  # ticker → (price, expires_at)
_CG_CACHE_LOCK = _threading.Lock()
_CG_CACHE_TTL  = 30  # secondes


def _fetch_coingecko_portfolio(tickers: list[str]) -> dict[str, float]:
    """
    Récupère les prix CoinGecko pour les tickers crypto du portfolio.
    Retourne {ticker: price}. Silencieux en cas d'échec (fallback yfinance).
    """
    now = _time.time()
    result: dict[str, float] = {}
    need: dict[str, str] = {}

    # Check cache
    with _CG_CACHE_LOCK:
        for t in tickers:
            if t in _CG_IDS:
                entry = _CG_PRICE_CACHE.get(t)
                if entry and now < entry[1]:
                    result[t] = entry[0]
                else:
                    need[t] = _CG_IDS[t]

    if not need:
        return result

    ids_str = ",".join(need.values())
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids_str}&vs_currencies=usd"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ThePnLab/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = _json.loads(resp.read())
        expires = now + _CG_CACHE_TTL
        with _CG_CACHE_LOCK:
            for ticker, cg_id in need.items():
                price = data.get(cg_id, {}).get("usd")
                if price and float(price) > 0:
                    result[ticker] = float(price)
                    _CG_PRICE_CACHE[ticker] = (float(price), expires)
        return result
    except Exception as exc:
        logger.warning(f"[CoinGecko portfolio] {exc}")
        return result

# ── Horaires par exchange ────────────────────────────────────────────────────
MARKET_HOURS = {
    "US": {"tz": "America/New_York", "open": (9, 30),  "close": (16, 0)},
    "EU": {"tz": "Europe/Paris",     "open": (9, 0),   "close": (17, 30)},
    # ETF européens cotés sur Euronext Amsterdam / Xetra
    "EU_ETF": {"tz": "Europe/Paris", "open": (9, 0),   "close": (17, 30)},
}

def _get_market_rule(ticker: str) -> str | None:
    """
    Détermine le marché d'un ticker.
    None = 24/7 (crypto, commodités).
    "US" = NYSE / NASDAQ / AMEX.
    "EU" = Euronext Paris / Amsterdam / Xetra.
    """
    if ticker in CRYPTO_TICKERS:
        return None   # 24/7
    if ticker in COMMODITY_TICKERS:
        return None   # marchés à terme : quasi-24/7
    if ticker.endswith(".PA"):  # Euronext Paris
        return "EU"
    if ticker.endswith(".AS"):  # Euronext Amsterdam
        return "EU"
    if ticker.endswith(".DE"):  # Xetra
        return "EU"
    # ETF américains (AMEX/NASDAQ/NYSE)
    return "US"

# Cache simple en mémoire pour éviter les appels yfinance multiples
# dans le même request (summary appelle _last_price pour chaque position)
_price_cache: dict[str, tuple[float, datetime]] = {}
_CACHE_TTL_SECONDS = 60  # Prix valable 60s


def _check_market_open(ticker: str) -> tuple[bool, str]:
    """
    Vérifie si le marché du ticker est ouvert.
    - Crypto & commodités : toujours ouvert (24/7).
    - Actions US (NYSE/NASDAQ/AMEX) : lun-ven 9h30-16h ET.
    - Actions EU (.PA / .AS / .DE) : lun-ven 9h00-17h30 CET.
    - ETF US (SPY, QQQ, etc.) : même horaire que NYSE.
    """
    rule = _get_market_rule(ticker)
    if rule is None:
        return True, "24/7"
    h   = MARKET_HOURS[rule]
    tz  = pytz.timezone(h["tz"])
    now = datetime.now(tz)
    if now.weekday() >= 5:
        day = "samedi" if now.weekday() == 5 else "dimanche"
        return False, f"Marché fermé ({day}) — rouvre lundi à {h['open'][0]:02d}h{h['open'][1]:02d} ({h['tz']})"
    oh, om = h["open"]
    ch, cm = h["close"]
    open_t  = now.replace(hour=oh, minute=om, second=0, microsecond=0)
    close_t = now.replace(hour=ch, minute=cm, second=0, microsecond=0)
    if open_t <= now <= close_t:
        return True, f"Ouvert ({now.strftime('%H:%M')} {h['tz']})"
    if now < open_t:
        return False, f"Marché fermé — ouvre à {oh:02d}h{om:02d} ({h['tz']})"
    return False, f"Marché fermé — a clôturé à {ch:02d}h{cm:02d} ({h['tz']})"


def _last_price(ticker: str) -> float:
    """
    Prix temps-réel.
    - Crypto : CoinGecko en priorité (source fiable, pas de cross-ticker bug)
    - Autres  : yfinance fast_info + fallback download
    Cache 60s pour éviter les appels répétés dans un même request.
    """
    global _price_cache
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Vérifie le cache
    if ticker in _price_cache:
        cached_price, cached_time = _price_cache[ticker]
        age = (now - cached_time).total_seconds()
        if age < _CACHE_TTL_SECONDS and cached_price > 0:
            return cached_price

    # 1. CoinGecko pour les tickers crypto (anti-corruption prix yfinance)
    if ticker in _CG_IDS:
        cg = _fetch_coingecko_portfolio([ticker])
        price = cg.get(ticker, 0.0)
        if price > 0:
            _price_cache[ticker] = (price, now)
            return price
        # Si CoinGecko échoue → fallback yfinance ci-dessous

    # 2. yfinance fast_info (actions, ETFs, commodités)
    try:
        p = yf.Ticker(ticker).fast_info.last_price
        if p is not None and float(p) > 0:
            price = float(p)
            _price_cache[ticker] = (price, now)
            return price
    except Exception:
        pass

    # 3. Fallback : clôture journalière SANS auto_adjust (évite distorsions leveraged ETFs)
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
    positions = db.query(Position).filter(
        Position.portfolio_id == pf.id,
        Position.quantity > 0
    ).all()

    pos_list  = []
    pos_value = 0.0
    for p in positions:
        px       = _last_price(p.ticker)
        val      = px * float(p.quantity)
        avg      = float(p.avg_price) if p.avg_price else 0
        pnl      = (px - avg) * float(p.quantity)
        pnl_pct  = ((px - avg) / avg * 100) if avg > 0 else 0.0
        pos_value += val
        pos_list.append({
            "ticker":     p.ticker,
            "quantity":   round(float(p.quantity), 6),
            "avg_price":  round(avg, 4),
            "last_price": round(px, 4),
            "value":      round(val, 2),
            "pnl":        round(pnl, 2),
            "pnl_pct":    round(pnl_pct, 2),
        })

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
    side: str       # BUY ou SELL
    mode: str       # "qty" ou "amount"
    value: float    # nombre d'actions OU montant en $
    portfolio: str = "USER"


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
    if body.ticker in _price_cache:
        del _price_cache[body.ticker]

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
            Position.ticker == body.ticker
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
            Position.ticker == body.ticker
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

    # Snapshot equity — utilise exec_price pour cohérence immédiate
    positions_all = db.query(Position).filter(
        Position.portfolio_id == pf.id, Position.quantity > 0
    ).all()
    pos_val = sum(_last_price(p.ticker) * p.quantity for p in positions_all)
    db.add(EquitySnapshot(
        portfolio_id=pf.id,
        equity=float(pf.cash) + pos_val,
        cash=float(pf.cash),
    ))

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
        live_pos_val = sum(_last_price(p.ticker) * float(p.quantity) for p in positions)
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
        pos_val = sum(_last_price(p.ticker) * float(p.quantity) for p in positions)
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
