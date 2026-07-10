import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0D0B1E 0%, #130F2E 50%, #0D1220 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {/* Glow */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: 20 }}>
        <div style={{ fontSize: 80, marginBottom: 8 }}>🏛️</div>

        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 'clamp(5rem, 15vw, 8rem)',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          margin: '0 0 8px', lineHeight: 1,
        }}>404</h1>

        <h2 style={{ color: '#F1F5F9', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 12px' }}>
          Page introuvable
        </h2>

        <p style={{ color: '#64748B', fontSize: '0.95rem', margin: '0 0 32px', maxWidth: 360 }}>
          Cette page n'existe pas ou a été déplacée.
          Retourne au dashboard pour continuer.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              border: 'none', borderRadius: 10, color: '#fff',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
              fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
            }}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '12px 28px',
              background: 'transparent',
              border: '1px solid rgba(124,58,237,0.4)',
              borderRadius: 10, color: '#9F6CF0',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            ← Retour
          </button>
        </div>
      </div>
    </div>
  )
}