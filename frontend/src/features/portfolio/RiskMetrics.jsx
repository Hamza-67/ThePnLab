import { useQuery } from '@tanstack/react-query'
import API from '../../api/client'
import { useT } from '../../context/LangContext'

/** 4 métriques de risque (Sharpe, volatilité, max drawdown, rendement) —
 *  calculées côté backend sur les snapshots d'équité quotidiens. */
export default function RiskMetrics({ pf = 'USER' }) {
  const t = useT()
  const { data } = useQuery({
    queryKey: ['pf-metrics', pf],
    queryFn: () => API.get(`/api/portfolio/metrics?portfolio=${pf}`).then(r => r.data),
    refetchInterval: 5 * 60_000,
  })

  if (data?.status !== 'ok') return null   // pas assez d'historique → on n'affiche rien

  const METRICS = [
    {
      label: 'Sharpe',
      val: data.sharpe,
      color: data.sharpe >= 1 ? '#10B981' : data.sharpe >= 0 ? '#F59E0B' : '#EF4444',
      hint: t('Rendement ajusté du risque (annualisé, >1 = bon)', 'Risk-adjusted return (annualized, >1 = good)'),
    },
    {
      label: t('Volatilité', 'Volatility'),
      val: `${data.volatility_pct}%`,
      color: data.volatility_pct < 20 ? '#10B981' : data.volatility_pct < 40 ? '#F59E0B' : '#EF4444',
      hint: t('Écart-type des rendements journaliers, annualisé', 'Std dev of daily returns, annualized'),
    },
    {
      label: 'Max Drawdown',
      val: `−${data.max_drawdown_pct}%`,
      color: data.max_drawdown_pct < 10 ? '#10B981' : data.max_drawdown_pct < 25 ? '#F59E0B' : '#EF4444',
      hint: t('Pire chute depuis un sommet', 'Worst peak-to-trough decline'),
    },
    {
      label: t('Rendement', 'Return'),
      val: `${data.total_return_pct >= 0 ? '+' : ''}${data.total_return_pct}%`,
      color: data.total_return_pct >= 0 ? '#10B981' : '#EF4444',
      hint: t(`Depuis le début (${data.days} jours)`, `Since inception (${data.days} days)`),
    },
  ]

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
        📐 {t('Métriques de risque', 'Risk metrics')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        {METRICS.map((m, i) => (
          <div key={i} title={m.hint} style={{ textAlign: 'center', cursor: 'help' }}>
            <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 }}>{m.label}</div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, color: m.color, fontSize: '1.05rem' }}>{m.val}</div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', marginTop: 3, lineHeight: 1.3 }}>{m.hint}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
