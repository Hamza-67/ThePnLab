import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import API from '../../api/client'
import { useT } from '../../context/LangContext'
import useIsMobile from '../../lib/useIsMobile'
import RiskMetrics from './RiskMetrics'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

/* ══════════════════════════════════════════
   EQUITY CHART
══════════════════════════════════════════ */
function EquityChart({ userSeries, botSeries }) {
  const t = useT()
  const STARTING_EQUITY = 10000

  // Build maps from date → equity
  // Backend guarantees: $10k anchor before first real data + live today point
  const userMap = {}
  const aiMap   = {}
  userSeries?.forEach(p => { userMap[p.time?.slice(0, 10)] = p.equity })
  botSeries?.forEach(p  => { aiMap[p.time?.slice(0, 10)]   = p.equity })

  // Merge both timelines and sort chronologically
  let allDates = [...new Set([...Object.keys(userMap), ...Object.keys(aiMap)])].sort()

  // Fallback: if both series are empty show a flat $10k line for today
  if (allDates.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    userMap[today] = STARTING_EQUITY
    aiMap[today]   = STARTING_EQUITY
    allDates = [today]
  }

  const chartData = allDates.map(date => ({
    time: date,
    user: userMap[date] != null ? parseFloat((+userMap[date]).toFixed(2)) : undefined,
    bot:  aiMap[date]   != null ? parseFloat((+aiMap[date]).toFixed(2))   : undefined,
  }))

  const yMin = Math.min(
    ...chartData.flatMap(d => [d.user, d.bot].filter(Boolean)),
    STARTING_EQUITY * 0.92
  )
  const yMax = Math.max(
    ...chartData.flatMap(d => [d.user, d.bot].filter(Boolean)),
    STARTING_EQUITY * 1.08
  )

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#12101f', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'DM Mono', fontWeight: 700 }}>${p.value?.toFixed(2)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{p.name}</span>
            <span style={{ color: p.value >= STARTING_EQUITY ? '#10B981' : '#EF4444', fontSize: '0.72rem' }}>
              {p.value >= STARTING_EQUITY ? '+' : ''}{((p.value - STARTING_EQUITY) / STARTING_EQUITY * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={52} domain={[yMin * 0.99, yMax * 1.01]} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={STARTING_EQUITY} stroke="rgba(255,255,255,0.12)" strokeDasharray="5 4" label={{ value: '$10k', fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'DM Mono' }} />
        <Line type="monotone" dataKey="user" stroke="#a78bfa" strokeWidth={2.5} dot={false} name={t('Moi','Me')} connectNulls />
        <Line type="monotone" dataKey="bot"  stroke="#10B981" strokeWidth={2.5} dot={false} name="Bot IA" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ══════════════════════════════════════════
   PORTFOLIO TAB
══════════════════════════════════════════ */
export default function PortfolioTab() {
  const t = useT()
  const isMobile = useIsMobile()
  const [pf, setPf] = useState('USER')

  // Polling 30s via React Query — cache partagé, pas de refetch en rafale
  const POLL = { refetchInterval: 30_000 }
  const { data, isLoading: loading } = useQuery({
    queryKey: ['pf-summary', pf],
    queryFn: () => API.get(`/api/portfolio/summary?portfolio=${pf}`).then(r => r.data),
    ...POLL,
  })
  const { data: equity = [] } = useQuery({
    queryKey: ['pf-equity', 'USER'],
    queryFn: () => API.get('/api/portfolio/equity?portfolio=USER').then(r => r.data),
    ...POLL,
  })
  const { data: equityAI = [] } = useQuery({
    queryKey: ['pf-equity', 'AI'],
    queryFn: () => API.get('/api/portfolio/equity?portfolio=AI').then(r => r.data),
    ...POLL,
  })
  const { data: trades = [] } = useQuery({
    queryKey: ['pf-trades', pf],
    queryFn: () => API.get(`/api/portfolio/trades?portfolio=${pf}&limit=50`).then(r => r.data),
    ...POLL,
  })

  const STARTING_CASH = 10000
  // userPnlPct: always use live summary equity (data.equity) — always accurate and instant
  // botPnlPct:  use last point of AI equity series (backend guarantees today's live equity as last point)
  const lastEquity   = data?.equity ?? STARTING_CASH
  const lastEquityAI = equityAI.length ? equityAI[equityAI.length - 1]?.equity : STARTING_CASH
  const userPnlPct    = (((lastEquity - STARTING_CASH) / STARTING_CASH) * 100).toFixed(2)
  const botPnlPct     = (((lastEquityAI - STARTING_CASH) / STARTING_CASH) * 100).toFixed(2)
  const isUserWinning = parseFloat(userPnlPct) >= parseFloat(botPnlPct)

  const sellTrades = trades.filter(tr => tr.side === 'SELL')
  const wins        = sellTrades.filter(tr => tr.profit > 0)
  const losses      = sellTrades.filter(tr => tr.profit <= 0)
  const winRate     = sellTrades.length ? ((wins.length / sellTrades.length) * 100).toFixed(0) : 0
  const bestTrade   = sellTrades.length ? Math.max(...sellTrades.map(tr => tr.profit)) : 0
  const worstTrade  = sellTrades.length ? Math.min(...sellTrades.map(tr => tr.profit)) : 0
  const avgWin      = wins.length ? (wins.reduce((a, t) => a + t.profit, 0) / wins.length).toFixed(2) : 0
  const avgLoss     = losses.length ? (losses.reduce((a, t) => a + t.profit, 0) / losses.length).toFixed(2) : 0

  const allocation = data?.positions?.map(p => ({
    ticker: p.ticker, value: p.value,
    pct:    data.positions_value > 0 ? ((p.value / data.equity) * 100).toFixed(1) : 0,
    pnl:    p.pnl,
  })) || []

  const COLORS = ['#7C3AED', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

  const pnlPositive = (data?.pnl_total ?? 0) >= 0
  const pnlColor    = pnlPositive ? '#10B981' : '#EF4444'

  return (
    <div>
      {/* ── Portfolio selector tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['USER', 'AI'].map(p => (
          <button key={p} onClick={() => setPf(p)} style={{
            padding: '7px 18px', borderRadius: 10, cursor: 'pointer',
            fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.84rem',
            background: pf === p ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${pf === p ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
            color: pf === p ? '#C4B5FD' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
          }}>
            {p === 'USER' ? `👤 ${t('Mon portfolio', 'My portfolio')}` : `🤖 Bot IA`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 60, fontSize: '0.88rem' }}>{t('Chargement…', 'Loading…')}</div>
      ) : (
        <>
          {/* ── HERO EQUITY — Revolut style ── */}
          {data && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: isMobile ? '24px 20px' : '32px 28px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              {/* Background glow */}
              <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: pnlPositive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', filter: 'blur(40px)', pointerEvents: 'none' }} />

              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontFamily: 'DM Sans', fontWeight: 600 }}>
                {pf === 'USER' ? t('Mon Portfolio Total', 'My Total Portfolio') : 'Bot IA Portfolio'}
              </div>

              {/* Big equity number */}
              <div style={{ fontFamily: 'Syne', fontSize: isMobile ? '2.4rem' : '3rem', fontWeight: 800, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 10 }}>
                ${data.equity?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {/* PnL row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Syne', fontSize: '1.2rem', fontWeight: 700, color: pnlColor }}>
                  {pnlPositive ? '+' : ''}${data.pnl_total?.toFixed(2)}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'DM Mono',
                  background: pnlPositive ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                  color: pnlColor,
                  border: `1px solid ${pnlPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {pnlPositive ? '+' : ''}{data.pnl_pct_total?.toFixed(2)}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
                  {t('depuis $10 000', 'since $10,000')}
                </span>
              </div>

              {/* Quick stats row */}
              <div style={{ display: 'flex', gap: isMobile ? 12 : 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Cash', val: `$${data.cash?.toFixed(0)}`, sub: `${data.cash_pct?.toFixed(0) ?? 100}%` },
                  { label: t('Investi', 'Invested'), val: `$${(data.equity - data.cash)?.toFixed(0)}`, sub: `${(100-(data.cash_pct ?? 100)).toFixed(0)}%` },
                  { label: t('Positions', 'Positions'), val: data.positions?.length || 0, sub: '' },
                  { label: 'Win Rate', val: `${winRate}%`, sub: `${trades.filter(t=>t.side==='SELL').length} trades`, color: parseInt(winRate) >= 50 ? '#10B981' : '#EF4444' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 2, fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem', color: s.color || '#fff' }}>{s.val}
                      {s.sub && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: 4, fontFamily: 'DM Sans' }}>{s.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <RiskMetrics pf={pf} />

          {sellTrades.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                📊 {t('Statistiques de trading', 'Trading Statistics')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(6, 1fr)', gap: 12 }}>
                {[
                  { label: t('Meilleur', 'Best'), val: `+$${bestTrade.toFixed(2)}`, color: '#10B981' },
                  { label: t('Pire', 'Worst'), val: `$${worstTrade.toFixed(2)}`, color: '#EF4444' },
                  { label: t('Moy. gain', 'Avg win'), val: `+$${avgWin}`, color: '#10B981' },
                  { label: t('Moy. perte', 'Avg loss'), val: `$${avgLoss}`, color: '#EF4444' },
                  { label: '✅ Wins', val: wins.length, color: '#10B981' },
                  { label: '❌ Losses', val: losses.length, color: '#EF4444' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, color: s.color, fontSize: '0.95rem' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Equity chart — always shown (starts at $10k even if no trades) ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: isMobile ? '16px 14px' : '20px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>
                  {t('Courbe de performance', 'Performance curve')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                  {t('Moi vs Bot IA — depuis $10 000', 'Me vs AI Bot — since $10,000')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: '#a78bfa' }} />
                  <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontFamily: 'DM Mono', fontWeight: 600 }}>
                    👤 {parseFloat(userPnlPct) >= 0 ? '+' : ''}{userPnlPct}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: '#10B981' }} />
                  <span style={{ fontSize: '0.75rem', color: '#10B981', fontFamily: 'DM Mono', fontWeight: 600 }}>
                    🤖 {parseFloat(botPnlPct) >= 0 ? '+' : ''}{botPnlPct}%
                  </span>
                </div>
                {equity.length > 0 && (
                  <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: isUserWinning ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)', border: `1px solid ${isUserWinning ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.25)'}`, color: isUserWinning ? '#10B981' : '#9F6CF0', fontFamily: 'DM Sans', fontWeight: 600 }}>
                    {isUserWinning ? '🏆 ' + t('Tu mènes', 'You lead') : '🤖 Bot ' + t('mène', 'leads')}
                  </span>
                )}
              </div>
            </div>
            <EquityChart userSeries={equity} botSeries={equityAI} />
          </div>

          {data && allocation.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>
                  {t('Allocation du capital', 'Capital allocation')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                  <span style={{ color: '#60A5FA', fontFamily: 'DM Mono', fontWeight: 600 }}>{data.cash_pct?.toFixed(0) ?? 100}%</span> Cash &nbsp;·&nbsp;
                  <span style={{ color: '#7C3AED', fontFamily: 'DM Mono', fontWeight: 600 }}>{(100-(data.cash_pct??100)).toFixed(0)}%</span> {t('Investi', 'Invested')}
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.04)' }}>
                {allocation.map((p, i) => (
                  <div key={i} title={`${p.ticker}: ${p.pct}%`} style={{ width: `${p.pct}%`, background: COLORS[i % COLORS.length], transition: 'width 0.4s', minWidth: parseFloat(p.pct) > 0 ? 2 : 0 }} />
                ))}
                <div style={{ flex: 1, background: 'rgba(96,165,250,0.2)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {allocation.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>{p.ticker}</span>
                    <span style={{ color: p.pnl >= 0 ? '#10B981' : '#EF4444', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '0.72rem' }}>{p.pct}%</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(96,165,250,0.5)', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>Cash</span>
                  <span style={{ color: '#60A5FA', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '0.72rem' }}>{data.cash_pct?.toFixed(0) ?? 100}%</span>
                </div>
              </div>
            </div>
          )}

          {data?.positions?.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                💼 {t('Positions ouvertes', 'Open positions')} <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>({data.positions.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 560 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {['Ticker', 'Type', t('Qté', 'Qty'), t('Prix moy.', 'Avg'), t('Cours', 'Last'), t('Liq.', 'Liq.'), t('Valeur', 'Value'), 'PnL', '%'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', color: '#9F6CF0', fontWeight: 700, fontFamily: 'DM Mono' }}>{p.ticker}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {p.instrument_type && p.instrument_type !== 'SPOT' ? (
                            <span style={{
                              padding: '2px 7px', borderRadius: 5, fontSize: '0.68rem', fontWeight: 700, fontFamily: 'DM Mono', whiteSpace: 'nowrap',
                              background: p.direction === 'SHORT' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                              color: p.direction === 'SHORT' ? '#EF4444' : '#10B981',
                              border: `1px solid ${p.direction === 'SHORT' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                            }}>
                              {p.instrument_type === 'FUTURES' ? 'FUT' : 'CFD'} {p.direction === 'SHORT' ? '▼' : '▲'} ×{Math.round(p.leverage || 1)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Mono' }}>Spot</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>{p.quantity}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>${p.avg_price}</td>
                        <td style={{ padding: '10px 12px', color: '#60A5FA', fontFamily: 'DM Mono' }}>${p.last_price}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'DM Mono', fontSize: '0.78rem',
                          // Rouge vif si le cours est à moins de 20% du prix de liquidation
                          color: p.liquidation_price && Math.abs(p.last_price - p.liquidation_price) / p.last_price < 0.2 ? '#EF4444' : 'rgba(255,255,255,0.3)',
                          fontWeight: p.liquidation_price ? 700 : 400 }}>
                          {p.liquidation_price ? `$${p.liquidation_price.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 600, fontFamily: 'DM Mono' }}>${p.value?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: p.pnl >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'DM Mono' }}>{p.pnl >= 0 ? '+' : ''}${p.pnl?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'DM Mono',
                            background: (p.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: (p.pnl_pct ?? 0) >= 0 ? '#10B981' : '#EF4444',
                            border: `1px solid ${(p.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                          }}>
                            {(p.pnl_pct ?? 0) >= 0 ? '+' : ''}{(p.pnl_pct ?? 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trades.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                🔄 {t('Historique des trades', 'Trade History')} <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>({trades.length})</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 480 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <tr style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {['Ticker', t('Côté', 'Side'), t('Prix', 'Price'), t('Qté', 'Qty'), 'P&L', t('Acteur', 'Actor'), t('Date', 'Date')].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((tr, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '8px 12px', color: '#9F6CF0', fontWeight: 600, fontFamily: 'DM Mono' }}>{tr.ticker}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.75rem', fontWeight: 700, background: tr.side === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: tr.side === 'BUY' ? '#10B981' : '#EF4444', border: `1px solid ${tr.side === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>{tr.side}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'DM Mono' }}>${tr.price}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>{tr.quantity}</td>
                        <td style={{ padding: '8px 12px', color: tr.profit > 0 ? '#10B981' : tr.profit < 0 ? '#EF4444' : 'var(--muted)', fontWeight: tr.profit !== 0 ? 700 : 400, fontFamily: 'DM Mono' }}>
                          {tr.side === 'SELL' ? `${tr.profit >= 0 ? '+' : ''}$${tr.profit?.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700,
                            background: tr.actor === 'BOT' ? 'rgba(124,58,237,0.15)' : 'rgba(96,165,250,0.12)',
                            color: tr.actor === 'BOT' ? '#C4B5FD' : '#60A5FA',
                            border: `1px solid ${tr.actor === 'BOT' ? 'rgba(124,58,237,0.3)' : 'rgba(96,165,250,0.25)'}`,
                          }}>
                            {tr.actor === 'BOT' ? '🤖' : '👤'} {tr.actor}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '0.75rem', fontFamily: 'DM Mono' }}>{tr.created_at?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trades.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p>{t("Aucun trade pour l'instant. Va sur le Market pour commencer !", 'No trades yet. Go to Market to start!')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
