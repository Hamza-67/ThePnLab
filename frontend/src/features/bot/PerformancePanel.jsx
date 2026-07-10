import { Card, StatBox, EmptyState } from '../../components/ui'
import { useT } from '../../context/LangContext'
import { useBotPerf } from './useBotData'

/** Performance 30j : win rate, P&L, breakdown par actif, derniers trades. */
export default function PerformancePanel() {
  const t = useT()
  const { data: perf } = useBotPerf()

  if (perf?.status !== 'ok') {
    return (
      <EmptyState
        icon="📊"
        title={t("Pas encore de données de performance", 'No performance data yet')}
        subtitle={t('Le bot a besoin de quelques cycles pour générer des statistiques.', 'The bot needs a few cycles to generate stats.')}
      />
    )
  }

  const wrOk = perf.win_rate_pct >= 50
  const pnlOk = perf.total_pnl >= 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Win Rate" value={`${perf.win_rate_pct}%`} tone={wrOk ? 'green' : 'red'} />
          <StatBox label={t('P&L Total (30j)', 'Total P&L (30d)')} value={`${pnlOk ? '+' : ''}$${perf.total_pnl?.toFixed(2)}`} tone={pnlOk ? 'green' : 'red'} />
          <StatBox label={t('Trades', 'Trades')} value={perf.total_trades} sub={`${perf.wins}W · ${perf.losses}L`} />
        </div>
      </Card>

      {perf.by_ticker && Object.keys(perf.by_ticker).length > 0 && (
        <Card>
          <div className="text-xs text-white/35 uppercase tracking-wider mb-3">
            {t('Détail par actif (30j)', 'Per-asset breakdown (30d)')}
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(perf.by_ticker)
              .sort((a, b) => b[1].pnl - a[1].pnl)
              .map(([ticker, s]) => (
                <div key={ticker} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-border-soft">
                  <span className="font-mono font-bold text-white text-sm">{ticker}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-white/40 font-mono">
                      {s.wins}W/{s.losses}L · WR {s.win_rate}%
                      {s.win_rate >= 65 && s.pnl > 0 && <span className="text-green ml-1.5">⭐</span>}
                      {s.win_rate < 35 && <span className="text-red ml-1.5">⚠ {t('ÉVITÉ', 'BANNED')}</span>}
                    </span>
                    <span className={`font-mono font-bold ${s.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                      {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
          <p className="text-xs text-white/30 leading-relaxed mt-3 mb-0">
            🧠 {t(
              'Ces stats sont réinjectées dans le LLM à chaque cycle. Les actifs ⚠ (WR < 35% ou 4 pertes consécutives) sont exclus en dur du screener.',
              'These stats are fed back into the LLM each cycle. ⚠ assets (WR < 35% or 4 consecutive losses) are hard-excluded from the screener.'
            )}
          </p>
        </Card>
      )}

      {perf.recent_trades?.length > 0 && (
        <Card>
          <div className="text-xs text-white/35 uppercase tracking-wider mb-3">
            {t('Derniers trades', 'Recent trades')}
          </div>
          <div className="flex flex-col gap-1">
            {perf.recent_trades.slice(0, 8).map((tr, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-white/[0.02] text-xs font-mono">
                <span className={`font-bold w-9 ${tr.side === 'BUY' ? 'text-green' : 'text-red'}`}>{tr.side}</span>
                <span className="text-white font-semibold w-20">{tr.ticker}</span>
                <span className="text-white/40">${tr.price}</span>
                <span className="text-white/25 ml-auto">{tr.date?.slice(0, 16)}</span>
                {tr.pnl !== null && tr.pnl !== undefined && (
                  <span className={`font-bold w-16 text-right ${tr.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                    {tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
