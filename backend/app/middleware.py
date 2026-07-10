"""
middleware.py — Sécurité ThePnLab
Placer dans : backend/app/middleware.py
"""

from __future__ import annotations

import time
import re
import threading
from collections import defaultdict
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# ── Rate limiting config ──────────────────────────────────────────────────────
RATE_LIMITS = {
    "/api/auth/login":              (10,  60),
    "/api/auth/signup":             (5,   60),
    "/api/auth/forgot-password":    (3,  300),   # max 3 demandes / 5min — anti-spam email
    "/api/bot/trigger":             (2,   60),   # max 2 triggers / min — anti-DoS IA
    "/api/bot/reset":               (1,  300),   # max 1 reset / 5min
    "/api/coach/ask":               (20,  60),
    "/api/portfolio/order":         (30,  60),
    "/api/portfolio/leaderboard":   (30,  60),   # anti-scraping classement
    "/api/market/":                 (60,  60),   # max 60 req/min par IP — protège yfinance/CoinGecko
    "default":                      (120, 60),
}

_rate_store: dict[str, list[float]] = defaultdict(list)
_rate_store_lock = threading.Lock()
_last_cleanup = time.time()
_CLEANUP_INTERVAL = 300  # nettoyage toutes les 5 minutes


def _cleanup_rate_store() -> None:
    """Supprime les entrées périmées pour éviter la fuite mémoire."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    _last_cleanup = now
    max_window = max(w for _, w in RATE_LIMITS.values())
    keys_to_delete = [k for k, ts in _rate_store.items() if not any(now - t < max_window for t in ts)]
    for k in keys_to_delete:
        del _rate_store[k]


def _get_limit(path: str) -> tuple[int, int]:
    for prefix, limit in RATE_LIMITS.items():
        if prefix != "default" and path.startswith(prefix):
            return limit
    return RATE_LIMITS["default"]


def _is_rate_limited(ip: str, path: str) -> bool:
    max_req, window = _get_limit(path)
    key  = f"{ip}:{path}"
    now  = time.time()
    with _rate_store_lock:
        _cleanup_rate_store()
        _rate_store[key] = [t for t in _rate_store[key] if now - t < window]
        if len(_rate_store[key]) >= max_req:
            return True
        _rate_store[key].append(now)
    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # ← Laisser passer toutes les requêtes OPTIONS (preflight CORS)
        if request.method == "OPTIONS":
            return await call_next(request)

        # IP
        forwarded = request.headers.get("X-Forwarded-For")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")

        # Rate limiting
        if _is_rate_limited(ip, request.url.path):
            return JSONResponse(
                status_code=429,
                content={"detail": "Trop de requêtes. Réessaie dans quelques secondes."},
            )

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"]       = "nosniff"
        response.headers["X-Frame-Options"]              = "DENY"
        response.headers["X-XSS-Protection"]             = "1; mode=block"
        response.headers["Referrer-Policy"]              = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]           = "geolocation=(), microphone=(), camera=()"
        # HSTS — force HTTPS pour 1 an (navigateurs modernes + Railway)
        response.headers["Strict-Transport-Security"]    = "max-age=31536000; includeSubDomains"

        return response


# ── Validation helpers ────────────────────────────────────────────────────────
def validate_ticker(ticker: str) -> bool:
    return bool(re.match(r'^[A-Z0-9\-\.=]{1,20}$', ticker.upper()))

def validate_order_value(value: float, mode: str) -> tuple[bool, str]:
    if mode == "qty":
        if value <= 0 or value > 10_000:
            return False, "Quantité invalide (1 – 10 000)"
    elif mode == "amount":
        if value < 1 or value > 500_000:
            return False, "Montant invalide (1$ – 500 000$)"
    return True, ""

def sanitize_string(value: str, max_len: int = 255) -> str:
    value = value.strip()
    value = re.sub(r'[<>"\';\\]', '', value)
    return value[:max_len]


def setup_security(app: FastAPI) -> None:
    app.add_middleware(SecurityMiddleware)
    import logging as _log
    _log.getLogger(__name__).info("Security middleware loaded")