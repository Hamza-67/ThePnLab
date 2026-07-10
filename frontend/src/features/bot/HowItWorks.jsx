import { Card } from '../../components/ui'
import { useT } from '../../context/LangContext'

/** Explication pédagogique du bot v6 — cycles horaires, monitor TP/SL, garde-fous. */
export default function HowItWorks() {
  const t = useT()

  const STEPS = [
    {
      icon: '🕐',
      title: t('1 cycle par heure', '1 cycle per hour'),
      text: t(
        "Toutes les heures (9h-22h Paris en semaine, crypto 24/7 le weekend), le bot scanne 50+ actifs : RSI, MACD, ADX, volume, momentum. Il dort de 0h à 7h.",
        'Every hour (9am-10pm Paris on weekdays, crypto 24/7 on weekends), the bot scans 50+ assets: RSI, MACD, ADX, volume, momentum. It sleeps from midnight to 7am.'
      ),
    },
    {
      icon: '🧠',
      title: t('Décision par LLM', 'LLM decision'),
      text: t(
        "Les 12 meilleurs actifs + le contexte macro (SPY, VIX, news) sont envoyés à Gemini 2.0 Flash (fallback Mistral). Le modèle répond en JSON : acheter, vendre ou attendre, avec un niveau de confiance.",
        'The top 12 assets + macro context (SPY, VIX, news) are sent to Gemini 2.0 Flash (Mistral fallback). The model replies in JSON: buy, sell or hold, with a confidence level.'
      ),
    },
    {
      icon: '🛡️',
      title: t('5 garde-fous en dur', '5 hard guards'),
      text: t(
        "Chaque décision passe une cascade de filtres codés (pas des consignes de prompt) : tickers bannis par le ML, hallucinations, circuit breaker SPY -5%, panic VIX > 40, et veto régime — aucun achat d'action US si SPY < SMA50.",
        'Every decision goes through a cascade of coded filters (not prompt hints): ML-banned tickers, hallucinations, SPY -5% circuit breaker, VIX > 40 panic, and regime veto — no US equity buys when SPY < SMA50.'
      ),
    },
    {
      icon: '⏱️',
      title: t('Monitor TP/SL toutes les 10 min', 'TP/SL monitor every 10 min'),
      text: t(
        "Entre deux cycles, un thread léger surveille les positions (prix uniquement, pas de LLM) : take profit à +15% (vente 60%), stop loss à -7% (vente totale). Fini les ETF 3x qui dérivent à -25%.",
        'Between cycles, a lightweight thread watches positions (price only, no LLM): take profit at +15% (sell 60%), stop loss at -7% (sell all). No more 3x ETFs drifting to -25%.'
      ),
    },
    {
      icon: '📊',
      title: t('Apprentissage sur ses trades', 'Learns from its trades'),
      text: t(
        "Le win rate réel par actif est réinjecté à chaque cycle : les actifs perdants (WR < 35% ou 4 pertes de suite) sont exclus du screener. Chaque achat logge aussi ses indicateurs techniques — dataset pour un futur modèle ML.",
        'Real win rate per asset is fed back each cycle: losing assets (WR < 35% or 4 straight losses) are excluded from the screener. Every buy also logs its technical indicators — dataset for a future ML model.'
      ),
    },
    {
      icon: '💼',
      title: t('Spot uniquement, sizing prudent', 'Spot only, careful sizing'),
      text: t(
        "Le bot ne trade qu'au comptant (pas de levier), max 4 positions, 15% du portfolio max par position, 20% de cash de réserve. Positions réduites automatiquement quand le VIX monte.",
        'The bot trades spot only (no leverage), max 4 positions, max 15% of portfolio per position, 20% cash reserve. Positions are automatically reduced when VIX rises.'
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {STEPS.map((s, i) => (
        <Card key={i} className="flex gap-4 items-start">
          <div className="text-2xl shrink-0">{s.icon}</div>
          <div>
            <div className="font-title font-bold text-white text-sm mb-1">{s.title}</div>
            <p className="text-white/45 text-sm leading-relaxed m-0">{s.text}</p>
          </div>
        </Card>
      ))}
      <div className="px-4 py-3 rounded-xl bg-gold/5 border border-gold/20 text-xs text-gold/80 leading-relaxed">
        ⚠️ {t(
          "Simulation uniquement — aucun argent réel. Les décisions du bot sont éducatives et ne constituent pas un conseil financier.",
          'Simulation only — no real money. Bot decisions are educational and not financial advice.'
        )}
      </div>
    </div>
  )
}
