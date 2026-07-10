/** Page affichée quand MAINTENANCE_MODE=1 côté backend (/api/system/status). */
export default function Maintenance() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56 }}>🔧</div>
      <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.5rem', color: '#fff' }}>
        Maintenance en cours
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 420, lineHeight: 1.6 }}>
        ThePnLab est temporairement indisponible — on améliore la plateforme.
        Reviens dans quelques minutes !
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#fff',
          fontFamily: 'DM Sans', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
        }}
      >
        Réessayer
      </button>
    </div>
  )
}
