"""
system.py — statut système public : mode maintenance + quiet hours.
Le frontend lit /api/system/status au boot pour afficher la page maintenance
et le badge "bot en pause" pendant les quiet hours.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter

from app.config import MAINTENANCE_MODE, QUIET_HOURS
from app.bot.params import PARIS_TZ
from app.bot.scheduler import _in_quiet_hours

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status")
def system_status():
    now = datetime.now(PARIS_TZ)
    return {
        "maintenance": MAINTENANCE_MODE,
        "quiet_hours": QUIET_HOURS,
        "in_quiet_hours": _in_quiet_hours(now.hour),
        "server_time_paris": now.strftime("%Y-%m-%d %H:%M"),
    }
