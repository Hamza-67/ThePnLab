"""
bot_logger.py — ThePnLab AI Bot
Logs cycles dans PostgreSQL (persistant sur Railway) + fallback JSON local.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from typing import Optional

from app.services.timeutils import utcnow

logger = logging.getLogger(__name__)
LOGS_DIR = os.getenv("BOT_LOGS_DIR", "data/bot_cycles")


@dataclass
class BotCycleLog:
    timestamp: str
    decisions: list[dict] = field(default_factory=list)
    screened_assets: list[str] = field(default_factory=list)
    market_summary_fr: str = ""
    market_summary_en: str = ""
    spy_change: Optional[float] = None
    vix: Optional[float] = None
    macro_news: str = ""
    users_processed: int = 0
    total_trades: int = 0
    portfolio_value_before: Optional[float] = None
    portfolio_value_after: Optional[float] = None
    cycle_duration_s: Optional[float] = None
    errors: list[str] = field(default_factory=list)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _row_to_cycle(row) -> BotCycleLog:
    """Convert a BotCycle ORM row to BotCycleLog."""
    return BotCycleLog(
        timestamp=row.timestamp,
        decisions=json.loads(row.decisions_json or "[]"),
        screened_assets=json.loads(row.screened_assets_json or "[]"),
        market_summary_fr=row.market_summary_fr or "",
        market_summary_en=row.market_summary_en or "",
        spy_change=row.spy_change,
        vix=row.vix,
        macro_news=row.macro_news or "",
        users_processed=row.users_processed or 0,
        total_trades=row.total_trades or 0,
        portfolio_value_before=row.portfolio_value_before,
        portfolio_value_after=row.portfolio_value_after,
        cycle_duration_s=row.cycle_duration_s,
        errors=json.loads(row.errors_json or "[]"),
    )


def _safe_json_load(path: str) -> Optional[BotCycleLog]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # Backward compat: only pass known fields
        known = set(BotCycleLog.__dataclass_fields__.keys())
        filtered = {k: v for k, v in data.items() if k in known}
        return BotCycleLog(**filtered)
    except Exception as e:
        logger.warning(f"JSON load error {path}: {e}")
        return None


# ── Save ─────────────────────────────────────────────────────────────────────

def save_bot_cycle(cycle: BotCycleLog) -> str:
    """Save cycle to PostgreSQL (persistent) + JSON file (local fallback)."""
    # 1. JSON fallback (local dev / backup)
    path = ""
    try:
        os.makedirs(LOGS_DIR, exist_ok=True)
        ts   = cycle.timestamp.replace(":", "-").replace("+", "_")[:19]
        path = os.path.join(LOGS_DIR, f"cycle_{ts}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(cycle), f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"JSON save_bot_cycle failed: {e}")

    # 2. PostgreSQL (primary — persistent across Railway deploys)
    try:
        from app.database import SessionLocal
        from app.models.portfolio import BotCycle as BotCycleModel
        db = SessionLocal()
        try:
            row = BotCycleModel(
                timestamp=cycle.timestamp,
                decisions_json=json.dumps(cycle.decisions, ensure_ascii=False),
                screened_assets_json=json.dumps(cycle.screened_assets, ensure_ascii=False),
                market_summary_fr=cycle.market_summary_fr or "",
                market_summary_en=cycle.market_summary_en or "",
                spy_change=cycle.spy_change,
                vix=cycle.vix,
                macro_news=(cycle.macro_news or "")[:2000],  # cap at 2000 chars
                users_processed=cycle.users_processed,
                total_trades=cycle.total_trades,
                portfolio_value_before=cycle.portfolio_value_before,
                portfolio_value_after=cycle.portfolio_value_after,
                cycle_duration_s=cycle.cycle_duration_s,
                errors_json=json.dumps(cycle.errors, ensure_ascii=False),
            )
            db.add(row)
            db.commit()
            logger.info(f"Bot cycle saved to DB (id={row.id}, trades={cycle.total_trades})")
        except Exception as e:
            db.rollback()
            logger.error(f"DB save_bot_cycle error: {e}", exc_info=True)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"DB connection failed in save_bot_cycle: {e}")

    return path


# ── Load ─────────────────────────────────────────────────────────────────────

def load_last_cycle() -> Optional[BotCycleLog]:
    """Load most recent cycle — DB first, JSON fallback."""
    try:
        from app.database import SessionLocal
        from app.models.portfolio import BotCycle as BotCycleModel
        db = SessionLocal()
        try:
            row = db.query(BotCycleModel).order_by(BotCycleModel.id.desc()).first()
            if row:
                return _row_to_cycle(row)
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"DB load_last_cycle failed, using JSON: {e}")

    # JSON fallback
    if not os.path.exists(LOGS_DIR):
        return None
    files = sorted([f for f in os.listdir(LOGS_DIR) if f.endswith(".json")])
    return _safe_json_load(os.path.join(LOGS_DIR, files[-1])) if files else None


def load_today_cycles(target_date: Optional[date] = None) -> list[BotCycleLog]:
    """Load all cycles for a given day — DB first, JSON fallback."""
    if target_date is None:
        target_date = date.today()
    date_str = target_date.isoformat()  # "YYYY-MM-DD"

    try:
        from app.database import SessionLocal
        from app.models.portfolio import BotCycle as BotCycleModel
        db = SessionLocal()
        try:
            rows = (
                db.query(BotCycleModel)
                .filter(BotCycleModel.timestamp.like(f"{date_str}%"))
                .order_by(BotCycleModel.id.asc())
                .all()
            )
            return [_row_to_cycle(r) for r in rows]
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"DB load_today_cycles failed, using JSON: {e}")

    # JSON fallback
    cycles = []
    if not os.path.exists(LOGS_DIR):
        return cycles
    for fname in sorted(os.listdir(LOGS_DIR)):
        if not fname.startswith(f"cycle_{date_str}"):
            continue
        c = _safe_json_load(os.path.join(LOGS_DIR, fname))
        if c:
            cycles.append(c)
    return cycles


def load_cycles_paginated(page: int = 0, per_page: int = 10) -> dict:
    """Paginated load — DB first, JSON fallback."""
    try:
        from app.database import SessionLocal
        from app.models.portfolio import BotCycle as BotCycleModel
        db = SessionLocal()
        try:
            total = db.query(BotCycleModel).count()
            rows = (
                db.query(BotCycleModel)
                .order_by(BotCycleModel.id.desc())
                .offset(page * per_page)
                .limit(per_page)
                .all()
            )
            cycles = [_row_to_cycle(r) for r in rows]
            return {
                "cycles": cycles,
                "total": total,
                "page": page,
                "per_page": per_page,
                "has_more": (page + 1) * per_page < total,
            }
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"DB load_cycles_paginated failed, using JSON: {e}")

    # JSON fallback
    if not os.path.exists(LOGS_DIR):
        return {"cycles": [], "total": 0, "page": page, "per_page": per_page, "has_more": False}
    all_files = sorted(
        [f for f in os.listdir(LOGS_DIR) if f.endswith(".json")],
        reverse=True,
    )
    total  = len(all_files)
    start  = page * per_page
    subset = all_files[start:start + per_page]
    cycles = [c for f in subset if (c := _safe_json_load(os.path.join(LOGS_DIR, f)))]
    return {
        "cycles": cycles,
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": start + per_page < total,
    }


def load_cycles_range(days: int = 30) -> list[BotCycleLog]:
    """Load cycles from the last N days."""
    cutoff = (utcnow() - timedelta(days=days)).isoformat()
    try:
        from app.database import SessionLocal
        from app.models.portfolio import BotCycle as BotCycleModel
        db = SessionLocal()
        try:
            rows = (
                db.query(BotCycleModel)
                .filter(BotCycleModel.timestamp >= cutoff)
                .order_by(BotCycleModel.id.asc())
                .all()
            )
            return [_row_to_cycle(r) for r in rows]
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"DB load_cycles_range failed: {e}")
    return []


# ── Reports ──────────────────────────────────────────────────────────────────

def generate_daily_report(cycles: list[BotCycleLog], lang: str = "fr") -> dict:
    if not cycles:
        return {
            "date":         date.today().strftime("%d/%m/%Y"),
            "status":       "idle",
            "message_fr":   "Le bot n'a pas tradé aujourd'hui — marché fermé ou pas de signal.",
            "message_en":   "Bot did not trade today — market closed or no signal.",
            "trades":       [],
            "total_trades": 0,
            "summary_fr":   "",
            "summary_en":   "",
            "cycles_run":   0,
        }

    all_decisions = []
    summaries_fr  = []
    summaries_en  = []
    total_trades  = 0

    # Messages techniques — ne doivent jamais apparaître comme "lecture du marché"
    _ERROR_MARKERS = ("Erreur connexion", "Connection error", "Cycle déjà en cours", "Cycle already running")

    def _is_valid_summary(s: str) -> bool:
        return bool(s) and not any(m in s for m in _ERROR_MARKERS)

    for cycle in cycles:
        if _is_valid_summary(cycle.market_summary_fr):
            summaries_fr.append(cycle.market_summary_fr)
        if _is_valid_summary(cycle.market_summary_en):
            summaries_en.append(cycle.market_summary_en)
        total_trades += cycle.total_trades

        for d in cycle.decisions:
            if d.get("action") in ("BUY", "SELL"):
                all_decisions.append({
                    "time":             cycle.timestamp[11:16],
                    "ticker":           d["ticker"],
                    "action":           d["action"],
                    "price":            d.get("price", 0),
                    "amount_usd":       d.get("amount_usd", 0),
                    "confidence":       d.get("confidence", "MEDIUM"),
                    "risk_level":       d.get("risk_level", "MEDIUM"),
                    "rationale_fr":     d.get("rationale_fr", ""),
                    "rationale_en":     d.get("rationale_en", ""),
                    "executed_on":      d.get("executed_on", 0),
                    "total_portfolios": d.get("total_portfolios", 0),
                    "position_before":  d.get("position_before"),
                    "strikes":          d.get("strikes"),
                    # Contexte macro du cycle
                    "spy_change_pct":   round(cycle.spy_change * 100, 2) if cycle.spy_change is not None else None,
                    "vix":              cycle.vix,
                })

    return {
        "date":         date.today().strftime("%d/%m/%Y"),
        "status":       "active" if total_trades > 0 else "idle",
        "total_trades": total_trades,
        "cycles_run":   len(cycles),
        "trades":       all_decisions,
        # Seulement la DERNIÈRE lecture du marché — concaténer tous les cycles
        # du jour donnait un pavé illisible dans l'UI
        "summary_fr":   summaries_fr[-1] if summaries_fr else "Pas de résumé.",
        "summary_en":   summaries_en[-1] if summaries_en else "No summary.",
        "message_fr":   f"Le bot a effectué {total_trades} trade(s) aujourd'hui.",
        "message_en":   f"The bot executed {total_trades} trade(s) today.",
    }


def generate_history_report(cycles: list[BotCycleLog]) -> list[dict]:
    reports = []
    for cycle in sorted(cycles, key=lambda c: c.timestamp, reverse=True):
        trades = [d for d in cycle.decisions if d.get("action") in ("BUY", "SELL")]
        holds  = [d for d in cycle.decisions if d.get("action") == "HOLD"]
        reports.append({
            "timestamp":             cycle.timestamp,
            "date_fr":               _fmt_date_fr(cycle.timestamp),
            "total_trades":          cycle.total_trades,
            "summary_fr":            cycle.market_summary_fr or "—",
            "summary_en":            cycle.market_summary_en or "—",
            "trades":                trades,
            "holds":                 holds,
            "screened":              cycle.screened_assets,
            "errors":                cycle.errors,
            "status":                "active" if cycle.total_trades > 0 else "idle",
            # Rich context
            "spy_change_pct":        round(cycle.spy_change * 100, 2) if cycle.spy_change is not None else None,
            "vix":                   round(cycle.vix, 1) if cycle.vix is not None else None,
            "macro_news":            cycle.macro_news or "",
            "portfolio_value_before": cycle.portfolio_value_before,
            "portfolio_value_after":  cycle.portfolio_value_after,
            "cycle_duration_s":      round(cycle.cycle_duration_s, 1) if cycle.cycle_duration_s is not None else None,
            "users_processed":       cycle.users_processed,
        })
    return reports


def _fmt_date_fr(iso_ts: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_ts[:19])
        return dt.strftime("%d/%m/%Y à %H:%M")
    except Exception:
        return iso_ts[:16]


def get_bot_performance_stats(db_session, days: int = 30, user_id: int | None = None) -> dict:
    """
    Stats de performance du bot pour un utilisateur précis.
    Si user_id fourni : filtre par portfolio.user_id — chaque user ne voit QUE ses propres stats.
    """
    try:
        from app.models.portfolio import Trade, Portfolio
        from datetime import timedelta

        cutoff = (utcnow() - timedelta(days=days)).isoformat()

        query = db_session.query(Trade).filter(
            Trade.actor == "BOT",
            Trade.created_at >= cutoff,
        )

        # ── Isolation par user ────────────────────────────────────────────────
        if user_id is not None:
            user_pf_ids = [
                pf.id for pf in db_session.query(Portfolio).filter(
                    Portfolio.user_id == user_id
                ).all()
            ]
            if not user_pf_ids:
                return {
                    "status": "no_data", "days": days,
                    "message": "Aucun portfolio bot trouvé pour cet utilisateur.",
                    "total_trades": 0, "closed_trades": 0, "open_trades": 0,
                    "total_pnl": 0.0, "win_rate_pct": 0.0,
                    "best_ticker": None, "worst_ticker": None,
                    "by_ticker": {}, "recent_trades": [],
                }
            query = query.filter(Trade.portfolio_id.in_(user_pf_ids))

        all_trades = query.order_by(Trade.created_at.desc()).all()

        if not all_trades:
            return {
                "status":        "no_data",
                "days":          days,
                "message":       f"Aucun trade bot sur les {days} derniers jours.",
                "total_trades":  0,
                "closed_trades": 0,
                "open_trades":   0,
                "total_pnl":     0.0,
                "win_rate_pct":  0.0,
                "best_ticker":   None,
                "worst_ticker":  None,
                "by_ticker":     {},
                "recent_trades": [],
            }

        buy_trades  = [t for t in all_trades if t.side == "BUY"]
        sell_trades = [t for t in all_trades if t.side == "SELL"]
        total_pnl   = sum(float(t.profit) for t in sell_trades)
        wins        = [t for t in sell_trades if float(t.profit) > 0]
        losses      = [t for t in sell_trades if float(t.profit) <= 0]
        win_rate    = len(wins) / len(sell_trades) * 100 if sell_trades else 0

        by_ticker: dict[str, dict] = {}
        for t in sell_trades:
            if t.ticker not in by_ticker:
                by_ticker[t.ticker] = {"closed_trades": 0, "wins": 0, "losses": 0, "pnl": 0.0, "win_rate": 0.0}
            by_ticker[t.ticker]["closed_trades"] += 1
            by_ticker[t.ticker]["pnl"] += float(t.profit)
            if float(t.profit) > 0:
                by_ticker[t.ticker]["wins"] += 1
            else:
                by_ticker[t.ticker]["losses"] += 1

        for ticker, s in by_ticker.items():
            total = s["closed_trades"]
            s["win_rate"] = round(s["wins"] / total * 100, 1) if total else 0
            s["pnl"]      = round(s["pnl"], 2)

        best_ticker  = max(by_ticker, key=lambda k: by_ticker[k]["pnl"]) if by_ticker else None
        worst_ticker = min(by_ticker, key=lambda k: by_ticker[k]["pnl"]) if by_ticker else None

        recent = []
        for t in all_trades[:10]:
            recent.append({
                "ticker":    t.ticker,
                "side":      t.side,
                "price":     round(float(t.price), 2),
                "qty":       round(float(t.quantity), 4),
                "pnl":       round(float(t.profit), 2) if t.side == "SELL" else None,
                "date":      str(t.created_at)[:16] if t.created_at else "",
                "rationale": t.rationale or "",
            })

        return {
            "status":        "ok",
            "days":          days,
            "total_trades":  len(all_trades),
            "buy_trades":    len(buy_trades),
            "closed_trades": len(sell_trades),
            "wins":          len(wins),
            "losses":        len(losses),
            "total_pnl":     round(total_pnl, 2),
            "win_rate_pct":  round(win_rate, 1),
            "best_ticker":   best_ticker,
            "best_pnl":      round(by_ticker[best_ticker]["pnl"], 2) if best_ticker else None,
            "worst_ticker":  worst_ticker,
            "worst_pnl":     round(by_ticker[worst_ticker]["pnl"], 2) if worst_ticker else None,
            "by_ticker":     by_ticker,
            "recent_trades": recent,
        }
    except Exception as e:
        logger.error(f"Performance stats error: {e}")
        return {"status": "error", "error": str(e)}
