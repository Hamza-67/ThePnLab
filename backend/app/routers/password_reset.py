"""
password_reset.py — ThePnLab
Endpoints pour récupération de mot de passe par email (Resend API).
"""
from __future__ import annotations

import logging
import os
import secrets
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import Session

from app.database import get_db, Base
from app.models.user import User
from app.auth import hash_password

reset_router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Config Resend ─────────────────────────────────────────────────────────────
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL     = os.getenv("FROM_EMAIL", "noreply@thepnlab.com")
FROM_NAME      = "ThePnLab"
FRONTEND_URL   = os.getenv("FRONTEND_URL", "http://localhost:5174")
TOKEN_EXPIRE_MIN = 30


# ── Modèle DB pour les tokens ─────────────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    token      = Column(String, primary_key=True, index=True)
    email      = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)


try:
    from app.database import engine
    PasswordResetToken.__table__.create(bind=engine, checkfirst=True)
except Exception:
    pass


# ── Envoi email via Resend API ────────────────────────────────────────────────
def _send_reset_email(to_email: str, to_name: str, reset_link: str) -> bool:
    try:
        html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0D0B1E;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:linear-gradient(135deg,#130F2E,#1A1530);
              border:1px solid rgba(124,58,237,0.3);border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#7C3AED,#4F46E5);padding:28px 32px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">🏛️</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">ThePnLab</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:2px;">SIMULATION ÉDUCATIVE</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#F1F5F9;font-size:18px;margin:0 0 12px;">Bonjour {to_name} 👋</h2>
      <p style="color:#94A3B8;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Vous avez demandé à réinitialiser votre mot de passe ThePnLab.<br>
        Ce lien est valable <strong style="color:#C4B5FD;">30 minutes</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{reset_link}"
           style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#4F46E5);
                  color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;
                  font-weight:700;font-size:15px;">
          🔑 Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color:#64748B;font-size:12px;line-height:1.6;margin:24px 0 0;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
      </p>
    </div>
    <div style="padding:16px 32px;background:rgba(0,0,0,0.2);text-align:center;">
      <p style="color:#475569;font-size:11px;margin:0;">
        © 2025 ThePnLab · Simulation éducative · Aucun argent réel
      </p>
    </div>
  </div>
</body>
</html>"""

        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"{FROM_NAME} <{FROM_EMAIL}>",
                "to": [to_email],
                "subject": "🔑 Réinitialisation de votre mot de passe ThePnLab",
                "html": html,
            },
            timeout=10,
        )
        logger.debug("RESEND STATUS: %d", response.status_code)
        return response.status_code == 200

    except Exception as e:
        logger.error("EMAIL ERROR: %s: %s", type(e).__name__, e)
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@reset_router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()

    success_response = {
        "message": "Si cet email est enregistré, vous recevrez un lien dans quelques minutes."
    }

    if not user:
        return success_response

    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == body.email.lower()
    ).delete()

    token = secrets.token_hex(32)
    expires_at = datetime.now() + timedelta(minutes=TOKEN_EXPIRE_MIN)
    db.add(PasswordResetToken(
        token=token,
        email=body.email.lower().strip(),
        expires_at=expires_at,
    ))
    db.commit()

    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    logger.info("Password reset requested for user id=%d", user.id)
    result = _send_reset_email(
        to_email=user.email,
        to_name=user.name or "utilisateur",
        reset_link=reset_link,
    )
    logger.debug("Password reset email sent: %s", result)

    return success_response


@reset_router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (minimum 8 caractères)")

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé.")

    if datetime.now() > reset_token.expires_at:
        db.delete(reset_token)
        db.commit()
        raise HTTPException(status_code=400, detail="Lien expiré. Faites une nouvelle demande.")

    user = db.query(User).filter(User.email == reset_token.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    user.password_hash = hash_password(body.new_password)
    db.delete(reset_token)
    db.commit()

    return {"message": "Mot de passe mis à jour avec succès. Vous pouvez vous reconnecter."}


@reset_router.get("/reset-password/verify")
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token
    ).first()

    if not reset_token or datetime.now() > reset_token.expires_at:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré.")

    return {"valid": True, "email": reset_token.email}