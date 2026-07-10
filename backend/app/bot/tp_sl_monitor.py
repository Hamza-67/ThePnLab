"""
tp_sl_monitor.py — boucle TP/SL légère, toutes les 10 minutes.
Prix seulement (pas de screener, pas de LLM) : entre deux cycles horaires,
un ETF 3x peut dériver bien au-delà du SL -7% (constaté : -15/-25%).
Ce monitor applique TP +15% (vente 60%) et SL -7% (vente totale)
sur tous les portfolios IA, via la même _execute() que le cycle.
"""
from __future__ import annotations

import logging
import threading
import time

from app.bot import state
from app.bot.params import (
    BOT_PORTFOLIO_NAME, TP_THRESHOLD, SL_THRESHOLD,
)

logger = logging.getLogger(__name__)

MONITOR_INTERVAL_S = 600  # 10 minutes


def run_tp_sl_check() -> int:
    """
    Passe TP/SL sur tous les portfolios IA. Retourne le nombre de ventes exécutées.
    Séparé de la boucle pour être testable sans thread.
    """
    from app.database import SessionLocal
    from app.models.portfolio import Portfolio
    from app.bot.brain import BotDecision
    from app.bot.execution import _execute, _get_positions_performance
    from app.bot.pricing import _get_price

    sells = 0
    db = SessionLocal()
    try:
        all_pf = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).all()
        for pf in all_pf:
            for p in _get_positions_performance(db, pf):
                pnl_pct = p["pnl_pct"]
                ticker  = p["ticker"]

                if pnl_pct <= SL_THRESHOLD * 100:
                    decision = BotDecision(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 2,  # oversized → vend tout
                        rationale_fr=f"STOP LOSS MONITOR {pnl_pct:.1f}% — seuil {SL_THRESHOLD*100:.0f}% atteint",
                        rationale_en=f"MONITOR STOP LOSS {pnl_pct:.1f}% — {SL_THRESHOLD*100:.0f}% threshold hit",
                        risk_level="HIGH",
                    )
                elif pnl_pct >= TP_THRESHOLD * 100:
                    decision = BotDecision(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 0.60,
                        rationale_fr=f"TAKE PROFIT MONITOR +{pnl_pct:.1f}% — seuil +{TP_THRESHOLD*100:.0f}% atteint, vente 60%",
                        rationale_en=f"MONITOR TAKE PROFIT +{pnl_pct:.1f}% — +{TP_THRESHOLD*100:.0f}% threshold, selling 60%",
                        risk_level="LOW",
                    )
                else:
                    continue

                price = _get_price(ticker)
                if not price:
                    logger.warning(f"[TP/SL MONITOR] Prix indisponible pour {ticker}")
                    continue

                ok, msg = _execute(db, pf, decision, price, 1.0)
                if ok:
                    sells += 1
                    logger.warning(f"[TP/SL MONITOR pf={pf.id}] {msg}")

        if sells:
            db.commit()
    except Exception as e:
        logger.error(f"TP/SL monitor error: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()
    return sells


def _run_derivatives_checks():
    """Liquidations (tous users) + passe overnight quotidienne (00h15 Paris)."""
    from app.database import SessionLocal
    from app.services.liquidation import check_liquidations
    from app.services.overnight import maybe_run_overnight

    db = SessionLocal()
    try:
        check_liquidations(db)
        maybe_run_overnight(db)
    finally:
        db.close()


def _monitor_loop():
    logger.info("TP/SL monitor démarré — vérification toutes les 10 min (prix seulement)")
    while True:
        time.sleep(MONITOR_INTERVAL_S)
        try:
            # Ne pas se superposer à un cycle en cours — le cycle gère déjà TP/SL
            if not state.is_bot_running():
                run_tp_sl_check()
            else:
                logger.debug("TP/SL monitor skip — cycle bot en cours")
            # Dérivés : liquidations + financement/MTM (indépendant du bot)
            _run_derivatives_checks()
        except Exception as e:
            logger.error(f"TP/SL monitor loop error: {e}", exc_info=True)


def start_tp_sl_monitor():
    """Lance le monitor TP/SL dans un thread daemon."""
    t = threading.Thread(target=_monitor_loop, daemon=True, name="tp-sl-monitor")
    t.start()
    logger.info(f"TP/SL monitor démarré (thread={t.name}, daemon=True, interval=600s)")
    return t
