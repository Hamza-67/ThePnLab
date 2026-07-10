from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.config import NEWSAPI_KEY
import requests
import re
import math

router = APIRouter(prefix="/api/news", tags=["news"])

TRUSTED = [
    "reuters", "bloomberg", "financial times", "wsj", "cnbc",
    "le monde", "les echos", "bbc", "ft", "marketwatch",
]

AD_TRIGGERS = [
    "sponsored", "advertisement", "promo", "discount", "partner content",
]

MACRO_KW = [
    "fed", "ecb", "inflation", "recession", "gdp", "rate", "bond",
    "oil", "opec", "war", "sanctions", "tariff", "earnings", "market",
]

# ── Dictionnaires de risque Wall Street ──────────────────────────────────────

# Niveau CRITIQUE — chocs systémiques, risques de contagion globale
RISK_CRITICAL = [
    "nuclear", "world war", "invasion", "collapse", "default", "bankrupt",
    "systemic", "contagion", "black swan", "lehman", "meltdown", "catastrophe",
    "catastrophic", "famine", "genocide", "coup", "civil war", "attack",
]

# Niveau ÉLEVÉ — risques macro majeurs
RISK_HIGH = [
    "war", "crisis", "crash", "recession", "rate hike", "hawkish",
    "sanctions", "tariff", "stagflation", "hyperinflation", "debt ceiling",
    "bank run", "credit crunch", "liquidity", "panic", "selloff", "sell-off",
    "downgrade", "deficit", "devaluation", "escalation", "conflict",
    "emergency", "freeze", "halt", "suspend", "blockade", "embargo",
]

# Niveau MODÉRÉ — signaux de stress
RISK_MODERATE = [
    "inflation", "uncertainty", "volatile", "volatility", "slowdown",
    "concern", "warning", "risk", "threat", "tension", "dispute",
    "protest", "strike", "supply chain", "shortage", "pressure",
    "disappointing", "miss", "downgrade", "revision", "contraction",
    "unemployment", "layoff", "deficit", "correction",
]

# Amplificateurs de vélocité — intensifient le score de l'article
VELOCITY_AMPLIFIERS = [
    "sudden", "emergency", "breaking", "urgent", "immediately", "shock",
    "unexpected", "surprise", "abrupt", "rapidly", "soaring", "plunging",
    "surging", "collapsing", "unprecedented", "historic", "record",
]

# Signaux positifs — atténuent le risque
RISK_POSITIVE = [
    "ceasefire", "peace deal", "rate cut", "dovish", "stimulus", "recovery",
    "rebound", "growth", "deal", "agreement", "resolution", "relief",
    "surplus", "beat", "outperform", "strong", "resilient", "stabilize",
]

# Catégories de risque avec poids — inspiré des modèles JPMorgan/Goldman
RISK_CATEGORIES = {
    "geopolitical":  {"keywords": ["war", "invasion", "nuclear", "conflict", "coup", "attack", "military", "troops", "missile"], "weight": 2.0},
    "monetary":      {"keywords": ["fed", "ecb", "rate hike", "hawkish", "tightening", "quantitative", "inflation", "stagflation"], "weight": 1.8},
    "credit":        {"keywords": ["default", "bankrupt", "debt", "downgrade", "credit", "bond", "yield", "spread"], "weight": 1.6},
    "liquidity":     {"keywords": ["bank run", "liquidity", "freeze", "halt", "contagion", "systemic", "lehman"], "weight": 2.0},
    "trade":         {"keywords": ["tariff", "sanctions", "embargo", "blockade", "trade war", "supply chain"], "weight": 1.4},
    "energy":        {"keywords": ["oil", "opec", "gas", "energy crisis", "pipeline", "shortage"], "weight": 1.3},
}


def _article_risk_score(title: str, desc: str, trusted: bool) -> dict:
    """
    Calcule un score de risque par article avec pondération multi-niveaux.
    Retourne le score brut et le détail des signaux détectés.
    """
    text = f"{title} {desc}".lower()
    raw_score = 0
    signals = []

    # Niveau critique (+20 chacun)
    for kw in RISK_CRITICAL:
        if kw in text:
            raw_score += 20
            signals.append(("critical", kw))

    # Niveau élevé (+12 chacun)
    for kw in RISK_HIGH:
        if kw in text:
            raw_score += 12
            signals.append(("high", kw))

    # Niveau modéré (+5 chacun)
    for kw in RISK_MODERATE:
        if kw in text:
            raw_score += 5
            signals.append(("moderate", kw))

    # Positifs (-4 chacun — asymétrie volontaire, les marchés craignent + qu'ils espèrent)
    for kw in RISK_POSITIVE:
        if kw in text:
            raw_score -= 4
            signals.append(("positive", kw))

    # Vélocité — amplifie de 40% si signaux d'urgence
    has_velocity = any(v in text for v in VELOCITY_AMPLIFIERS)
    if has_velocity:
        raw_score = int(raw_score * 1.4)

    # Boost source de confiance — les médias sérieux couvrent mieux les vrais risques
    if trusted and raw_score > 0:
        raw_score = int(raw_score * 1.2)

    # Pondération par catégorie
    category_boost = 0
    for cat, data in RISK_CATEGORIES.items():
        if any(kw in text for kw in data["keywords"]) and raw_score > 0:
            category_boost = max(category_boost, data["weight"])
    if category_boost > 1.0:
        raw_score = int(raw_score * category_boost * 0.3 + raw_score * 0.7)

    return {"score": max(0, raw_score), "signals": signals, "velocity": has_velocity}


def _compute_macro_risk(articles: list) -> tuple[int, str, str]:
    """
    Agrège les scores individuels avec :
    - Effet de contagion (plusieurs articles = amplification)
    - Consensus négatif (% d'articles risqués)
    - Normalisation logarithmique
    Retourne (risk_score 0-100, risk_level, explanation)
    """
    if not articles:
        return 0, "LOW", "Aucune donnée disponible."

    scored = [_article_risk_score(a["title"], a["description"], a["trusted"]) for a in articles]
    raw_scores = [s["score"] for s in scored]

    # Score de base = somme pondérée (articles les + risqués comptent plus)
    raw_scores_sorted = sorted(raw_scores, reverse=True)
    base_score = 0
    for i, s in enumerate(raw_scores_sorted):
        # Décroissance exponentielle — le 1er article pèse 100%, le 2e 80%, etc.
        base_score += s * (0.8 ** i)

    # Effet contagion — si plusieurs articles parlent du même risque
    risky_count = sum(1 for s in raw_scores if s > 15)
    if risky_count >= 5:
        contagion_mult = 1.5
    elif risky_count >= 3:
        contagion_mult = 1.25
    elif risky_count >= 2:
        contagion_mult = 1.1
    else:
        contagion_mult = 1.0
    base_score *= contagion_mult

    # Consensus négatif — % d'articles avec risque élevé
    consensus = risky_count / len(articles) if articles else 0
    if consensus >= 0.7:
        base_score *= 1.3
    elif consensus >= 0.5:
        base_score *= 1.15

    # Normalisation logarithmique (comme le VIX)
    # Score brut 0-500+ → score normalisé 0-100
    if base_score <= 0:
        normalized = 0
    else:
        normalized = min(100, int(40 * math.log(1 + base_score / 35)))

    # Seuils calibrés sur données historiques
    if normalized >= 65:
        level = "HIGH"
    elif normalized >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"

    # Explication pédagogique
    explanation = _build_explanation(normalized, level, risky_count, scored, len(articles))

    return normalized, level, explanation


def _build_explanation(score: int, level: str, risky_count: int, scored: list, total: int) -> str:
    """Génère une explication claire du score pour l'utilisateur."""

    # Signaux détectés
    critical_signals = [s for item in scored for lvl, s in item["signals"] if lvl == "critical"]
    high_signals     = [s for item in scored for lvl, s in item["signals"] if lvl == "high"]
    velocity_count   = sum(1 for item in scored if item["velocity"])

    lines = []

    if level == "HIGH":
        lines.append(f"⚠️ Risque élevé ({score}/100) — Les marchés sont sous forte pression.")
    elif level == "MEDIUM":
        lines.append(f"🟡 Risque modéré ({score}/100) — Vigilance recommandée.")
    else:
        lines.append(f"🟢 Risque faible ({score}/100) — Environnement macro relativement calme.")

    if critical_signals:
        unique = list(dict.fromkeys(critical_signals))[:3]
        lines.append(f"Signaux critiques détectés : {', '.join(unique)}.")

    if high_signals and not critical_signals:
        unique = list(dict.fromkeys(high_signals))[:3]
        lines.append(f"Signaux de risque élevé : {', '.join(unique)}.")

    if risky_count >= 3:
        lines.append(f"{risky_count}/{total} articles signalent des risques majeurs — effet de contagion activé.")

    if velocity_count >= 2:
        lines.append("Plusieurs articles indiquent des événements soudains ou imprévus.")

    if score >= 65:
        lines.append("Conseil : privilégier la prudence, réduire l'exposition aux actifs risqués.")
    elif score >= 35:
        lines.append("Conseil : surveiller l'évolution de la situation avant de prendre des positions importantes.")
    else:
        lines.append("Conseil : environnement favorable aux positions longues avec gestion du risque habituelle.")

    return " ".join(lines)


def _score(title: str, desc: str) -> int:
    text = f"{title} {desc}".lower()
    score = sum(8 for kw in MACRO_KW if kw in text)
    if len(title) < 15:
        score -= 15
    if len(desc) < 50:
        score -= 5
    return score


def _is_ad(title: str, desc: str, url: str) -> bool:
    t = f"{title} {desc}".lower()
    return any(w in t for w in AD_TRIGGERS) or any(
        x in url.lower() for x in ["utm_", "affiliate", "ref="]
    )


def _trusted(source: str) -> bool:
    return any(k in source.lower() for k in TRUSTED)


@router.get("/feed")
def get_news(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not NEWSAPI_KEY:
        return {"articles": [], "status": "KEY_MISSING", "risk": "UNKNOWN", "risk_score": 0, "risk_explanation": ""}

    query = (
        '(Fed OR ECB OR inflation OR recession OR GDP OR "interest rates" '
        'OR oil OR OPEC OR sanctions OR war OR tariffs OR earnings) '
        'AND (market OR stocks OR bonds OR commodities)'
    )

    try:
        r = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": 40,
                "apiKey": NEWSAPI_KEY,
            },
            timeout=12,
        )
        if r.status_code != 200:
            return {"articles": [], "status": f"HTTP_{r.status_code}", "risk": "UNKNOWN", "risk_score": 0, "risk_explanation": ""}

        raw = r.json().get("articles", []) or []
        out = []
        for a in raw:
            title  = (a.get("title") or "").strip()
            desc   = (a.get("description") or "").strip()
            source = ((a.get("source") or {}).get("name") or "").strip()
            url    = (a.get("url") or "").strip()
            pub    = (a.get("publishedAt") or "")[:10]

            if not title or not url or "[Removed]" in title:
                continue
            if len(title) < 15:
                continue
            if not desc or len(desc) < 20:
                continue
            if _is_ad(title, desc, url):
                continue

            score = _score(title, desc)
            out.append({
                "title":       title,
                "description": desc[:200],
                "source":      source,
                "url":         url,
                "date":        pub,
                "score":       score,
                "trusted":     _trusted(source),
            })

        # Curation
        trusted = [x for x in out if x["trusted"] and x["score"] >= 10]
        curated = trusted if len(trusted) >= 5 else sorted(out, key=lambda x: x["score"], reverse=True)

        # Dédoublonnage
        seen, dedup = set(), []
        for x in curated:
            key = re.sub(r"\s+", " ", x["title"].lower())[:80]
            if key not in seen:
                seen.add(key)
                dedup.append(x)

        articles = dedup[:10]

        # Score risque macro Wall Street
        risk_score, risk, risk_explanation = _compute_macro_risk(articles)

        return {
            "articles": articles,
            "status": "OK",
            "risk": risk,
            "risk_score": risk_score,
            "risk_explanation": risk_explanation,
        }

    except Exception as e:
        return {"articles": [], "status": f"ERROR: {e}", "risk": "UNKNOWN", "risk_score": 0, "risk_explanation": ""}