"""
coach.py — ThePnLab v3
Coach IA pédagogique ultra-amélioré :
- Anti-répétition : fingerprint des dernières réponses par session
- RAG enrichi (extraits du livre + concepts clés)
- ML utilisateur : adapte ses conseils à l'historique réel
- Réponses variées selon type de question (technique, psycho, stratégie)
- Gemini → Groq fallback
- Contexte conversationnel multi-tour
"""
from __future__ import annotations

import hashlib
import logging
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.config import GEMINI_KEY, GROQ_KEY

router = APIRouter(prefix="/api/coach", tags=["coach"])
logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 2000

# ── Anti-répétition : garde les fingerprints des 12 dernières réponses par user ──
_response_memory: dict[int, list[str]] = defaultdict(list)
MAX_MEMORY_SLOTS = 12

# ── Cache du modèle Gemini fonctionnel ────────────────────────────────────────
_working_model = "gemini-2.0-flash"


# ── Détection du type de question ────────────────────────────────────────────
def _detect_question_type(question: str) -> str:
    """Détermine la catégorie de question pour adapter la réponse."""
    q = question.lower()

    if any(w in q for w in ["acheter", "buy", "vendre", "sell", "entrer", "sortir", "price target", "objectif"]):
        return "ACTION"
    if any(w in q for w in ["rsi", "macd", "bollinger", "indicateur", "signal", "divergence", "sma", "ema", "adx", "atr"]):
        return "TECHNICAL"
    if any(w in q for w in ["peur", "perdre", "stress", "confiance", "emotion", "psych", "courage", "hésit"]):
        return "PSYCHOLOGY"
    if any(w in q for w in ["stratégie", "strategy", "long terme", "court terme", "swing", "scalp", "position", "portfolio", "diversif"]):
        return "STRATEGY"
    if any(w in q for w in ["risque", "stop loss", "stop-loss", "perte", "drawdown", "sizing", "taille"]):
        return "RISK"
    if any(w in q for w in ["bitcoin", "crypto", "eth", "sol", "btc", "blockchain", "defi"]):
        return "CRYPTO"
    if any(w in q for w in ["qu'est", "comment", "pourquoi", "expliquer", "définition", "c'est quoi"]):
        return "EDUCATION"
    return "GENERAL"


# ── Construire le fingerprint d'une réponse ───────────────────────────────────
def _fingerprint(text: str) -> str:
    # Prend les 200 premiers caractères significatifs
    normalized = " ".join(text.lower().split())[:200]
    return hashlib.md5(normalized.encode()).hexdigest()[:12]


# ── Vérifier si la réponse est trop similaire aux précédentes ─────────────────
def _is_repetitive(user_id: int, response: str) -> bool:
    fp = _fingerprint(response)
    return fp in _response_memory[user_id]


# ── Enregistrer une réponse dans la mémoire ───────────────────────────────────
def _remember_response(user_id: int, response: str) -> None:
    fp = _fingerprint(response)
    mem = _response_memory[user_id]
    if fp not in mem:
        mem.append(fp)
    if len(mem) > MAX_MEMORY_SLOTS:
        mem.pop(0)


# ── Appels IA ─────────────────────────────────────────────────────────────────
def _call_gemini(prompt: str) -> Optional[str]:
    global _working_model
    if not GEMINI_KEY:
        return None
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=GEMINI_KEY)
        response = client.models.generate_content(
            model=_working_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=MAX_OUTPUT_TOKENS,
                temperature=0.55,  # un peu de créativité pour éviter les répétitions
            ),
        )
        if response.text:
            return response.text.strip()
        return None
    except Exception as e:
        logger.warning(f"Gemini coach error: {e}")
        return None


def _call_groq(prompt: str) -> Optional[str]:
    if not GROQ_KEY:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.55,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Groq coach error: {e}")
        return None


# ── Contexte ML utilisateur — historique complet ─────────────────────────────
def _build_user_ml_context(db: Session, user: User, ticker: str) -> str:
    try:
        from app.models.portfolio import Trade, Portfolio
        portfolio = db.query(Portfolio).filter(
            Portfolio.user_id == user.id,
            Portfolio.name == "USER"
        ).first()
        if not portfolio:
            return ""

        # Trades sur ce ticker
        ticker_trades = (
            db.query(Trade)
            .filter(Trade.portfolio_id == portfolio.id, Trade.ticker == ticker, Trade.side == "SELL")
            .order_by(Trade.id.desc())
            .limit(15)
            .all()
        )

        # Stats globales de l'utilisateur
        all_sell_trades = (
            db.query(Trade)
            .filter(Trade.portfolio_id == portfolio.id, Trade.side == "SELL")
            .order_by(Trade.id.desc())
            .limit(50)
            .all()
        )

        global_wins   = sum(1 for t in all_sell_trades if t.profit > 0)
        global_losses = len(all_sell_trades) - global_wins
        global_pnl    = sum(t.profit for t in all_sell_trades)
        global_wr     = global_wins / len(all_sell_trades) * 100 if all_sell_trades else 0

        lines = [f"PROFIL TRADER : Win rate global {global_wr:.0f}% ({global_wins}W/{global_losses}L) | P&L total ${global_pnl:.2f}"]

        if ticker_trades:
            wins = sum(1 for t in ticker_trades if t.profit > 0)
            total_pnl = sum(t.profit for t in ticker_trades)
            wr = wins / len(ticker_trades) * 100
            profile = "bon trader sur ce titre" if wr >= 60 else ("en difficulté sur ce titre" if wr < 40 else "résultats mitigés")
            lines.append(f"SUR {ticker} : {len(ticker_trades)} trades | WR {wr:.0f}% | P&L ${total_pnl:.2f} ({profile})")

            # Dernier trade
            last = ticker_trades[0]
            lines.append(f"Dernier trade {ticker} : {'gain' if last.profit > 0 else 'perte'} ${last.profit:.2f}")

        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"ML context error: {e}")
        return ""


# ── Construction du prompt selon le type de question ─────────────────────────
def _build_coach_prompt(
    question: str,
    ticker: str,
    price: float,
    rsi: float,
    macd: str,
    sma50: float,
    ml_context: str,
    rag_context: str,
    question_type: str,
    attempt: int = 1,
) -> str:
    # Instructions spécifiques par type
    type_instructions = {
        "ACTION": """Donne un avis clair sur l'action (BUY/SELL/WAIT) en 4-5 phrases :
- Phrase 1 : analyse technique rapide (RSI, MACD, tendance)
- Phrase 2 : contexte du prix par rapport aux niveaux clés
- Phrase 3 : ce que tu ferais et pourquoi (avis direct)
- Phrase 4 : niveau de risque et stop loss suggéré
- Phrase 5 : rappel que c'est de la simulation""",

        "TECHNICAL": """Explique l'indicateur/concept technique demandé en 4-5 phrases :
- Phrase 1 : définition claire et accessible
- Phrase 2 : comment l'interpréter (signaux BUY/SELL)
- Phrase 3 : application concrète sur {ticker} avec les valeurs actuelles
- Phrase 4 : forces et limites de cet indicateur
- Phrase 5 : conseil pratique personnalisé""",

        "PSYCHOLOGY": """Réponds au défi psychologique de manière empathique en 4-5 phrases :
- Phrase 1 : reconnais l'émotion ressentie (normal de ressentir ça)
- Phrase 2 : explication du biais cognitif en jeu
- Phrase 3 : technique pratique pour gérer cette émotion
- Phrase 4 : rappel de la règle des 1-2% de risque par trade
- Phrase 5 : encouragement basé sur l'historique de l'utilisateur""",

        "STRATEGY": """Explique la stratégie demandée en 4-5 phrases concrètes :
- Phrase 1 : définition et cas d'usage de cette stratégie
- Phrase 2 : conditions de marché favorables (trends, VIX, volumes)
- Phrase 3 : application sur {ticker} avec l'analyse actuelle
- Phrase 4 : règles de gestion du risque pour cette stratégie
- Phrase 5 : conseil basé sur le profil de l'utilisateur""",

        "RISK": """Donne un cours sur la gestion du risque en 4-5 phrases :
- Phrase 1 : principe fondamental du risk management
- Phrase 2 : calcul du position sizing adapté au portfolio
- Phrase 3 : placement du stop loss pour {ticker} (niveau technique)
- Phrase 4 : rapport risque/rendement (R:R) idéal
- Phrase 5 : règle d'or à retenir""",

        "CRYPTO": """Explique le marché crypto en 4-5 phrases pédagogiques :
- Phrase 1 : contexte spécifique crypto (volatilité, 24/7, market cap)
- Phrase 2 : analyse de {ticker} avec les indicateurs actuels
- Phrase 3 : spécificités du trading crypto vs actions
- Phrase 4 : gestion du risque adaptée à la volatilité crypto
- Phrase 5 : conseil pratique""",

        "EDUCATION": """Explique clairement le concept demandé en 4-5 phrases :
- Phrase 1 : définition simple et accessible pour un étudiant
- Phrase 2 : exemple concret avec {ticker}
- Phrase 3 : comment utiliser ce concept en pratique
- Phrase 4 : lien avec d'autres concepts importants
- Phrase 5 : exercice pratique suggéré""",

        "GENERAL": """Réponds à cette question de trading en 4-5 phrases :
- Phrase 1 : réponse directe à la question
- Phrase 2 : application au contexte {ticker} actuel
- Phrase 3 : conseil pratique actionnable
- Phrase 4 : avertissement ou nuance importante
- Phrase 5 : encouragement et prochaine étape""",
    }

    instructions = type_instructions.get(question_type, type_instructions["GENERAL"]).replace("{ticker}", ticker)

    # Si 2ème tentative (anti-répétition), insister sur la différence
    diversity_instruction = ""
    if attempt > 1:
        diversity_instruction = "\n⚠️ IMPORTANT : Ta réponse précédente était trop similaire à une réponse déjà donnée. Reformule COMPLÈTEMENT avec une angle différent, d'autres exemples, une autre approche pédagogique.\n"

    prompt = f"""Tu es le Coach IA de ThePnLab — plateforme de simulation trading pour étudiants.
Tu es un vrai coach, expert en trading, avec la pédagogie d'un professeur de finance.
Tu adaptes tes réponses à chaque profil d'utilisateur.
{diversity_instruction}
📊 CONTEXTE MARCHÉ ACTUEL :
  Actif : {ticker} | Prix : ${price:.2f} | RSI : {rsi:.0f}
  MACD : {macd} | SMA50 : ${sma50:.2f}

👤 PROFIL UTILISATEUR :
  {ml_context or "Premier contact — pas encore d'historique"}

📚 CONNAISSANCES PERTINENTES :
  {rag_context or "Utilise tes connaissances générales en trading"}

❓ QUESTION : {question}

📝 FORMAT DE RÉPONSE — TYPE [{question_type}] :
{instructions}

RÈGLES ABSOLUES :
- NE JAMAIS répéter mot pour mot une réponse déjà donnée
- Utilise des exemples chiffrés concrets (% précis, niveaux de prix)
- Adapte le niveau au profil : débutant si peu de trades, plus technique si expérimenté
- Reste encourageant et pédagogique
- Mentionne que c'est de la simulation si tu donnes un avis direct
- Termine par une question ou une action concrète à faire"""

    return prompt


# ── Schéma requête ────────────────────────────────────────────────────────────
class CoachRequest(BaseModel):
    question: str
    ticker: str
    price: float
    rsi: float
    macd: str
    sma50: float
    conversation_history: list[dict] = []  # [{role, text}] optionnel


# ── Endpoint principal ────────────────────────────────────────────────────────
@router.post("/ask")
def ask_coach(
    body: CoachRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    question_type = _detect_question_type(body.question)
    ml_context    = _build_user_ml_context(db, user, body.ticker)

    rag_context = ""
    try:
        from app.routers.coach_knowledge import get_relevant_context
        rag_context = get_relevant_context(body.question)
    except Exception:
        pass

    # Essayer jusqu'à 3 fois pour obtenir une réponse non-répétitive
    rep = None
    for attempt in range(1, 4):
        prompt = _build_coach_prompt(
            question=body.question,
            ticker=body.ticker,
            price=body.price,
            rsi=body.rsi,
            macd=body.macd,
            sma50=body.sma50,
            ml_context=ml_context,
            rag_context=rag_context,
            question_type=question_type,
            attempt=attempt,
        )

        candidate = None
        if GEMINI_KEY:
            candidate = _call_gemini(prompt)
        if not candidate and GROQ_KEY:
            candidate = _call_groq(prompt)

        if not candidate:
            break

        # Anti-répétition : si trop similaire, réessayer (max 2 fois)
        if not _is_repetitive(user.id, candidate) or attempt == 3:
            rep = candidate
            break

    if not rep:
        raise HTTPException(
            status_code=503,
            detail="Coach IA indisponible — vérifie GEMINI_KEY ou GROQ_KEY dans .env"
        )

    # Enregistrer en mémoire pour éviter la répétition future
    _remember_response(user.id, rep)

    return {
        "response": rep,
        "question_type": question_type,
    }


# ── Endpoint de reconstruction de l'index RAG ─────────────────────────────────
@router.post("/rebuild-index")
def rebuild_index(user: User = Depends(get_current_user)):
    try:
        from app.routers.coach_knowledge import knowledge_base
        success = knowledge_base.build_index()
        if success:
            return {"status": "ok", "message": f"Index construit ({len(knowledge_base.chunks)} chunks)"}
        return {"status": "error", "message": "Échec — vérifie que finance_book.pdf est dans backend/app/data/"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
