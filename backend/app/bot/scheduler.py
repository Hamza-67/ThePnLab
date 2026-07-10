"""
scheduler.py — heartbeat natif threading (Railway-proof, pas d'APScheduler).
Vérifie toutes les 20s si on est dans une fenêtre de déclenchement (:00/:30 ± 2min).
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime

from app.bot.params import PARIS_TZ
from app.bot.cycle import run_bot_cycle

logger = logging.getLogger(__name__)


def _parse_quiet_hours() -> tuple[int, int]:
    """Parse QUIET_HOURS 'start-end' (heure Paris). Fenêtre invalide → (0, 0) = désactivé."""
    from app.config import QUIET_HOURS
    try:
        start, end = QUIET_HOURS.split("-")
        return int(start), int(end)
    except Exception:
        return 0, 0


def _in_quiet_hours(hour: int) -> bool:
    start, end = _parse_quiet_hours()
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end  # fenêtre qui passe minuit (ex: 23-6)


def _should_run_now() -> bool:
    """
    Quiet hours (défaut 0h-7h Paris) → jamais, même le weekend (coûts Railway).
    Lun-ven 9h00-22h00 Paris → actions EU + US + crypto.
    Weekend hors quiet hours → crypto 24/7.
    """
    now = datetime.now(PARIS_TZ)
    if _in_quiet_hours(now.hour):
        return False
    if now.weekday() >= 5:
        return True   # weekend : crypto 24/7
    return 9 <= now.hour < 22


def _bot_thread_loop():
    """
    Thread daemon : vérifie toutes les 20 secondes si on est dans une fenêtre
    de déclenchement (:00 ± 2min, heure Paris — un cycle par heure).

    Approche HEARTBEAT — 100% fiable, aucun calcul de timing complexe.
    Garantit qu'aucun cycle ne sera manqué même après un redémarrage Railway.

    POURQUOI cette approche ?
    L'ancienne implémentation utilisait _seconds_until_next_half_hour() avec un
    offset -5s qui réveillait le thread trop tôt (minute=29 ou 59). Le
    `else: time.sleep(60)` suivant faisait dépasser la fenêtre, puis le retour
    en haut du while recalculait le PROCHAIN :30 en sautant définitivement le
    cycle courant → le bot ne se déclenchait JAMAIS automatiquement.
    """
    last_run_key = ""
    logger.info("Bot scheduler démarré — heartbeat 20s, déclenchement toutes les heures (:00 Paris)")

    while True:
        try:
            now  = datetime.now(PARIS_TZ)

            # Clé unique par fenêtre de déclenchement (une par heure)
            # v6 : 30min → 1h. Le screener + LLM à chaque demi-heure coûtait cher
            # (API + CPU Railway) sans gain — le TP/SL est géré par le monitor 10min.
            run_key = f"{now.strftime('%Y-%m-%d')}T{now.hour:02d}:00"

            # Fenêtre de déclenchement : minutes 0, 1, 2
            in_window = now.minute in (0, 1, 2)

            if in_window and run_key != last_run_key:
                last_run_key = run_key
                if _should_run_now():
                    logger.info(
                        f"=== BOT TRIGGER {now.strftime('%A %d/%m %H:%M')} Paris "
                        f"(key={run_key}) ==="
                    )
                    # Lancer le cycle dans un thread séparé pour ne PAS bloquer
                    # le heartbeat — le scheduler doit rester actif pendant le cycle.
                    _cycle_thread = threading.Thread(
                        target=run_bot_cycle,
                        daemon=True,
                        name=f"bot-cycle-{now.strftime('%H%M')}",
                    )
                    _cycle_thread.start()
                else:
                    logger.info(
                        f"Bot skip — hors fenêtre horaire: {now.strftime('%H:%M')} Paris"
                    )
            else:
                logger.debug(
                    f"Bot heartbeat: {now.strftime('%H:%M:%S')} "
                    f"| in_window={in_window} | last={last_run_key}"
                )

            time.sleep(20)  # vérification toutes les 20s — léger, fiable

        except Exception as e:
            logger.error(f"Bot thread loop error: {e}", exc_info=True)
            time.sleep(60)


def start_bot_scheduler():
    """Lance le scheduler heartbeat dans un thread daemon."""
    t = threading.Thread(
        target=_bot_thread_loop,
        daemon=True,
        name="bot-scheduler",
    )
    t.start()
    logger.info(f"Bot scheduler démarré (thread={t.name}, daemon=True, heartbeat=20s)")
    return t
