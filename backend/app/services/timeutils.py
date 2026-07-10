"""
timeutils.py — helpers temps partagés.
datetime.utcnow() est déprécié en Python 3.12 : on centralise ici la version
timezone-aware, convertie en naïf UTC pour rester compatible avec les colonnes
DateTime existantes (stockées naïves en base).
"""
from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Maintenant en UTC, naïf (compatible colonnes DateTime existantes)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
