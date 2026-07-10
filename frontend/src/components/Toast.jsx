import { useEffect } from 'react'

export default function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, #1e1b4b, #2d1b69)',
      border: '1px solid rgba(167,139,250,0.4)',
      borderRadius: 12, padding: '12px 20px',
      color: '#fff', fontSize: '0.88rem', fontWeight: 500,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
      whiteSpace: 'nowrap',
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 8 }}>✕</button>
    </div>
  )
}
