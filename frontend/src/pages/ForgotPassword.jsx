import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api/client'

export default function ForgotPassword({ lang = 'fr' }) {
  const t = (fr, en) => lang === 'fr' ? fr : en
  const navigate = useNavigate()

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      await API.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
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

        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={S.title}>{t('Email envoyé !', 'Email sent!')}</h2>
            <p style={S.subtitle}>
              {t(
                'Si cet email est enregistré, vous recevrez un lien de réinitialisation dans quelques minutes. Vérifiez vos spams.',
                'If this email is registered, you will receive a reset link in a few minutes. Check your spam folder.'
              )}
            </p>
            <button style={S.btnPrimary} onClick={() => navigate('/')}>
              {t('Retour à la connexion', 'Back to login')}
            </button>
          </div>
        ) : (
          <>
            <h2 style={S.title}>{t('Mot de passe oublié', 'Forgot password')}</h2>
            <p style={S.subtitle}>
              {t(
                'Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.',
                "Enter your email and we'll send you a link to reset your password."
              )}
            </p>

            <div style={S.field}>
              <label style={S.label}>{t('Adresse email', 'Email address')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={t('votre@email.com', 'your@email.com')}
                style={S.input}
                autoFocus
              />
            </div>

            {error && <p style={S.error}>⚠️ {error}</p>}

            <button
              style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? t('Envoi en cours...', 'Sending...')
                : t('Envoyer le lien', 'Send reset link')}
            </button>

            <button style={S.btnLink} onClick={() => navigate('/')}>
              ← {t('Retour à la connexion', 'Back to login')}
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
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'linear-gradient(135deg, #130F2E, #1A1530)',
    border: '1px solid rgba(124,58,237,0.3)',
    borderRadius: 20, padding: '40px 36px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    justifyContent: 'center', marginBottom: 28,
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
  },
  logoText: {
    fontFamily: 'Syne, sans-serif', fontWeight: 800,
    color: '#fff', fontSize: '1.2rem',
  },
  title: {
    margin: '0 0 10px', color: '#F1F5F9',
    fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 24px', color: '#94A3B8',
    fontSize: '0.88rem', lineHeight: 1.6, textAlign: 'center',
  },
  field: { marginBottom: 16 },
  label: {
    display: 'block', marginBottom: 6,
    color: '#C4B5FD', fontSize: '0.82rem', fontWeight: 600,
  },
  input: {
    width: '100%', background: '#1A1530',
    border: '1px solid rgba(124,58,237,0.3)',
    borderRadius: 10, color: '#F1F5F9',
    padding: '11px 14px', fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  },
  error: {
    color: '#FCA5A5', fontSize: '0.83rem',
    margin: '0 0 14px', textAlign: 'center',
  },
  btnPrimary: {
    width: '100%', padding: '12px',
    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    border: 'none', borderRadius: 10, color: '#fff',
    fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
    fontSize: '0.95rem', cursor: 'pointer', marginBottom: 10,
  },
  btnLink: {
    width: '100%', padding: '10px',
    background: 'transparent', border: 'none',
    color: '#6B7280', fontFamily: 'DM Sans, sans-serif',
    fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center',
  },
}