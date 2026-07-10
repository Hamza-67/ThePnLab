from __future__ import annotations

import os
import sys
import logging
from contextlib import asynccontextmanager

# Force UTF-8 stdout/stderr on Windows to avoid emoji UnicodeEncodeError
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

logger = logging.getLogger(__name__)
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import user, portfolio, waitlist
from app.routers import auth, market, portfolio as portfolio_router, coach, news, replay
from app.routers.bot_routes import bot_router
from app.routers.password_reset import reset_router
from app.middleware import setup_security

# Création automatique des tables
Base.metadata.create_all(bind=engine)

# ── Initialisation RAG coach ──────────────────────────────────────────────────
try:
    from app.routers.coach_knowledge import knowledge_base
    knowledge_base.initialize()
except Exception as e:
    logging.getLogger(__name__).warning("RAG init warning: %s", e)


# ── Lifespan (startup/shutdown) ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.bot import start_bot_scheduler
        start_bot_scheduler()
        logger.info("Bot scheduler started (daemon thread)")
    except Exception as e:
        logger.error("Bot scheduler error: %s", e, exc_info=True)

    yield  # ← FastAPI sert les requêtes ici

    logger.info("ThePnLab shutting down")


app = FastAPI(
    title="ThePnLab API",
    description="Backend FastAPI pour ThePnLab — paper trading pédagogique",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENV", "dev") == "dev" else None,
    redoc_url=None,
)

# ── Validation errors en français ─────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    messages = {
        'value_error': 'Email invalide',
        'string_type': 'Ce champ doit être du texte',
        'value_required': 'Ce champ est obligatoire',
    }
    msg = messages.get(first_error.get('type'), 'Erreur de validation')
    return JSONResponse(status_code=422, content={"detail": msg})

# ── CORS origins ──────────────────────────────────────────────────────────────
# En prod Railway : définir ALLOWED_ORIGINS=https://www.thepnlab.com,https://thepnlab.com
# Si non défini → localhost uniquement (dev) OU le fallback inclut le domaine prod.
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000,"
    "https://www.thepnlab.com,https://thepnlab.com"
).split(",")

# ── Sécurité ──────────────────────────────────────────────────────────────────
setup_security(app)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(portfolio_router.router)
app.include_router(coach.router)
app.include_router(news.router)
app.include_router(bot_router)
app.include_router(reset_router)
app.include_router(replay.router)


@app.get("/")
def root():
    return {"message": "ThePnLab API v2.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
