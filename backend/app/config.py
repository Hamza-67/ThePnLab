from __future__ import annotations
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL            = os.getenv("DATABASE_URL", "sqlite:///./ThePnLab.db")

# ── Validation SECRET_KEY — refuse de démarrer sans clé sécurisée en prod ───
_SECRET_KEY_ENV = os.getenv("SECRET_KEY", "")
_IS_PROD = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("ENV", "dev") not in ("dev", "development"))
if not _SECRET_KEY_ENV and _IS_PROD:
    raise RuntimeError(
        "ERREUR CRITIQUE : SECRET_KEY doit être défini comme variable d'environnement "
        "en production (Railway → Variables → SECRET_KEY). "
        "Génère une clé aléatoire : python -c \"import secrets; print(secrets.token_hex(32))\""
    )
SECRET_KEY = _SECRET_KEY_ENV or "ThePnLab-dev-key-not-for-production"
ALGORITHM               = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

GEMINI_KEY              = os.getenv("GEMINI_KEY", "")
GROQ_KEY                = os.getenv("GROQ_KEY", "")
NEWSAPI_KEY             = os.getenv("NEWSAPI_KEY", "")

STARTING_CASH           = float(os.getenv("STARTING_CASH", "10000"))
MAX_POSITION_PCT        = float(os.getenv("MAX_POSITION_PCT", "0.15"))
FEE_RATE                = float(os.getenv("FEE_RATE", "0.001"))
SLIPPAGE_BPS            = int(os.getenv("SLIPPAGE_BPS", "5"))
TRADES_PER_DAY          = int(os.getenv("TRADES_PER_DAY", "60"))
AI_CALLS_PER_DAY        = int(os.getenv("AI_CALLS_PER_DAY", "12"))
NEWS_CALLS_PER_HOUR     = int(os.getenv("NEWS_CALLS_PER_HOUR", "30"))