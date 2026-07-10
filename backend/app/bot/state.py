"""
state.py — état temps-réel du bot, partagé entre threads.
Flag _bot_running + lock + timestamp du dernier démarrage.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime
from typing import Optional

from app.bot.params import PARIS_TZ

logger = logging.getLogger(__name__)

_bot_running       = False
_bot_running_lock  = threading.Lock()
_bot_last_start: Optional[str] = None


def is_bot_running() -> bool:
    global _bot_running
    with _bot_running_lock:
        if not _bot_running:
            return False
        # Safety: auto-reset si stuck >4 minutes (avant le timeout frontend de 6min)
        if _bot_last_start:
            try:
                elapsed = (datetime.now(PARIS_TZ) - datetime.fromisoformat(_bot_last_start)).total_seconds()
                if elapsed > 240:
                    logger.warning(f"Bot running flag auto-reset after {elapsed:.0f}s (likely stuck)")
                    _bot_running = False
                    return False
            except Exception:
                pass
        return True


def get_bot_last_start() -> Optional[str]:
    with _bot_running_lock:
        return _bot_last_start


def try_start_cycle() -> bool:
    """Tente de prendre le lock du cycle. False si un cycle tourne déjà."""
    global _bot_running, _bot_last_start
    with _bot_running_lock:
        if _bot_running:
            return False
        _bot_running = True
        _bot_last_start = datetime.now(PARIS_TZ).isoformat()
        return True


def end_cycle() -> None:
    global _bot_running
    with _bot_running_lock:
        _bot_running = False
