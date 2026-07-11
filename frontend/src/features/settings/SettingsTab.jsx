import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../api/client'
import { useT } from '../../context/LangContext'

export default function SettingsTab({ setToken, showToast }) {
  const t        = useT()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg]         = useState('')
  const [msgOk, setMsgOk]    = useState(true)
  const [loading, setLoading] = useState(false)
  const user = JSON.parse(localStorage.getItem('tl_user') || '{}')

  const resetPortfolio = async () => {
    setLoading(true)
    try {
      await API.post('/api/portfolio/reset')
      const m = t('Portfolio réinitialisé — capital remis à 10 000$','Portfolio reset — capital restored to $10,000')
      setMsg(m); setMsgOk(true); showToast?.(m)
    } catch (e) {
      setMsg(e.response?.data?.detail || t('Erreur','Error')); setMsgOk(false)
    }
    setLoading(false)
    setTimeout(() => setMsg(''), 4000)
  }

  const deleteAccount = async () => {
    if (confirm !== user.name) {
      setMsg(t('Tape ton nom exact pour confirmer la suppression','Type your exact name to confirm deletion')); setMsgOk(false)
      setTimeout(() => setMsg(''), 3000)
      return
    }
    setLoading(true)
    try {
      await API.delete('/api/auth/me')
      setToken(null)
      localStorage.removeItem('tl_token')
      localStorage.removeItem('tl_user')
      navigate('/')
    } catch (e) {
      setMsg(e.response?.data?.detail || t('Erreur','Error')); setMsgOk(false)
      setLoading(false)
    }
  }

  // Avatar initials
  const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'Syne', fontSize: '1.5rem', fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{t('Paramètres','Settings')}</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 4 }}>{t('Gestion du compte et du portfolio','Account and portfolio management')}</div>
      </div>

      {/* Profile card */}
      <div className="glass-panel-violet fade-up" style={{
        padding: '24px 28px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        {/* Avatar */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Syne', fontSize: '1.2rem', fontWeight: 800, color: '#fff',
          flexShrink: 0, boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>{user.name}</div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {user.school || t('École non renseignée','No school set')} · {t('Compte étudiant','Student account')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 99, padding: '3px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#6EE7B7' }}>
            Actif
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="glass-panel fade-up-1" style={{ padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          {t('Informations du compte','Account information')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: t('Nom complet','Full name'), val: user.name || '—', icon: '👤' },
            { label: t('École / Institution','School / Institution'), val: user.school || '—', icon: '🏛️' },
            { label: t('Capital de départ','Starting capital'), val: '$10,000.00', icon: '💰' },
          ].map((r, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ fontSize: '1rem', width: 24, textAlign: 'center' }}>{r.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', flex: 1 }}>{r.label}</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', fontFamily: r.label.includes('Capital') ? 'DM Mono' : 'inherit' }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reset portfolio */}
      <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 16, padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#FCD34D', fontSize: '0.95rem', marginBottom: 4 }}>
              {t('Réinitialiser le portfolio','Reset portfolio')}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              {t('Remet le capital à 10 000$ · Efface tous les trades · Irréversible','Resets capital to $10,000 · Clears all trades · Irreversible')}
            </div>
          </div>
          <button onClick={resetPortfolio} disabled={loading} style={{
            padding: '10px 20px', borderRadius: 10,
            border: '1px solid rgba(245,158,11,0.25)',
            background: 'rgba(245,158,11,0.08)',
            color: '#FCD34D', fontFamily: 'DM Sans', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
            opacity: loading ? 0.6 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>
            {loading ? t('En cours...','Working...') : t('Réinitialiser','Reset')}
          </button>
        </div>
      </div>

      {/* Legal */}
      <div className="glass-panel fade-up-2" style={{ padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.95rem', marginBottom: 4 }}>
              {t('Informations légales','Legal information')}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>
              {t('CGU, mentions légales, politique RGPD','Terms, legal notice, GDPR policy')}
            </div>
          </div>
          <button onClick={() => navigate('/dashboard/legal')} style={{
            padding: '10px 20px', borderRadius: 10,
            border: '1px solid rgba(124,58,237,0.2)',
            background: 'rgba(124,58,237,0.06)',
            color: '#C4B5FD', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>
            {t('Voir →','View →')}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 16, padding: '20px 24px', marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(239,68,68,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          Zone de danger
        </div>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#FCA5A5', fontSize: '0.95rem', marginBottom: 4 }}>
          {t('Supprimer mon compte','Delete my account')}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', marginBottom: 14, lineHeight: 1.5 }}>
          {t('Action irréversible. Tape ton nom','Irreversible action. Type your name')}{' '}
          <strong style={{ color: 'rgba(255,255,255,0.65)' }}>{user.name}</strong>{' '}
          {t('pour confirmer.','to confirm.')}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder={`${t('Tape','Type')} "${user.name}" ${t('ici','here')}`}
            style={{
              flex: 1, minWidth: 180,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10, color: 'var(--text)', padding: '10px 14px', fontFamily: 'DM Sans', fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <button onClick={deleteAccount} disabled={loading || confirm !== user.name} style={{
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: confirm === user.name ? 'linear-gradient(135deg, #DC2626, #EF4444)' : 'rgba(239,68,68,0.12)',
            color: confirm === user.name ? '#fff' : 'rgba(255,255,255,0.3)',
            fontFamily: 'DM Sans', fontWeight: 600, cursor: confirm === user.name ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}>
            {loading ? t('En cours...','Working...') : t('Supprimer','Delete')}
          </button>
        </div>
      </div>

      {/* Logout */}
      <button onClick={() => { setToken(null); localStorage.removeItem('tl_token'); localStorage.removeItem('tl_user'); navigate('/') }} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
        color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem',
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#fff' }}
        onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.025)'; e.target.style.color = 'rgba(255,255,255,0.5)' }}
      >
        {t('Se déconnecter','Log out')}
      </button>

      {msg && (
        <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: msgOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${msgOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, fontSize: '0.82rem', color: msgOk ? '#6EE7B7' : '#FCA5A5' }}>
          {msg}
        </div>
      )}
    </div>
  )
}
