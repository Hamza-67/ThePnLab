"""
Migration 001 — colonnes dérivés (CFD/Futures) sur positions + trades.

create_all n'ajoute PAS de colonnes sur des tables existantes → ce script
fait des ALTER TABLE idempotents (IF NOT EXISTS) pour la DB Railway.

Usage (une seule fois, APRÈS backup de la DB) :
    railway run python migrations/001_add_derivatives_columns.py
En local SQLite, create_all suffit — ce script n'est utile que pour Postgres.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from app.database import engine

STATEMENTS = [
    # positions
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS instrument_type VARCHAR(10) DEFAULT 'SPOT'",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS direction VARCHAR(5) DEFAULT 'LONG'",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS leverage FLOAT DEFAULT 1.0",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS margin FLOAT DEFAULT 0.0",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS liquidation_price FLOAT",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS contract_size FLOAT DEFAULT 1.0",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS financing_rate FLOAT DEFAULT 0.0",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS last_mark_price FLOAT",
    "ALTER TABLE positions ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP",
    # trades
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS instrument_type VARCHAR(10) DEFAULT 'SPOT'",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS direction VARCHAR(5) DEFAULT 'LONG'",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS leverage FLOAT DEFAULT 1.0",
]


def main():
    if engine.dialect.name == "sqlite":
        print("SQLite détecté — utiliser create_all (rien à faire ici).")
        return

    with engine.begin() as conn:
        for stmt in STATEMENTS:
            print(f"→ {stmt}")
            conn.execute(text(stmt))
    print(f"OK — {len(STATEMENTS)} colonnes vérifiées/ajoutées.")


if __name__ == "__main__":
    main()
