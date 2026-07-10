# ThePnLab

Plateforme de paper trading que je développe pendant mes études pour apprendre la finance de marché en pratiquant — sans risquer un centime. Chaque utilisateur démarre avec un capital fictif de 10 000 $ et trade sur des données de marché réelles (actions US, CAC 40, crypto, ETF). Un bot IA trade en parallèle sur son propre portefeuille : le but est de le battre.

**100 % simulation — aucun ordre réel n'est passé.**

Le site est en ligne : [www.thepnlab.com](https://www.thepnlab.com)

## Fonctionnalités

- **Marché** : graphiques temps réel (TradingView / Lightweight Charts), indicateurs techniques (RSI, MACD, SMA), passage d'ordres au comptant
- **CFD & Futures** *(v2)* : positions long/short avec levier, marge, prix de liquidation, frais de financement overnight — pour comprendre les produits dérivés sans se ruiner
- **Bot IA** : un agent autonome qui analyse ~55 actifs toutes les heures (screener technique + LLM), avec take-profit / stop-loss automatiques et gestion du risque par régime de marché (VIX, SPY)
- **Coach IA** : un assistant qui répond aux questions sur l'analyse technique du ticker affiché
- **Académie** : 13 cours (débutant → expert) avec quiz — du carnet d'ordres à la VaR
- **Classement** : leaderboard entre étudiants, par école
- **News macro** : flux d'actualités avec score de risque

## Stack

| Côté | Techno | Hébergement |
|---|---|---|
| Frontend | React 19 + Vite 7 + Tailwind 4 | Vercel |
| Backend | FastAPI (Python) + SQLAlchemy | Railway |
| Base de données | PostgreSQL | Railway |
| Données marché | yfinance + CoinGecko | — |
| IA | Gemini 2.0 Flash (primaire), Mistral (fallback) | — |

## Lancer en local

Backend :

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend (dans un autre terminal) :

```bash
cd frontend
npm install
npm run dev
```

Le front tourne sur `http://localhost:5173` et proxifie `/api` vers le backend sur le port 8000. En local, la base est un simple fichier SQLite créé automatiquement.

## Variables d'environnement (backend)

| Variable | Rôle | Obligatoire |
|---|---|---|
| `SECRET_KEY` | Signature des JWT | Oui en prod |
| `DATABASE_URL` | PostgreSQL (sinon SQLite local) | Non |
| `GEMINI_KEY` | Décisions du bot + coach | Pour le bot |
| `MISTRAL_KEY` | Fallback LLM si Gemini échoue | Non |
| `NEWSAPI_KEY` | News macro | Non |
| `ALLOWED_ORIGINS` | CORS | Non (défaut localhost + prod) |
| `QUIET_HOURS` | Pause du bot la nuit (ex: `0-7`) | Non |
| `MAINTENANCE_MODE` | `1` = affiche la page maintenance | Non |

## Structure

```
backend/
  app/
    main.py          # FastAPI app + CORS + middleware
    routers/         # auth, portfolio, market, bot, coach, news...
    bot/             # moteur du bot IA (pricing, exécution, cycles, scheduler)
    services/        # données marché, marge/liquidation, utilitaires
    models/          # ORM SQLAlchemy
  tests/             # pytest
frontend/
  src/
    pages/           # Dashboard, Landing, Academy...
    features/        # composants par onglet (market, portfolio, bot...)
    components/ui/   # kit UI réutilisable
```

## Notes de conception

- Pas d'Alembic : les migrations se font via de petits scripts SQL idempotents dans `backend/migrations/` — suffisant à cette échelle.
- Pas de WebSockets : du polling avec cache côté serveur suffit largement pour un usage pédagogique, et ça évite les connexions persistantes (coût Railway).
- Le bot reste spot-only : lui donner accès au levier multiplierait la surface de risque pour zéro valeur pédagogique.

---

## English summary

ThePnLab is an educational paper-trading platform I'm building during my engineering studies. Users trade a fictional $10k portfolio on real market data (US stocks, CAC 40, crypto, ETFs, and CFD/Futures with leverage and margin in v2), while an autonomous AI bot trades its own portfolio — beat the bot is the game. Stack: React 19 / FastAPI / PostgreSQL, deployed on Vercel + Railway. The bot screens ~55 assets hourly with technical indicators, delegates final decisions to an LLM (Gemini, Mistral fallback), and enforces hard risk rules in code (TP/SL loop, VIX panic mode, market-regime filter). 100% simulated — no real orders.
