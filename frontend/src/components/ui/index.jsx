/**
 * UI kit ThePnLab — composants de base en Tailwind utilities.
 * Les tokens (bg, violet, muted, font-title…) viennent du bloc @theme d'index.css.
 * Règle : les nouveaux écrans utilisent CE kit, plus de styles inline dupliqués.
 */

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`glass-panel p-4 md:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

const BADGE_TONES = {
  violet:  'bg-violet/15 border-violet/30 text-violet-pale',
  green:   'bg-green/15 border-green/30 text-green',
  red:     'bg-red/15 border-red/30 text-red',
  gold:    'bg-gold/15 border-gold/30 text-gold',
  neutral: 'bg-white/5 border-white/10 text-white/50',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold font-mono ${BADGE_TONES[tone] || BADGE_TONES.neutral} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatBox({ label, value, sub, tone, className = '' }) {
  const valueColor =
    tone === 'green' ? 'text-green' : tone === 'red' ? 'text-red' : 'text-white'
  return (
    <div className={`text-center ${className}`}>
      <div className="text-[0.66rem] text-white/30 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`font-title font-extrabold text-2xl leading-none ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-white/30 font-body mt-1.5">{sub}</div>}
    </div>
  )
}

const BUTTON_VARIANTS = {
  primary:  'bg-gradient-to-br from-violet to-indigo text-white border-transparent',
  buy:      'bg-gradient-to-br from-emerald-600 to-green text-white border-transparent',
  sell:     'bg-gradient-to-br from-red-600 to-red text-white border-transparent',
  ghost:    'bg-white/5 text-white/60 border-white/10 hover:text-white',
  danger:   'bg-red/10 text-red border-red/25',
}

export function Button({ children, variant = 'primary', className = '', disabled, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`px-4 py-2.5 rounded-field border font-semibold text-sm cursor-pointer transition-opacity ${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`inline-flex flex-wrap bg-white/[0.04] border border-white/10 rounded-2xl p-1.5 gap-1 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-5 py-2 rounded-xl text-sm font-semibold cursor-pointer border-none transition-all ${
            active === tab.value
              ? 'bg-gradient-to-br from-violet to-indigo text-white shadow-lg shadow-violet/40'
              : 'bg-transparent text-white/40 hover:text-white/75'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-muted text-sm">
      <span className="inline-block size-4 rounded-full border-2 border-violet border-t-transparent animate-spin" />
      {label}
    </div>
  )
}

export function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div className="text-center py-10 px-5 text-muted">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-white/70 font-semibold mb-1">{title}</div>
      {subtitle && <div className="text-sm">{subtitle}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg2 border border-white/10 rounded-card p-6 max-w-lg w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-title font-bold text-white">{title}</div>
          <button onClick={onClose} className="bg-transparent border-none text-white/40 cursor-pointer text-lg">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
