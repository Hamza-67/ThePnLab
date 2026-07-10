"""
bot_routes.py — ThePnLab AI Bot
Endpoints FastAPI.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.routers.bot_engine import run_bot_cycle, reset_bot_portfolio, is_bot_running, get_bot_last_start
from app.routers.bot_logger import (
    load_today_cycles, load_last_cycle,
    generate_daily_report, get_bot_performance_stats,
    load_cycles_paginated, generate_history_report,
)

bot_router = APIRouter(prefix="/api/bot", tags=["bot"])


@bot_router.get("/report/today")
def get_today_report(lang: str = "fr"):
    cycles = load_today_cycles()
    return generate_daily_report(cycles, lang=lang)


@bot_router.get("/report/last")
def get_last_cycle_report():
    cycle = load_last_cycle()
    if not cycle:
        return {"status": "no_data", "message": "Aucun cycle bot disponible."}
    return {
        "timestamp":         cycle.timestamp,
        "decisions":         cycle.decisions,
        "market_summary_fr": cycle.market_summary_fr,
        "market_summary_en": cycle.market_summary_en,
        "total_trades":      cycle.total_trades,
        "users_processed":   cycle.users_processed,
        "screened_assets":   cycle.screened_assets,
        "errors":            cycle.errors,
    }


@bot_router.get("/performance")
def get_bot_performance(
    days: int = 30,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_bot_performance_stats(db, days=days, user_id=user.id)


@bot_router.post("/trigger")
def trigger_bot_cycle(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
):
    if is_bot_running():
        return {
            "status":  "already_running",
            "message": "Un cycle bot est déjà en cours d'exécution. Patiente 1-3 minutes.",
            "started_at": get_bot_last_start(),
        }
    background_tasks.add_task(run_bot_cycle)
    return {
        "status":  "triggered",
        "message": "Cycle bot démarré. Résultats disponibles dans /report/last dans 1-3 min.",
    }


@bot_router.get("/history")
def get_bot_history(page: int = 0, per_page: int = 20):
    """Historique paginé des cycles bot — utilisé par l'UI (onglet Historique)."""
    result  = load_cycles_paginated(page=page, per_page=per_page)
    reports = generate_history_report(result["cycles"])
    return {
        "reports":  reports,
        "total":    result["total"],
        "page":     result["page"],
        "per_page": result["per_page"],
        "has_more": result["has_more"],
    }


@bot_router.post("/reset")
def reset_bot(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Remet le portfolio IA de l'utilisateur à zéro.
    ISOLÉ par user_id — ne touche pas aux portfolios des autres utilisateurs.
    """
    result = reset_bot_portfolio(db, user_id=user.id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("message", "Erreur reset"))
    return result


@bot_router.get("/status")
def get_bot_status():
    last = load_last_cycle()
    return {
        "active":      True,
        "running":     is_bot_running(),
        "started_at":  get_bot_last_start(),
        "schedule":    "Toutes les 30min (9h-22h Paris, lun-ven)",
        "timezone":    "Europe/Paris",
        "last_cycle":  last.timestamp if last else None,
        "last_trades": last.total_trades if last else 0,
        "model":       "gemini-2.0-flash",
        "universe":    "Actions US high-beta + ETFs + Crypto + CAC40 (55+ actifs)",
        "trade_mode":  "Momentum concentré — HIGH 28%, MEDIUM 18%, LOW 10% ($75-$4000/trade)",
        "tp_sl":       "TP automatique +15%, SL -8%, Pyramiding +8%",
    }
