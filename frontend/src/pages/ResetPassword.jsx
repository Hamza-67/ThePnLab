import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import API from '../api/client'

export default function ResetPassword({ lang = 'fr' }) {
  const t = (fr, en) => lang === 'fr' ? fr : en
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [verifying, setVerifying]   = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!token) { setVerifying(false); return }
    API.get(`/api/auth/reset-password/verify?token=${token}`)
      .then(res => { setTokenValid(res.data.valid === true); setVerifying(false) })
      .catch(() => { setTokenValid(false); setVerifying(false) })
  }, [token])

  const handleReset = async () => {
    if (password.length < 8) {
      setError(t('Minimum 8 caractères.', 'Minimum 8 characters.')); return
    }
    if (password !== confirm) {
      setError(t('Les mots de passe ne correspondent pas.', 'Passwords do not match.')); return
    }
    setLoading(true); setError('')
    try {
      await API.post('/api/auth/reset-password', { token, new_password: password })
      setSuccess(true)
    } catch (e) {
      setError(e.response?.data?.detail || t('Une erreur est survenue.', 'An error occurred.'))
    }
    setLoading(false)
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🏛️</div>
          <span style={S.logoText}>ThePnLab</span>
        </div>

        {verifying && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={S.subtitle}>{t('Vérification du lien...', 'Verifying link...')}</p>
          </div>
        )}

        {!verifying && !tokenValid && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={S.title}>{t('Lien invalide', 'Invalid link')}</h2>
            <p style={S.subtitle}>
              {t('Ce lien est invalide ou a expiré (30 minutes max). Faites une nouvelle demande.',
                 'This link is invalid or has expired (30 min max). Please request a new one.')}
            </p>
            <button style={S.btnPrimary} onClick={() => navigate('/forgot-password')}>
              {t('Nouvelle demande', 'New request')}
            </button>
          </div>
        )}

        {!verifying && tokenValid && success && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={S.title}>{t('Mot de passe mis à jour !', 'Password updated!')}</h2>
            <p style={S.subtitle}>
              {t('Votre mot de passe a été réinitialisé avec succès.', 'Your password has been successfully reset.')}
            </p>
            <button style={S.btnPrimary} onClick={() => navigate('/')}>
              {t('Se connecter', 'Log in')}
            </button>
          </div>
        )}

        {!verifying && tokenValid && !success && (
          <>
            <h2 style={S.title}>{t('Nouveau mot de passe', 'New password')}</h2>
            <p style={S.subtitle}>
              {t('Choisissez un nouveau mot de passe sécurisé (min. 8 caractères).', 'Choose a new secure password (min. 8 characters).')}
            </p>

            <div style={S.field}>
              <label style={S.label}>{t('Nouveau mot de passe', 'New password')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={S.input} autoFocus />
            </div>

            <div style={S.field}>
              <label style={S.label}>{t('Confirmer le mot de passe', 'Confirm password')}</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="••••••••" style={S.input} />
            </div>

            {password && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: password.length >= i * 3
                        ? (i <= 2 ? '#EF4444' : i === 3 ? '#F59E0B' : '#10B981')
                        : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                  {password.length < 8 ? t('Trop court', 'Too short')
                    : password.length < 12 ? t('Acceptable', 'Acceptable')
                    : t('Bon mot de passe', 'Good password')}
                </p>
              </div>
            )}

            {error && <p style={S.error}>⚠️ {error}</p>}

            <button style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }}
              onClick={handleReset} disabled={loading}>
              {loading ? t('Mise à jour...', 'Updating...') : t('Mettre à jour le mot de passe', 'Update password')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0D0B1E 0%, #130F2E 50%, #0D1220 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  },
  card: {
    background: 'linear-gradient(135deg, #130F2E, #1A1530)',
    border: '1px solid rgba(124,58,237,0.3)',
    borderRadius: 20, padding: '40px 36px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
  },
  logoText: { fontFamily: 'Syne, sans-serif', fontWeight: 800, color: '#fff', fontSize: '1.2rem' },
  title: { margin: '0 0 10px', color: '#F1F5F9', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' },
  subtitle: { margin: '0 0 24px', color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.6, textAlign: 'center' },
  field: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 6, color: '#C4B5FD', fontSize: '0.82rem', fontWeight: 600 },
  input: {
    width: '100%', background: '#1A1530',
    border: '1px solid rgba(124,58,237,0.3)',
    borderRadius: 10, color: '#F1F5F9',
    padding: '11px 14px', fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  },
  error: { color: '#FCA5A5', fontSize: '0.83rem', margin: '0 0 14px', textAlign: 'center' },
  btnPrimary: {
    width: '100%', padding: '12px',
    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    border: 'none', borderRadius: 10, color: '#fff',
    fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
    fontSize: '0.95rem', cursor: 'pointer', marginBottom: 10,
  },
}