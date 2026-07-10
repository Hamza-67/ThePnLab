"""
cycle.py — cycle principal du bot : contexte macro, screener, TP/SL forcés,
décisions IA, safety filters post-LLM, exécution multi-portfolios, snapshots.
"""
from __future__ import annotations

import logging
import threading as _threading
import time as _time
from datetime import datetime
from typing import Optional
from concurrent.futures import ThreadPoolExecutor as _TPE

import yfinance as yf
import pandas as pd

from app.database import SessionLocal
from app.models.portfolio import Portfolio, Position, Trade
from app.bot.brain import run_bot_brain, BotDecision
from app.bot.screener import run_screener, _fetch_single
from app.bot.logger import save_bot_cycle, BotCycleLog
from app.bot import state
from app.bot.params import (
    PARIS_TZ, NY_TZ, BOT_PORTFOLIO_NAME, CRYPTO_TICKERS, NEVER_BAN_TICKERS,
    LEVERAGED_ETFS, SPY_DROP_THRESHOLD, VIX_HIGH_THRESHOLD, VIX_EXTREME,
    TP_THRESHOLD, SL_THRESHOLD, MAX_OPEN_POSITIONS,
)
from app.bot.pricing import _get_price, clear_price_cache
from app.bot.execution import _execute, _snapshot, _get_positions_performance

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# CHECK MARCHÉ OUVERT
# ═══════════════════════════════════════════════════════════════════════════════

def _is_market_open() -> tuple[bool, str]:
    """
    Crypto : 24h/7j.
    EU (Euronext) : lun-ven 9h00-17h30 CET.
    US (NYSE) : lun-ven 9h30-16h00 ET.
    Retourne toujours True — crypto toujours tradable.
    """
    now_paris = datetime.now(PARIS_TZ)
    now_ny    = datetime.now(NY_TZ)
    weekday   = now_paris.weekday()

    if weekday >= 5:
        day_name = "samedi" if weekday == 5 else "dimanche"
        return True, f"Weekend ({day_name}) — Crypto 24/7 actif"

    eu_open  = now_paris.replace(hour=9,  minute=0,  second=0, microsecond=0)
    eu_close = now_paris.replace(hour=17, minute=30, second=0, microsecond=0)
    eu_ok    = eu_open <= now_paris <= eu_close

    us_open  = now_ny.replace(hour=9,  minute=30, second=0, microsecond=0)
    us_close = now_ny.replace(hour=16, minute=0,  second=0, microsecond=0)
    us_ok    = us_open <= now_ny <= us_close

    markets = ["Crypto 24/7"]
    if eu_ok: markets.append(f"Euronext {now_paris.strftime('%H:%M')} CET")
    if us_ok: markets.append(f"NYSE {now_ny.strftime('%H:%M')} ET")

    return True, f"Ouvert : {', '.join(markets)}"


def _get_tradable_tickers(tickers: list[str]) -> list[str]:
    """Filtre les tickers tradables selon l'heure — crypto toujours OK."""
    now_paris = datetime.now(PARIS_TZ)
    now_ny    = datetime.now(NY_TZ)
    weekday   = now_paris.weekday()

    eu_ok = us_ok = False
    if weekday < 5:
        eu_open  = now_paris.replace(hour=9,  minute=0,  second=0, microsecond=0)
        eu_close = now_paris.replace(hour=17, minute=30, second=0, microsecond=0)
        eu_ok    = eu_open <= now_paris <= eu_close
        us_open  = now_ny.replace(hour=9,  minute=30, second=0, microsecond=0)
        us_close = now_ny.replace(hour=16, minute=0,  second=0, microsecond=0)
        us_ok    = us_open <= now_ny <= us_close

    result = []
    for t in tickers:
        if t in CRYPTO_TICKERS or "=F" in t:
            result.append(t)          # 24/7
        elif t.endswith(".PA") or t.endswith(".AS") or t.endswith(".DE"):
            if eu_ok: result.append(t)
        else:
            if us_ok: result.append(t)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# MARKET CONTEXT
# ═══════════════════════════════════════════════════════════════════════════════

def _get_spy_data() -> tuple[Optional[float], Optional[bool]]:
    """
    Un seul download SPY 3 mois → (variation journalière, close > SMA50).
    Le régime SMA50 sert de filtre HARD : sous la SMA50, on n'achète plus
    d'actions US ni d'ETF leveraged (le bot a perdu -$250 en achetant
    des dips dans un marché baissier).
    """
    try:
        df = yf.download("SPY", period="3mo", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or len(df) < 2:
            return None, None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        closes = df["Close"].dropna()
        change = (float(closes.iloc[-1]) - float(closes.iloc[-2])) / float(closes.iloc[-2])
        above_sma50 = None
        if len(closes) >= 50:
            sma50 = float(closes.rolling(50).mean().iloc[-1])
            above_sma50 = float(closes.iloc[-1]) > sma50
        return round(change, 4), above_sma50
    except Exception as e:
        logger.warning(f"SPY fetch error: {e}")
        return None, None


def _get_vix() -> Optional[float]:
    try:
        df = yf.download("^VIX", period="5d", interval="1d", progress=False, auto_adjust=True, timeout=8)
        if df is None or df.empty:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return float(df["Close"].dropna().iloc[-1])
    except Exception as e:
        logger.warning(f"VIX fetch error: {e}")
        return None


def _get_evite_tickers(db) -> set[str]:
    """
    Calcule dynamiquement les tickers à bannir selon la performance ML réelle.
    Critère de ban automatique (ANY satisfait) :
      A) WR < 35% sur >= 8 trades SELL BOT
      B) 4 derniers trades consécutifs tous en perte (revenge-trading guard)
    Ces tickers sont EXCLUS de tout cycle — même le force-crypto 24/7 est bloqué.
    Ce n'est PAS une soft rule (prompt) — c'est une HARD exclusion en code.
    """
    try:
        rows = db.query(Trade.ticker, Trade.profit, Trade.id).filter(
            Trade.actor == "BOT",
            Trade.side == "SELL",
        ).order_by(Trade.id.asc()).all()

        # Agrège les stats par ticker
        stats: dict[str, dict] = {}
        for row in rows:
            t = row.ticker
            if t not in stats:
                stats[t] = {"wins": 0, "total": 0, "recent": []}
            stats[t]["total"] += 1
            profit = float(row.profit or 0)
            if profit > 0:
                stats[t]["wins"] += 1
                stats[t]["recent"].append(True)
            else:
                stats[t]["recent"].append(False)

        evite: set[str] = set()
        for ticker, s in stats.items():
            # BTC-USD et ETH-USD ne sont jamais bannis — dernier recours 24/7
            if ticker in NEVER_BAN_TICKERS:
                continue

            total = s["total"]
            wins  = s["wins"]
            recent = s["recent"]

            # Critère A : WR < 35% sur >= 8 trades (était 5 — trop rapide à bannir)
            if total >= 8 and (wins / total) < 0.35:
                evite.add(ticker)
                logger.warning(
                    f"[ML-BAN] {ticker} — WR={wins}/{total}={wins/total*100:.0f}% < 35% "
                    f"→ exclu du cycle"
                )
                continue

            # Critère B : 4 derniers trades consécutifs en perte (était 3)
            if len(recent) >= 4 and not any(recent[-4:]):
                evite.add(ticker)
                logger.warning(
                    f"[ML-BAN] {ticker} — 4 pertes consécutives récentes → exclu du cycle"
                )

        return evite
    except Exception as e:
        logger.warning(f"_get_evite_tickers error: {e}")
        return set()


def _get_position_multiplier(vix: Optional[float]) -> tuple[float, str]:
    if vix is None:
        return 1.0, "VIX indisponible"
    if vix >= VIX_EXTREME:
        return 0.35, f"VIX extrême {vix:.1f} — positions réduites à 35%"
    if vix >= VIX_HIGH_THRESHOLD:
        return 0.65, f"VIX élevé {vix:.1f} — positions réduites à 65%"
    return 1.0, f"VIX normal {vix:.1f}"


def _get_macro_news(limit: int = 8) -> str:
    """Récupère les news macro directement via NewsAPI."""
    try:
        import requests as _req
        from app.config import NEWSAPI_KEY
        if not NEWSAPI_KEY:
            return "News non disponibles (clé manquante)."
        query = (
            '(Fed OR ECB OR inflation OR recession OR GDP OR "interest rates" '
            'OR oil OR OPEC OR sanctions OR war OR tariffs OR earnings) '
            'AND (market OR stocks OR bonds OR commodities)'
        )
        r = _req.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": limit,
                "apiKey": NEWSAPI_KEY,
            },
            timeout=8,
        )
        if r.status_code != 200:
            return "News non disponibles."
        articles = r.json().get("articles", []) or []
        if not articles:
            return "Aucune news disponible."
        lines = []
        for a in articles[:limit]:
            title  = (a.get("title") or "").strip()
            source = ((a.get("source") or {}).get("name") or "")
            if title and "[Removed]" not in title:
                lines.append(f"  * [{source}] {title}")
        return "NEWS MACRO RECENTES :\n" + "\n".join(lines) if lines else "Aucune news disponible."
    except Exception as e:
        logger.warning(f"News fetch error: {e}")
        return "News non disponibles (erreur reseau)."


# ═══════════════════════════════════════════════════════════════════════════════
# CYCLE PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

def run_bot_cycle() -> BotCycleLog:
    if not state.try_start_cycle():
        logger.warning("Bot cycle already running — skipping duplicate trigger")
        return BotCycleLog(
            timestamp=datetime.now(PARIS_TZ).isoformat(),
            decisions=[],
            market_summary_fr="Cycle déjà en cours — ignoré",
            market_summary_en="Cycle already running — skipped",
            users_processed=0,
            total_trades=0,
            screened_assets=[],
            errors=["duplicate_trigger"],
        )

    # ── HARD TIMEOUT GUARD : force reset _bot_running après 3 min max ─────────
    # Protège contre tout hang résiduel (yfinance, API IA, DB) quel que soit
    # l'endroit du cycle. Garantit que le flag revient à False en < 3 min.
    def _force_reset_flag():
        logger.error("BOT CYCLE FORCE TIMEOUT (3min) — resetting _bot_running flag")
        state.end_cycle()

    _hard_timeout = _threading.Timer(180, _force_reset_flag)
    _hard_timeout.daemon = True
    _hard_timeout.start()

    # Vider le cache prix — on veut des prix frais pour ce cycle
    clear_price_cache()
    _cycle_start = _time.monotonic()

    now = datetime.now(PARIS_TZ)
    logger.info(f"=== BOT CYCLE START {now.isoformat()} ===")

    db = None
    cycle_log = BotCycleLog(
        timestamp=now.isoformat(),
        decisions=[],
        market_summary_fr="",
        market_summary_en="",
        spy_change=None,
        vix=None,
        macro_news="",
        users_processed=0,
        total_trades=0,
        screened_assets=[],
        portfolio_value_before=None,
        portfolio_value_after=None,
        cycle_duration_s=None,
        errors=[],
    )

    try:
        db = SessionLocal()

        # 0. Statut marchés
        market_open, market_status = _is_market_open()
        logger.info(f"Market status: {market_status}")

        # 1+2+3. SPY + VIX + News en PARALLÈLE (étaient séquentiels = 15-30s de perdu)
        # IMPORTANT : PAS de `with _TPE() as ...:` — __exit__ appelle shutdown(wait=True)
        # ce qui BLOQUE si un thread yfinance est pendu. On utilise shutdown(wait=False).
        logger.info("Fetching SPY/VIX/News in parallel...")
        _ex_macro = _TPE(max_workers=3)
        _spy_fut  = _ex_macro.submit(_get_spy_data)
        _vix_fut  = _ex_macro.submit(_get_vix)
        _news_fut = _ex_macro.submit(_get_macro_news, 8)
        try:
            spy_change, spy_above_sma50 = _spy_fut.result(timeout=20)
        except Exception:
            spy_change, spy_above_sma50 = None, None
        try:
            vix = _vix_fut.result(timeout=20)
        except Exception:
            vix = None
        try:
            macro_news = _news_fut.result(timeout=15)
        except Exception:
            macro_news = "News non disponibles."
        _ex_macro.shutdown(wait=False)  # CRITIQUE : libère sans attendre les threads pendants
        cycle_log.spy_change = spy_change
        cycle_log.vix = vix
        cycle_log.macro_news = (macro_news or "")[:2000]

        if spy_change is not None and spy_change <= SPY_DROP_THRESHOLD:
            msg = f"Circuit breaker — SPY {spy_change*100:.1f}% aujourd'hui. Aucun trade actions US."
            logger.warning(msg)
            cycle_log.errors.append(msg)

        position_multiplier, vix_reason = _get_position_multiplier(vix)

        # 4a. ── ML BLACKLIST — tickers bannis selon performance réelle ──────────
        # HARD exclusion avant tout : ni screener, ni LLM, ni force-crypto
        # ne peut contourner ce filtre. Basé sur WR réel en DB.
        evite_tickers = _get_evite_tickers(db)
        if evite_tickers:
            logger.warning(f"[ML-BAN] {len(evite_tickers)} ticker(s) exclus ce cycle: {evite_tickers}")

        # 4b. Screener — filtre par marché ouvert
        # top_n=15 pour avoir un pool assez large
        assets_all = run_screener(top_n=15)
        # Appliquer le blacklist ML dès la sortie du screener
        assets_all = [a for a in assets_all if a.ticker not in evite_tickers]
        tradable   = set(_get_tradable_tickers([a.ticker for a in assets_all]))

        # Si circuit breaker SPY, exclure les actions US mais garder crypto + EU
        if spy_change is not None and spy_change <= SPY_DROP_THRESHOLD:
            tradable = {t for t in tradable if t in CRYPTO_TICKERS or t.endswith(".PA")}
            logger.info(f"Circuit breaker actif — restriction à crypto+EU: {tradable}")

        assets = [a for a in assets_all if a.ticker in tradable]

        # ── Garantie crypto 24/7 (sauf actifs bannis) ────────────────────────
        # Toujours garder au moins 3 crypto dans le pool — elles sont 24/7 et
        # évitent que le bot soit bloqué hors heures de marché US/EU.
        # SAUF si ML-banni (pertes confirmées → on ne force jamais un banni).
        crypto_in_assets = {a.ticker for a in assets if a.ticker in CRYPTO_TICKERS}
        if len(crypto_in_assets) < 3:
            # Priorité : BTC → ETH → SOL → XRP (liquidité décroissante)
            safe_crypto = [ct for ct in ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"]
                           if ct not in evite_tickers]
            logger.info(f"Peu de crypto tradable ({len(crypto_in_assets)}/3) — ajout: {safe_crypto}")
            for ct in safe_crypto:
                if ct not in crypto_in_assets:
                    existing = next((a for a in assets_all if a.ticker == ct), None)
                    if existing:
                        assets.append(existing)
                        crypto_in_assets.add(ct)   # seulement si ajouté réellement
                    else:
                        ca = _fetch_single(ct)
                        if ca:
                            assets.append(ca)
                            crypto_in_assets.add(ct)   # seulement si fetch réussi
                if len(crypto_in_assets) >= 3:
                    break

        assets = assets[:12]
        cycle_log.screened_assets = [a.ticker for a in assets]
        logger.info(
            f"Screener: {len(assets_all)} actifs -> {len(assets)} tradables "
            f"({market_status}) | bannis={evite_tickers} | "
            f"crypto: {[a.ticker for a in assets if a.ticker in CRYPTO_TICKERS]}"
        )

        if not assets:
            cycle_log.market_summary_fr = f"Aucun actif tradable ({market_status})"
            cycle_log.market_summary_en = f"No tradable assets ({market_status})"
            save_bot_cycle(cycle_log)
            return cycle_log

        # 5. Positions + equity
        first_pf = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).first()
        current_positions: dict = {}
        positions_performance: list = []
        portfolio_equity = 10000.0

        if first_pf:
            current_positions = {
                p.ticker: float(p.quantity)
                for p in db.query(Position).filter(
                    Position.portfolio_id == first_pf.id, Position.quantity > 0
                ).all()
            }
            positions_performance = _get_positions_performance(db, first_pf)
            portfolio_equity = float(first_pf.cash) + sum(p["value_usd"] for p in positions_performance)
            cycle_log.portfolio_value_before = round(portfolio_equity, 2)

        # 5b. Strikes — skipped for speed (1y downloads trop lents, non essentiels)
        # Les indicateurs screener (RSI/MACD/ADX/momentum) suffisent pour Gemini.
        strikes_map: dict[str, dict] = {}

        # 5c. ─── STOP-LOSS & TAKE-PROFIT AUTOMATIQUES (avant l'IA) ───────────────
        # CRITIQUE : chaque portfolio est surveillé INDÉPENDAMMENT.
        # Bug précédent : seul first_pf était vérifié → les autres portfolios
        # pouvaient perdre bien au-delà du SL sans que rien ne se déclenche.
        all_pf_for_sltp = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).all()

        # VIX PANIC MODE : VIX > 40 → SELL TOTAL de toutes les positions immédiatement
        # Règle absolue : protéger le capital avant tout — plus de BUY tant que VIX > 40
        vix_panic = vix is not None and vix >= VIX_EXTREME

        # Collecte les décisions forcées PAR portfolio
        forced_by_pf: dict[int, list[BotDecision]] = {}
        all_forced_tickers: set[str] = set()

        for _pf in all_pf_for_sltp:
            _positions = _get_positions_performance(db, _pf)
            _pf_forced: list[BotDecision] = []
            for p in _positions:
                pnl_pct = p["pnl_pct"]
                ticker  = p["ticker"]

                if vix_panic:
                    # VIX > 40 : forcer SELL TOTAL de chaque position (capital protection)
                    _pf_forced.append(BotDecision(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 2,  # oversized → sells ALL
                        rationale_fr=f"VIX PANIC {vix:.1f} > 40 — SELL TOTAL pour protéger le capital",
                        rationale_en=f"VIX PANIC {vix:.1f} > 40 — SELL ALL to protect capital",
                        risk_level="HIGH",
                    ))
                    logger.warning(f"  [VIX-PANIC pf={_pf.id}] SELL ALL {ticker} (VIX={vix:.1f})")
                    all_forced_tickers.add(ticker)

                elif pnl_pct <= SL_THRESHOLD * 100:
                    _pf_forced.append(BotDecision(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 2,  # oversized → sells ALL
                        rationale_fr=f"STOP LOSS AUTO {pnl_pct:.1f}% — seuil {SL_THRESHOLD*100:.0f}% atteint",
                        rationale_en=f"AUTO STOP LOSS {pnl_pct:.1f}% — {SL_THRESHOLD*100:.0f}% threshold hit",
                        risk_level="HIGH",
                    ))
                    logger.warning(f"  [SL pf={_pf.id}] {ticker} @ {pnl_pct:.1f}%")
                    all_forced_tickers.add(ticker)

                elif pnl_pct >= TP_THRESHOLD * 100:
                    _pf_forced.append(BotDecision(
                        ticker=ticker, action="SELL", confidence="HIGH",
                        amount_usd=p["value_usd"] * 0.60,
                        rationale_fr=f"TAKE PROFIT AUTO +{pnl_pct:.1f}% — seuil +{TP_THRESHOLD*100:.0f}% atteint, vente 60%",
                        rationale_en=f"AUTO TAKE PROFIT +{pnl_pct:.1f}% — +{TP_THRESHOLD*100:.0f}% threshold, selling 60%",
                        risk_level="LOW",
                    ))
                    logger.info(f"  [TP pf={_pf.id}] {ticker} @ +{pnl_pct:.1f}%")
                    all_forced_tickers.add(ticker)

            forced_by_pf[_pf.id] = _pf_forced

        # Fetch les prix une seule fois pour tous les tickers concernés
        forced_prices: dict[str, float] = {}
        for t in all_forced_tickers:
            pr = _get_price(t)
            if pr:
                forced_prices[t] = pr

        # Exécute chaque décision forcée sur le portfolio CONCERNÉ (pas tous !)
        has_forced = any(v for v in forced_by_pf.values())
        if has_forced:
            for _pf in all_pf_for_sltp:
                for fd in forced_by_pf.get(_pf.id, []):
                    pr = forced_prices.get(fd.ticker)
                    if not pr:
                        logger.warning(f"  [FORCED] Prix indisponible pour {fd.ticker}")
                        continue
                    ok, msg = _execute(db, _pf, fd, pr, position_multiplier)
                    if ok:
                        logger.info(f"  [FORCED pf={_pf.id}] {msg}")
            db.commit()
            # Refresh first_pf pour le contexte LLM
            if first_pf:
                positions_performance = _get_positions_performance(db, first_pf)
                portfolio_equity = float(first_pf.cash) + sum(p["value_usd"] for p in positions_performance)

        # 5d. ── Limite positions simultanées (évite sur-diversification / sur-expo) ─
        n_open_positions = len([p for p in positions_performance if p["value_usd"] > 0])
        if n_open_positions >= MAX_OPEN_POSITIONS:
            logger.info(
                f"Positions ouvertes: {n_open_positions}/{MAX_OPEN_POSITIONS} — "
                f"BUY bloqués jusqu'à fermeture d'une position"
            )

        # 6. IA
        market_context = {
            "spy_change_pct":        round(spy_change * 100, 2) if spy_change else None,
            "spy_above_sma50":       spy_above_sma50,
            "vix":                   vix,
            "vix_regime":            vix_reason,
            "position_multiplier":   position_multiplier,
            "macro_news":            macro_news,
            "positions_performance": positions_performance,
            "portfolio_equity":      round(portfolio_equity, 2),
            "strikes":               strikes_map,
            "n_open_positions":      n_open_positions,
            "max_open_positions":    MAX_OPEN_POSITIONS,
        }

        decisions, market_fr, market_en = run_bot_brain(
            assets, db, current_positions,
            market_context=market_context,
            evite_tickers=evite_tickers,
        )

        # ── Post-LLM safety filters (cascade) ───────────────────────────────────
        screened_tickers = {a.ticker for a in assets}
        circuit_breaker_active = (
            spy_change is not None and spy_change <= SPY_DROP_THRESHOLD
        )
        pre_filter_count = len(decisions)
        filtered_decisions = []
        for d in decisions:
            if d.action == "BUY":
                # Guard 1 : tickers ML-bannis — jamais, quelles que soient les instructions LLM
                if d.ticker in evite_tickers:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — ML-ban (WR < 35% ou pertes consécutives)")
                    cycle_log.errors.append(f"ML-ban: BUY {d.ticker} bloqué post-LLM")
                    continue

                # Guard 2 : hallucination LLM — le ticker n'était pas dans les actifs screened
                # (le LLM peut inventer des tickers TIER1 comme TQQQ même si absent du screener)
                if d.ticker not in screened_tickers:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — ticker hors screener (hallucination LLM)")
                    cycle_log.errors.append(f"Hallucination: BUY {d.ticker} hors screener bloqué")
                    continue

                # Guard 3 : circuit breaker SPY — pas de BUY actions US
                if circuit_breaker_active:
                    is_us_stock = d.ticker not in CRYPTO_TICKERS and not d.ticker.endswith(".PA")
                    if is_us_stock:
                        logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — circuit breaker SPY actif")
                        cycle_log.errors.append(f"Circuit breaker: BUY {d.ticker} bloqué")
                        continue

                # Guard 4 : VIX > 40 — AUCUN BUY autorisé (panic mode, cash only)
                if vix_panic:
                    logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — VIX PANIC {vix:.1f} > 40 (mode cash)")
                    cycle_log.errors.append(f"VIX panic: BUY {d.ticker} bloqué (VIX={vix:.1f})")
                    continue

                # Guard 5 : régime baissier — SPY < SMA50 → veto BUY actions US
                # et ETF leveraged. Filtre HARD en code (pas une consigne prompt) :
                # acheter du momentum dans un downtrend est la cause des pertes v4/v5.
                if spy_above_sma50 is False:
                    is_us_equity = d.ticker not in CRYPTO_TICKERS and not d.ticker.endswith(".PA")
                    if is_us_equity or d.ticker in LEVERAGED_ETFS:
                        logger.warning(f"[POST-LLM] BUY {d.ticker} bloqué — régime baissier (SPY < SMA50)")
                        cycle_log.errors.append(f"regime_veto: BUY {d.ticker} bloqué (SPY < SMA50)")
                        continue

            filtered_decisions.append(d)

        decisions = filtered_decisions
        if len(decisions) < pre_filter_count:
            blocked = pre_filter_count - len(decisions)
            logger.warning(f"[POST-LLM] {blocked} décision(s) bloquées par les safety filters")

        # ── Si trop de positions ouvertes, bloquer les nouveaux BUY ─────────────
        if n_open_positions >= MAX_OPEN_POSITIONS:
            decisions = [d for d in decisions if d.action != "BUY"]
            logger.info("Max positions atteint — BUY ignorés ce cycle")
        cycle_log.market_summary_fr = market_fr
        cycle_log.market_summary_en = market_en

        if not decisions:
            save_bot_cycle(cycle_log)
            return cycle_log

        # 7. Prix
        prices = {}
        for d in decisions:
            if d.action in ("BUY", "SELL"):
                p = _get_price(d.ticker)
                if p:
                    prices[d.ticker] = p

        # 8. Exécution sur tous les portfolios IA
        all_pf = db.query(Portfolio).filter(Portfolio.name == BOT_PORTFOLIO_NAME).all()

        # Features techniques par ticker (dataset XGBoost) — capturées au BUY
        assets_by_ticker = {a.ticker: a for a in assets}
        regime = "UNKNOWN" if spy_above_sma50 is None else ("BULL" if spy_above_sma50 else "BEAR")

        for decision in decisions:
            if decision.action == "HOLD":
                continue
            price = prices.get(decision.ticker)
            if not price:
                cycle_log.errors.append(f"Prix indisponible: {decision.ticker}")
                continue

            features = None
            if decision.action == "BUY":
                a = assets_by_ticker.get(decision.ticker)
                if a:
                    features = {
                        "rsi":          a.rsi,
                        "macd_signal":  a.macd_signal,
                        "adx":          a.adx,
                        "atr_pct":      a.atr_pct,
                        "volume_surge": a.volume_surge,
                        "momentum_1d":  a.momentum_1d,
                        "momentum_5d":  a.momentum_5d,
                        "bb_position":  a.bb_position,
                        "above_sma50":  a.above_sma50,
                        "score":        a.score,
                        "vix":          vix,
                        "spy_change":   spy_change,
                        "regime":       regime,
                    }

            results = []
            for pf in all_pf:
                ok, msg = _execute(db, pf, decision, price, position_multiplier, features=features)
                if ok:
                    cycle_log.total_trades += 1
                    logger.info(f"  [{pf.id}] {msg}")
                results.append({"portfolio_id": pf.id, "ok": ok, "msg": msg})

            pos_perf = next((p for p in positions_performance if p["ticker"] == decision.ticker), None)
            cycle_log.decisions.append({
                "ticker":           decision.ticker,
                "action":           decision.action,
                "price":            price,
                "amount_usd":       decision.amount_usd,
                "confidence":       decision.confidence,
                "risk_level":       decision.risk_level,
                "rationale_fr":     decision.rationale_fr,
                "rationale_en":     decision.rationale_en,
                "executed_on":      sum(1 for r in results if r["ok"]),
                "total_portfolios": len(all_pf),
                "position_mult":    position_multiplier,
                "vix":              vix,
                "position_before":  pos_perf,
                "strikes":          strikes_map.get(decision.ticker),
            })

        # 9. Snapshots
        for pf in all_pf:
            _snapshot(db, pf)

        cycle_log.users_processed = len(all_pf)
        db.commit()
        logger.info(f"=== BOT CYCLE END — {cycle_log.total_trades} trades ===")

        # Recalculate portfolio value after execution
        if first_pf:
            try:
                db.refresh(first_pf)
                pos_after = db.query(Position).filter(
                    Position.portfolio_id == first_pf.id, Position.quantity > 0
                ).all()
                equity_after = float(first_pf.cash) + sum(
                    (_get_price(p.ticker) or float(p.avg_price)) * float(p.quantity)
                    for p in pos_after
                )
                cycle_log.portfolio_value_after = round(equity_after, 2)
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Bot cycle error: {e}", exc_info=True)
        cycle_log.errors.append(str(e))
        try:
            if db:
                db.rollback()
        except Exception:
            pass
    finally:
        cycle_log.cycle_duration_s = round(_time.monotonic() - _cycle_start, 1)
        _hard_timeout.cancel()  # cycle terminé normalement — annuler le timer de force-reset
        try:
            if db:
                db.close()
        except Exception:
            pass
        state.end_cycle()

    save_bot_cycle(cycle_log)
    return cycle_log
