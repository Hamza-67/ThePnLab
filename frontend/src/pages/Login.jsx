import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import API from '../api/client'

export default function Login({ setToken }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [isSignup, setIsSignup] = useState(params.get('signup') === '1')
  const [form, setForm] = useState({ email: '', name: '', school: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    gsap.fromTo('.login-card',
      { opacity: 0, y: 40, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power2.out' }
    )
  }, [])

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async () => {
    setError('')

    // ── Validation mot de passe (inscription uniquement) ──
    if (isSignup) {
      if (!form.email.trim()) { setError('Adresse email requise'); return }
      if (!form.name.trim()) { setError("Nom d'utilisateur requis"); return }
      if (form.password.length < 8) { setError('Mot de passe trop court — minimum 8 caractères'); return }
      if (!/[A-Z]/.test(form.password)) { setError('Mot de passe trop faible — ajoute au moins une majuscule'); return }
      if (!/[0-9]/.test(form.password)) { setError('Mot de passe trop faible — ajoute au moins un chiffre'); return }
    }

    setLoading(true)
    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login'
      let res
      if (isSignup) {
        res = await API.post(endpoint, form)
      } else {
        const fd = new FormData()
        fd.append('username', form.email)
        fd.append('password', form.password)
        res = await API.post(endpoint, fd)
      }
      setToken(res.data.access_token)
      localStorage.setItem('tl_user', JSON.stringify({
        name: res.data.name,
        school: res.data.school,
        id: res.data.user_id,
      }))
      navigate('/dashboard')
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 401) setError('Email ou mot de passe incorrect')
      else if (status === 400) setError(detail || 'Données invalides')
      else setError(detail || 'Erreur inconnue — réessaie')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)', borderRadius: 10,
    color: 'var(--text)', padding: '11px 14px',
    fontFamily: 'DM Sans', fontSize: '0.9rem', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="login-card glass-panel" style={{
        opacity: 0, position: 'relative', zIndex: 1,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        backdropFilter: 'blur(20px)', margin: '20px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.png" alt="ThePnLab" style={{ height: 52, objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <h2 className="text-gradient" style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.5rem' }}>
            {isSignup ? 'Créer un compte' : 'Connexion'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
            {isSignup ? 'Rejoins ThePnLab gratuitement' : 'Content de te revoir'}
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)', borderRadius: 10,
          padding: 4, marginBottom: 24, gap: 4,
        }}>
          {['Connexion', 'Inscription'].map((t, i) => (
            <button key={i} onClick={() => { setIsSignup(i === 1); setError('') }} style={{
              flex: 1, padding: '8px', borderRadius: 8, border: 'none',
              cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.85rem',
              background: (i === 1) === isSignup ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'transparent',
              color: (i === 1) === isSignup ? '#fff' : 'var(--muted)',
              transition: 'all 0.2s',
            }}>{t}</button>
          ))}
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            name="email" type="email" placeholder="Email"
            value={form.email} onChange={handle} style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#7C3AED'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {isSignup && (
            <>
              <input
                name="name" placeholder="Nom d'utilisateur"
                value={form.name} onChange={handle} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <input
                name="school" placeholder="École (optionnel)"
                value={form.school} onChange={handle} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7C3AED'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </>
          )}
          <input
            name="password" type="password"
            placeholder={isSignup ? 'Mot de passe (8 car., 1 maj., 1 chiffre)' : 'Mot de passe'}
            value={form.password} onChange={handle} style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#7C3AED'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />

          {/* Indicateur force mot de passe */}
          {isSignup && form.password.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 6, marginTop: -4 }}>
                {[
                  form.password.length >= 8,
                  /[A-Z]/.test(form.password),
                  /[0-9]/.test(form.password),
                ].map((ok, i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: ok ? '#10B981' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: -4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: form.password.length >= 8 ? '#10B981' : '#EF4444' }}>
                  {form.password.length >= 8 ? '✓' : '✗'} 8 caractères min
                </span>
                <span style={{ color: /[A-Z]/.test(form.password) ? '#10B981' : '#EF4444' }}>
                  {/[A-Z]/.test(form.password) ? '✓' : '✗'} 1 majuscule
                </span>
                <span style={{ color: /[0-9]/.test(form.password) ? '#10B981' : '#EF4444' }}>
                  {/[0-9]/.test(form.password) ? '✓' : '✗'} 1 chiffre
                </span>
              </div>
            </>
          )}

          {!isSignup && (
            <div style={{ textAlign: 'right', marginTop: -4 }}>
              <span
                onClick={() => navigate('/forgot-password')}
                style={{ fontSize: '0.8rem', color: '#9F6CF0', cursor: 'pointer' }}
              >
                Mot de passe oublié ?
              </span>
            </div>
          )}
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, color: '#FCA5A5', fontSize: '0.83rem',
          }}>❌ {error}</div>
        )}

        {/* Bouton */}
        <button onClick={submit} disabled={loading} style={{
          width: '100%', marginTop: 20,
          background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          border: 'none', color: '#fff', borderRadius: 10, padding: '13px',
          fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.95rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
          transition: 'all 0.15s',
        }}>
          {loading ? '⏳ Chargement...' : isSignup ? 'Créer mon compte' : 'Se connecter'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: '0.82rem', cursor: 'pointer', color: '#9F6CF0' }} onClick={() => navigate('/')}>
            ← Retour à l'accueil
          </span>
          <a href="/privacy" style={{ fontSize: '0.75rem', color: 'var(--muted)', textDecoration: 'underline' }}>
            Politique de confidentialité
          </a>
        </div>
      </div>
    </div>
  )
}