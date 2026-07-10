import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import API from '../api/client'

export default function Profile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    API.get(`/api/auth/users/profile/${userId}`)
      .then(r => { setProfile(r.data); setLoading(false) })
      .catch(() => { setError('Profil introuvable'); setLoading(false) })
  }, [userId])

  if (loading) return (
    <div style={s.page}>
      <div style={s.center}><span style={{ fontSize: 32 }}>⏳</span><p style={{ color: '#64748b', marginTop: 12 }}>Chargement...</p></div>
    </div>
  )
  if (error) return (
    <div style={s.page}>
      <div style={s.center}>
        <span style={{ fontSize: 48 }}>🔍</span>
        <p style={{ color: '#ef4444', marginTop: 12, fontWeight: 600 }}>{error}</p>
        <button onClick={() => navigate('/')} style={s.backBtn}>← Retour à l'accueil</button>
      </div>
    </div>
  )

  const initials = profile.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?'
  const pnlPos = profile.pnl >= 0
  const rankEmoji = profile.rank === 1 ? '🥇' : profile.rank === 2 ? '🥈' : profile.rank === 3 ? '🥉' : `#${profile.rank}`

  // Mini sparkline SVG from equity_curve
  const SparkLine = ({ data }) => {
    if (!data || data.length < 2) return null
    const values = data.map(d => d.equity)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const w = 200, h = 50
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    }).join(' ')
    const last = values[values.length - 1]
    const isUp = last >= values[0]
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth="2" />
      </svg>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Back button */}
        <button onClick={() => navigate(-1)} style={s.backBtn}>← Retour</button>

        {/* Header card */}
        <div style={s.card}>
          <div style={s.headerRow}>
            <div style={s.avatar}>{initials}</div>
            <div style={{ flex: 1 }}>
              <h1 style={s.name}>{profile.name}</h1>
              {profile.school && <p style={s.school}>🎓 {profile.school}</p>}
              <p style={s.joined}>Membre depuis le {new Date(profile.joined).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div style={s.rankBadge}>
              <span style={{ fontSize: 28 }}>{rankEmoji}</span>
              {profile.rank && <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>sur {profile.total_users}</p>}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <p style={s.statLabel}>📈 Portfolio</p>
            <p style={{ ...s.statValue, color: '#f1f5f9' }}>${profile.equity?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div style={s.statCard}>
            <p style={s.statLabel}>💰 P&L Total</p>
            <p style={{ ...s.statValue, color: pnlPos ? '#10b981' : '#ef4444' }}>
              {pnlPos ? '+' : ''}${profile.pnl?.toFixed(2)} <span style={{ fontSize: 13 }}>({pnlPos ? '+' : ''}{profile.pnl_pct?.toFixed(2)}%)</span>
            </p>
          </div>
          <div style={s.statCard}>
            <p style={s.statLabel}>🎯 Win Rate</p>
            <p style={{ ...s.statValue, color: profile.win_rate >= 50 ? '#10b981' : '#f59e0b' }}>{profile.win_rate}%</p>
          </div>
          <div style={s.statCard}>
            <p style={s.statLabel}>🔄 Trades</p>
            <p style={{ ...s.statValue, color: '#f1f5f9' }}>{profile.total_trades}</p>
          </div>
        </div>

        {/* Equity curve */}
        {profile.equity_curve?.length >= 2 && (
          <div style={s.card}>
            <p style={s.cardTitle}>📊 Courbe d'équité</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <SparkLine data={profile.equity_curve} />
              <div>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Départ</p>
                <p style={{ margin: '2px 0 8px', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#94a3b8' }}>$10,000</p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Actuel</p>
                <p style={{ margin: '2px 0', fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 700, color: pnlPos ? '#10b981' : '#ef4444' }}>${profile.equity?.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ ...s.card, textAlign: 'center', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>Tu veux te mesurer à {profile.name.split(' ')[0]} ?</p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Crée ton compte ThePnLab — $10 000 virtuels, 0€ de risque.</p>
          <button onClick={() => navigate('/login')} style={{ padding: '10px 24px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            Commencer gratuitement →
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0D0B1E', color: '#e2e8f0', padding: '24px 16px', fontFamily: "'DM Sans', sans-serif" },
  container: { maxWidth: 600, margin: '0 auto' },
  center: { textAlign: 'center', paddingTop: 80 },
  backBtn: { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, padding: '8px 0', marginBottom: 20, display: 'block' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { margin: '0 0 12px', fontSize: 13, color: '#64748b', fontWeight: 600 },
  headerRow: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0 },
  name: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  school: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  joined: { margin: '4px 0 0', fontSize: 11, color: '#475569' },
  rankBadge: { textAlign: 'center', flexShrink: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  statCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' },
  statLabel: { margin: '0 0 6px', fontSize: 11, color: '#64748b' },
  statValue: { margin: 0, fontSize: 20, fontWeight: 700 },
}
