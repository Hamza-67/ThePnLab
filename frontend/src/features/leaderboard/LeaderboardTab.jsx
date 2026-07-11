import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import API from '../../api/client'
import { useT } from '../../context/LangContext'
import useIsMobile from '../../lib/useIsMobile'

export default function LeaderboardTab() {
  const t = useT()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { data: rows = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => API.get('/api/portfolio/leaderboard').then(r => r.data),
    refetchInterval: 60_000,
  })
  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t('Classement','Leaderboard')}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 20 }}>{t('Capital de départ identique · 10 000$','Same starting capital · $10,000')}</div>
      <div className="glass-panel fade-up" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 320 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {['#', t('Trader','Trader'), ...(isMobile ? [] : [t('École','School')]), 'Equity', 'PnL', '%'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'Syne', fontWeight: 800, color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C3A' : 'var(--muted)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#fff' }}>
                    {r.user_id ? (
                      <span
                        onClick={() => navigate(`/profile/${r.user_id}`)}
                        style={{ cursor: 'pointer', color: '#c4b5fd', textDecoration: 'underline', textDecorationColor: 'rgba(196,181,253,0.4)' }}
                      >
                        {r.name}
                      </span>
                    ) : r.name}
                  </td>
                  {!isMobile && <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{r.school}</td>}
                  <td style={{ padding: '12px 16px', fontFamily: 'DM Mono', fontWeight: 700 }}>${r.equity?.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'DM Mono', fontWeight: 600, color: r.pnl >= 0 ? '#10B981' : '#EF4444' }}>{r.pnl >= 0 ? '+' : ''}${r.pnl?.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'DM Mono',
                      background: (r.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: (r.pnl_pct ?? 0) >= 0 ? '#10B981' : '#EF4444',
                      border: `1px solid ${(r.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                      {(r.pnl_pct ?? 0) >= 0 ? '+' : ''}{(r.pnl_pct ?? 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>{t("Aucun utilisateur pour l'instant.",'No users yet.')}</div>}
      </div>
    </div>
  )
}
