"""
app.bot — package du bot de trading IA (ex-bot_engine.py monolithique).

Modules :
  params    — constantes de risque (TP/SL, sizing, VIX, univers)
  state     — flag running partagé entre threads
  pricing   — fetch + validation des prix
  execution — BUY/SELL, snapshots, reset
  cycle     — cycle principal (screener → TP/SL → LLM → exécution)
  scheduler — heartbeat threading 20s
  brain     — décisions LLM (Gemini + fallback)
  screener  — scan technique de l'univers
  logger    — persistance des cycles (DB + JSON)
"""
from app.bot.state import is_bot_running, get_bot_last_start
from app.bot.execution import reset_bot_portfolio
from app.bot.cycle import run_bot_cycle
from app.bot.scheduler import start_bot_scheduler

__all__ = [
    "is_bot_running",
    "get_bot_last_start",
    "reset_bot_portfolio",
    "run_bot_cycle",
    "start_bot_scheduler",
]
