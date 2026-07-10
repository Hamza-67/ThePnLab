"""
bot_brain.py — ThePnLab AI Bot v2
Cerveau IA : stratégie momentum agressive pour maximiser le PnL.
  - Concentration : 3-6 positions max, 15-30% du portfolio par trade
  - Momentum : suit les tendances fortes (ADX > 25, MACD BULL, Volume surge)
  - TP/SL automatiques : coupe les pertes à -8%, prend profits à +15%
  - Pyramiding : renforce les positions gagnantes (+8%)
  - Trailing stop intégré dans le prompt
"""
from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor as _TPE, TimeoutError as _FuturesTimeout
from dataclasses import dataclass, field

from app.routers.bot_screener import ScreenedAsset
from app.config import GEMINI_KEY

logger = logging.getLogger(__name__)


@dataclass
class BotDecision:
    ticker:      str
    action:      str        # "BUY" | "SELL" | "HOLD"
    confidence:  str        # "HIGH" | "MEDIUM" | "LOW"
    amount_usd:  float      # Montant en $ à investir/vendre
    rationale_fr: str
    rationale_en: str
    risk_level:  str        # "LOW" | "MEDIUM" | "HIGH"
    indicators:  dict = field(default_factory=dict)


# ── ML context ────────────────────────────────────────────────────────────────
def _build_ml_context(db_session) -> str:
    try:
        from app.models.portfolio import Trade
        trades = (
            db_session.query(Trade)
            .filter(Trade.actor == "BOT", Trade.side == "SELL")
            .order_by(Trade.id.desc())
            .limit(300)
            .all()
        )
        if not trades:
            return "Premier cycle — pas encore d'historique de trades."

        stats: dict[str, dict] = {}
        for t in trades:
            if t.ticker not in stats:
                stats[t.ticker] = {"wins": 0, "losses": 0, "pnl": 0.0}
            if t.profit > 0:
                stats[t.ticker]["wins"] += 1
            else:
                stats[t.ticker]["losses"] += 1
            stats[t.ticker]["pnl"] += t.profit

        lines = []
        for ticker, s in sorted(stats.items(), key=lambda x: x[1]["pnl"], reverse=True):
            total = s["wins"] + s["losses"]
            wr    = s["wins"] / total * 100 if total else 0
            tag   = "EVITE" if wr < 35 else ("STAR" if wr >= 65 and s["pnl"] > 0 else "OK")
            lines.append(f"  {ticker}: {total} trades | WR {wr:.0f}% | PnL ${s['pnl']:.2f} [{tag}]")
        return "HISTORIQUE BOT (apprends et adapte ta stratégie):\n" + "\n".join(lines)
    except Exception as e:
        logger.warning(f"ML context error: {e}")
        return "Historique non disponible."


# ── LLM call (Gemini + Groq fallback) ────────────────────────────────────────
def _safe_generate(prompt: str) -> str | None:
    if GEMINI_KEY:
        _ex_gemini = _TPE(max_workers=1)
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_KEY)
            _fut = _ex_gemini.submit(
                client.models.generate_content,
                model="gemini-2.0-flash",
                contents=prompt,
            )
            try:
                response = _fut.result(timeout=45)
                if response and response.text:
                    return response.text
            except _FuturesTimeout:
                logger.warning("Gemini timeout (45s) — fallback Groq")
            except Exception as e:
                logger.warning(f"Gemini error: {e} — fallback Groq")
        except Exception as e:
            logger.warning(f"Gemini setup error: {e} — fallback Groq")
        finally:
            _ex_gemini.shutdown(wait=False)  # ne pas bloquer si Gemini est pendu

    try:
        from app.config import GROQ_KEY
        if not GROQ_KEY:
            return None
        from groq import Groq
        client = Groq(api_key=GROQ_KEY)
        _ex_groq = _TPE(max_workers=1)
        _fut_groq = _ex_groq.submit(
            client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1600,
            temperature=0.2,
        )
        try:
            response = _fut_groq.result(timeout=40)
            return response.choices[0].message.content.strip()
        except _FuturesTimeout:
            logger.error("Groq timeout (40s)")
            return None
        except Exception as e:
            logger.error(f"Groq error: {e}")
            return None
        finally:
            _ex_groq.shutdown(wait=False)
    except Exception as e:
        logger.error(f"Groq setup error: {e}")
        return None


# ── Prompt ────────────────────────────────────────────────────────────────────
def _build_prompt(
    assets: list[ScreenedAsset],
    ml_context: str,
    positions: dict,
    market_context: dict,
    evite_tickers: set | None = None,
) -> str:
    portfolio_equity = market_context.get("portfolio_equity", 10000.0)
    strikes          = market_context.get("strikes", {})
    positions_perf   = market_context.get("positions_performance", [])
    n_open           = market_context.get("n_open_positions", 0)
    max_open         = market_context.get("max_open_positions", 4)
    evite_tickers    = evite_tickers or set()

    # ── Actifs avec indicateurs enrichis
    assets_lines = []
    screened_tickers = {a.ticker for a in assets}

    for a in assets:
        s = strikes.get(a.ticker, {})
        strike_info = ""
        if s:
            pct_h = s.get("pct_from_high")
            pct_l = s.get("pct_from_low")
            sma200_tag = ("ABOVE_SMA200" if s.get("above_sma200") is True
                          else "BELOW_SMA200" if s.get("above_sma200") is False else "")
            near = ("NEAR_RESISTANCE" if s.get("near_high") else
                    "NEAR_SUPPORT" if s.get("near_low") else "")
            strike_info = (
                f" | 52w_H={s.get('high52w')} ({pct_h:+.1f}%)"
                f" | 52w_L={s.get('low52w')} ({pct_l:+.1f}%)"
                f" | {sma200_tag} | {near}"
            ).rstrip(" |")

        adx_str   = f" | ADX={a.adx:.0f}" if a.adx else ""
        atr_str   = f" | ATR={a.atr_pct:.1f}%" if a.atr_pct else ""
        mom1d     = f" | Mom1j={a.momentum_1d:+.1f}%" if hasattr(a, 'momentum_1d') else ""
        slope_str = ""
        sma50_str = ""
        if hasattr(a, 'macd_hist_slope') and a.macd_hist_slope:
            slope_tag = "↑ACC" if a.macd_hist_slope > 0.005 else ("↓DEC" if a.macd_hist_slope < -0.005 else "")
            slope_str = f" | MACDslope={slope_tag}" if slope_tag else ""
        if hasattr(a, 'above_sma50') and a.above_sma50 is not None:
            sma50_str = f" | {'▲SMA50' if a.above_sma50 else '▼SMA50'}"

        assets_lines.append(
            f"- {a.ticker} ({a.category}): ${a.price:.2f}"
            f" | RSI={a.rsi:.1f} | MACD={a.macd_signal}{slope_str}"
            f" | Vol={a.volume_surge:.1f}x | Mom5j={a.momentum_5d:+.1f}%"
            f"{mom1d} | BB={a.bb_position}{adx_str}{atr_str}{sma50_str}"
            f" | Score={a.score:+.1f}"
            f"{strike_info}"
        )
    assets_text = "\n".join(assets_lines)

    # ── Positions avec PnL et TP/SL status
    tp_sl_notes = []
    if positions_perf:
        positions_text = "\n".join([
            f"  {p['ticker']}: {p['qty']:.4f} x avg=${p['avg_price']} | "
            f"now=${p['current']} | PnL={'+' if p['pnl']>=0 else ''}{p['pnl']:.2f}$ "
            f"({'+' if p['pnl_pct']>=0 else ''}{p['pnl_pct']:.1f}%) | val=${p['value_usd']:.0f}"
            for p in positions_perf
        ])
        # Annotations TP/SL — SYNCHRONISÉES avec les seuils du moteur (TP=+15%, SL=-5%, pyramid=+10%)
        for p in positions_perf:
            if p["pnl_pct"] >= 15:
                tp_sl_notes.append(f"  >>> 🎯 TAKE PROFIT : {p['ticker']} à +{p['pnl_pct']:.1f}% — VENDRE au moins 60% maintenant (seuil +15% atteint)")
            elif p["pnl_pct"] <= -5:
                tp_sl_notes.append(f"  >>> ⛔ STOP LOSS OBLIGATOIRE : {p['ticker']} à {p['pnl_pct']:.1f}% — SELL IMMÉDIAT, tolérance zéro (seuil -5%)")
            elif p["pnl_pct"] >= 10:
                tp_sl_notes.append(f"  >>> 📈 PYRAMIDING disponible : {p['ticker']} +{p['pnl_pct']:.1f}% — renforcer si MACD BULL + ADX>30 (seuil +10%)")
            elif p["pnl_pct"] <= -3:
                tp_sl_notes.append(f"  >>> ⚠️ VIGILANCE : {p['ticker']} à {p['pnl_pct']:.1f}% — surveiller, SL automatique à -5%")

        # Positions non screened
        extra_lines = []
        for p in positions_perf:
            if p["ticker"] not in screened_tickers:
                s = strikes.get(p["ticker"], {})
                near = "NEAR_RESISTANCE" if s.get("near_high") else ("NEAR_SUPPORT" if s.get("near_low") else "")
                extra_lines.append(
                    f"- {p['ticker']} (OWNED/non-screened): ${p['current']:.2f}"
                    f" | PnL={'+' if p['pnl']>=0 else ''}{p['pnl']:.2f}$ ({p['pnl_pct']:+.1f}%)"
                    f" | {near}"
                )
        if extra_lines:
            assets_text += "\n[POSITIONS NON SCREENED — evaluer SELL]\n" + "\n".join(extra_lines)
    else:
        positions_text = "  Aucune position ouverte — DEPLOYER le capital."

    tp_sl_block = "\n".join(tp_sl_notes) if tp_sl_notes else "  Aucune alerte TP/SL."

    spy   = market_context.get("spy_change_pct")
    vix   = market_context.get("vix")
    vix_r = market_context.get("vix_regime", "")
    mult  = market_context.get("position_multiplier", 1.0)
    news  = market_context.get("macro_news", "")

    # Montants selon confiance — v4 équilibré (survie + croissance)
    max_high   = round(portfolio_equity * 0.20 * mult, 0)  # HIGH : 20% portfolio (était 30%)
    max_medium = round(portfolio_equity * 0.13 * mult, 0)  # MEDIUM : 13% (était 20%)
    max_low    = round(portfolio_equity * 0.08 * mult, 0)  # LOW : 8% (était 13%)
    max_clamp  = min(max_high, 3000.0)                     # cap absolu à $3000 (était $5000)

    # Bloc tickers interdits (hard ban ML)
    if evite_tickers:
        evite_block = (
            "\n⛔⛔ TICKERS TOTALEMENT INTERDITS (BAN PERMANENT CE CYCLE) ⛔⛔\n"
            "Ces tickers ont un historique de pertes catastrophique — tout BUY est STRICTEMENT INTERDIT :\n"
            + "\n".join(f"  ❌ {t} — NE PAS ACHETER, JAMAIS, QUELLES QUE SOIENT LES CONDITIONS" for t in sorted(evite_tickers))
            + "\nSi tu as une position ouverte sur l'un d'eux → SELL immédiat."
        )
    else:
        evite_block = ""

    # Bloc limite positions
    positions_limit_block = (
        f"\n⚠️ POSITIONS OUVERTES : {n_open}/{max_open} — "
        + ("AUCUN NOUVEAU BUY AUTORISÉ CE CYCLE (max atteint — SELL d'abord)."
           if n_open >= max_open
           else f"Tu peux ouvrir {max_open - n_open} nouvelle(s) position(s).")
    )

    # Bloc régime de marché (injecté dans le contexte pour guider les décisions)
    spy_val = spy if spy is not None else 0.0
    vix_val = vix if vix else 0.0
    if spy_val <= -5.0 or vix_val >= 30:
        regime_block = (
            "\nREGIME MARCHE : BAISSE SEVERE / RISQUE ELEVE\n"
            "→ HOLD strict : 0 nouveau BUY actions US ni leveraged ETF.\n"
            "→ Crypto : BUY uniquement si Score>8 + MACD BULL + Vol>2x (conviction absolue).\n"
            "→ Si en position avec PnL positif → SELL partial 50% pour sécuriser.\n"
            "→ Cash est une position. Rester 80%+ cash par sécurité.\n"
        )
    elif spy_val <= -2.0 or vix_val >= 25:
        regime_block = (
            "\nREGIME MARCHE : PRUDENCE (VIX élevé ou SPY faible)\n"
            "→ Pas de leveraged ETF (TQQQ/SOXL/SPXL) — trop risqués en volatilité.\n"
            "→ Crypto seulement si Score>6 + MACD BULL + RSI<60.\n"
            "→ Sizing: utiliser LOW uniquement, jamais HIGH ni MEDIUM.\n"
        )
    elif spy_val >= 0.5 and vix_val < 20:
        regime_block = (
            "\nREGIME MARCHE : FAVORABLE (VIX bas, marché haussier)\n"
            "→ Conditions optimales pour BUY si signaux confirmés.\n"
            "→ Leveraged ETF autorisés si Score>7 + setup confirmé.\n"
        )
    else:
        regime_block = "\nREGIME MARCHE : NEUTRE — priorité signaux techniques.\n"

    return f"""Tu es ALPHA-BOT, algorithme de trading quantitatif discipliné.
MISSION : croissance durable du portfolio par des trades de QUALITE, pas de quantite.
Portfolio : ${portfolio_equity:.0f} | Regle d'or : PROTEGER LE CAPITAL avant de le faire croitre.

{ml_context}
{evite_block}
{positions_limit_block}
{regime_block}
CONTEXTE MARCHE
SPY : {f'{spy:+.2f}%' if spy is not None else 'N/A'} | VIX : {f'{vix:.1f}' if vix else 'N/A'} ({vix_r}) | Mult.position : {mult:.2f}
{news}

POSITIONS ACTUELLES
{positions_text}

ALERTES TP/SL (PRIORITE MAXIMALE)
{tp_sl_block}

ACTIFS SCREENED (tries par score)
Legende : MACDslope↑ACC=momentum accelere | SMA50 haut=au-dessus tendance | NEAR_SUPPORT/RESISTANCE
{assets_text}

REGLES ABSOLUES
1. JSON VALIDE UNIQUEMENT — pas de texte avant/apres.
2. Max 3 decisions par cycle (BUY + SELL combines).
3. SIZING v5 — CONSERVATEUR :
   HIGH   = ${max_high:.0f} (15% portfolio) — conviction MAXIMALE + regime favorable
   MEDIUM = ${max_medium:.0f} (10%) — bon signal confirme
   LOW    = ${max_low:.0f} (6%) — signal correct, regime prudent
   Min $50 · Cap ${max_clamp:.0f} absolu. QUALITE > QUANTITE.

4. ENTREE PARFAITE — BUY uniquement si AU MOINS 5 conditions reunies :
   + MACD = BULL ou NEUTRAL↑ACC
   + RSI entre 40 et 65 (momentum sain, pas suracheté)
   + ADX >= 25 (tendance confirmee, pas de range)
   + Volume >= 1.5x (confirmation institutionnelle)
   + SMA50 haut (dans la tendance principale)
   + Score >= +6
   Si moins de 5 conditions → HOLD. En cas de doute → HOLD.

5. SETUPS HAUTE CONVICTION (BUY HIGH) — regime FAVORABLE uniquement :
   A) MACD BULL↑ACC + RSI 50-62 + ADX>30 + Vol>2x + Score>8 → BUY HIGH
   B) [STAR] confirme + regime favorable → BUY HIGH
   Regime PRUDENT ou BAISSE : jamais BUY HIGH.

6. SORTIE OBLIGATOIRE :
   - Position <= -7% → SELL TOTAL immediat
   - Position >= +15% → SELL 60% (take profit partiel)
   - MACD passe BEAR + en position longue → SELL 50%
   - Score actif < -4 + en position → SELL total
   - Regime BAISSE SEVERE + position en profit → SELL 50% pour securiser

7. PYRAMIDING : position +10% + MACD BULL↑ACC + ADX>30 + regime FAVORABLE → BUY LOW seulement

8. PRIORITE ACTIFS (selon regime) :
   Regime FAVORABLE : TIER1 (TQQQ/SOXL) → TIER2 (PLTR/MSTR) → TIER3 (BTC/SOL)
   Regime PRUDENT   : TIER3 crypto uniquement (BTC-USD, ETH-USD, SOL-USD)
   Regime BAISSE    : HOLD ou SELL. 0 BUY sauf crypto Score>8.

9. ML LEARNING : [STAR] = priorite maximale. [EVITE] = eviter absolument.

10. CONCENTRATION : max {max_open} positions. Vendre la moins performante si plein.

11. REGLES VIX :
    VIX < 20 → sizing complet, leveraged OK
    VIX 20-25 → sizing MEDIUM max, crypto preferred
    VIX 25-30 → LOW uniquement, crypto seulement
    VIX > 30 → HOLD total sauf SELL positions en pertes
    VIX > 40 → SELL tout, garder 100% cash

12. CIRCUIT BREAKER : SPY < -5% → 0 BUY actions US. Crypto Score>8 seulement.

13. DIVERSIFICATION OBLIGATOIRE :
    - JAMAIS 2 ETF leveraged simultanément (ex: SOXL+SPXL, TQQQ+SOXL) — corrélation ~1 = risque doublé sans bénéfice.
    - Si 3+ positions ouvertes et aucune crypto : prochain BUY = BTC-USD ou ETH-USD (décorrélation).
    - Si SOXL déjà en portefeuille → pas de SPXL ni TQQQ ce cycle.
    - Objectif : mix décorrélé (ex: ETF leveraged + crypto + action tech individuelle).

FORMAT JSON STRICT :
{{
  "decisions": [
    {{
      "ticker": "BTC-USD",
      "action": "BUY",
      "confidence": "MEDIUM",
      "amount_usd": {max_medium:.0f},
      "risk_level": "MEDIUM",
      "rationale_fr": "BTC-USD : MACD BULL + RSI 52 + ADX 31 + Vol 2.1x + Score +7.1. Regime favorable crypto.",
      "rationale_en": "BTC-USD: MACD BULL + RSI 52 + ADX 31 + Vol 2.1x + Score +7.1. Favorable crypto regime."
    }}
  ],
  "market_summary_fr": "2 phrases : regime marche + opportunites concretes ce cycle.",
  "market_summary_en": "2 sentences: market regime + concrete opportunities this cycle."
}}"""


# ── Parser ────────────────────────────────────────────────────────────────────
def _parse(raw: str) -> tuple[list[BotDecision], str, str]:
    decisions = []
    market_fr = "Analyse en cours..."
    market_en = "Analysis in progress..."
    try:
        clean = raw.strip()
        # Gestion robuste des blocs markdown : ```json ... ``` ou ``` ... ```
        if "```" in clean:
            import re
            # Essai 1 : extraire le JSON entre les backticks
            m = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', clean, re.IGNORECASE)
            if m:
                clean = m.group(1)
            else:
                # Essai 2 : retirer toutes les lignes avec backticks
                clean = "\n".join(l for l in clean.split("\n") if not l.strip().startswith("```"))
        data = json.loads(clean.strip())
        market_fr = data.get("market_summary_fr", market_fr)
        market_en = data.get("market_summary_en", market_en)
        for d in data.get("decisions", []):
            action = d.get("action", "HOLD").upper()
            if action not in ("BUY", "SELL", "HOLD"):
                continue
            amount = float(d.get("amount_usd", 200))
            amount = max(50.0, min(amount, 3000.0))  # clamp v4 — min $50, max $3000
            decisions.append(BotDecision(
                ticker=d.get("ticker", ""),
                action=action,
                confidence=d.get("confidence", "MEDIUM"),
                amount_usd=amount,
                rationale_fr=d.get("rationale_fr", ""),
                rationale_en=d.get("rationale_en", ""),
                risk_level=d.get("risk_level", "MEDIUM"),
            ))
    except Exception as e:
        logger.error(f"Parse error: {e}\nRaw: {raw[:500]}")
    return decisions, market_fr, market_en


# ── Point d'entrée ────────────────────────────────────────────────────────────
def run_bot_brain(
    assets: list[ScreenedAsset],
    db_session,
    current_positions: dict,
    market_context: dict | None = None,
    evite_tickers: set | None = None,
) -> tuple[list[BotDecision], str, str]:
    if not assets:
        return [], "Aucun actif éligible.", "No eligible assets."

    ml_context = _build_ml_context(db_session)
    prompt     = _build_prompt(
        assets, ml_context, current_positions,
        market_context or {},
        evite_tickers=evite_tickers or set(),
    )

    logger.info(f"Bot brain: appel IA ({len(prompt)} chars)...")
    raw = _safe_generate(prompt)

    if not raw:
        logger.error("Bot brain: LLM n'a rien retourné (Gemini + Groq tous les deux ont échoué).")
        return [], "Erreur connexion IA.", "AI connection error."

    logger.debug(f"Bot brain raw LLM response (500c): {raw[:500]}")

    decisions, market_fr, market_en = _parse(raw)

    # Retry parsing si market_fr est encore "Analyse en cours..." (parse a probablement échoué)
    if market_fr == "Analyse en cours..." and len(decisions) == 0:
        logger.warning(f"Parse a peut-être échoué — raw LLM (200c): {raw[:200]!r}")
        # Tentative de trouver le JSON brut dans la réponse
        import re
        json_match = re.search(r'\{[\s\S]*"decisions"[\s\S]*\}', raw)
        if json_match:
            decisions, market_fr, market_en = _parse(json_match.group(0))
            logger.info(f"Retry parse: {len(decisions)} décisions trouvées")

    logger.info(f"Bot brain: {len(decisions)} décisions — {[(d.ticker, d.action, d.amount_usd) for d in decisions]}")
    return decisions, market_fr, market_en
