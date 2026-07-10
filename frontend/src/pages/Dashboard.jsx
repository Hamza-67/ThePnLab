import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import API from '../api/client'
import Chart from '../components/Chart'
import Academy from './Academy'
import BotReport from './BotReport'
import LegalModal, { LegalPage } from './LegalModal'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import AboutPage from './AboutPage'



export const LangContext = createContext('fr')
export const useLang = () => useContext(LangContext)

function useT() {
  const lang = useLang()
  return (fr, en) => lang === 'fr' ? fr : en
}

/* ── HOOK MOBILE ── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

/* ── TOAST ── */
function Toast({ message, onClose }) {
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

const NAV = [
  { path: 'market',      fr: '📈',  en: '📈',  labelFr: 'Marché',     labelEn: 'Market'     },
  { path: 'portfolio',   fr: '💼',  en: '💼',  labelFr: 'Portfolio',  labelEn: 'Portfolio'  },
  { path: 'bot',         fr: '🤖',  en: '🤖',  labelFr: 'Bot IA',     labelEn: 'AI Bot'     },
  { path: 'news',        fr: '📰',  en: '📰',  labelFr: 'News',       labelEn: 'News'       },
  { path: 'leaderboard', fr: '🏆',  en: '🏆',  labelFr: 'Classement', labelEn: 'Leaderboard'},
  { path: 'academy',     fr: '📚',  en: '📚',  labelFr: 'Académie',   labelEn: 'Academy'    },
]

const SELECT_STYLE = {
  width: '100%', background: '#1A1530',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
  color: '#F1F5F9', padding: '9px 12px', fontFamily: 'DM Sans',
  cursor: 'pointer', outline: 'none',
}

// Tickers CAC40 — même set que dans Chart.jsx
const CAC40_SET = new Set(['MC.PA','OR.PA','TTE.PA','AIR.PA','RMS.PA','BNP.PA','SAN.PA','AI.PA','SU.PA','BN.PA','CAP.PA','STM.PA','VIE.PA','DG.PA','SGO.PA'])

/* ── TICKER STRIP — données réelles ── */
const STRIP_TICKERS = ['NVDA', 'AAPL', 'TSLA', 'BTC-USD', 'ETH-USD', 'META', 'MSFT', 'AMD', 'GOOGL', 'SOL-USD']

function TickerStrip() {
  const [prices, setPrices] = useState({})

  useEffect(() => {
    const fetchAll = () => {
      STRIP_TICKERS.forEach(tkr => {
        API.get(`/api/market/indicators/${tkr}`)
          .then(r => {
            const d = r.data
            if (d?.price > 0) {
              const prevClose = d.prev_close || d.price
              const chg = prevClose > 0 ? ((d.price - prevClose) / prevClose) * 100 : 0
              setPrices(s => ({ ...s, [tkr]: { price: d.price, change: chg } }))
            }
          }).catch(() => {
            // fallback: keep existing OHLC approach
            API.get(`/api/market/ohlc/${tkr}?interval=1d&period=5d`)
              .then(r => {
                const data = r.data?.data
                if (data && data.length >= 2) {
                  const prev = data[data.length - 2].close
                  const curr = data[data.length - 1].close
                  const chg = ((curr - prev) / prev) * 100
                  setPrices(s => ({ ...s, [tkr]: { price: curr, change: chg } }))
                }
              }).catch(() => {})
          })
      })
    }
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [])

  const entries = STRIP_TICKERS.map(tkr => {
    const info = prices[tkr]
    const name = tkr.replace('-USD', '')
    const up   = (info?.change ?? 0) >= 0
    const val  = info ? `${info.change >= 0 ? '+' : ''}${info.change.toFixed(2)}%` : '…'
    const price = info?.price ?? null
    return { name, up, val, price }
  })
  const doubled = [...entries, ...entries]

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0', fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <style>{`
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-inner { display: inline-block; animation: ticker 40s linear infinite; }
        .ticker-inner:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-inner">
        {doubled.map((t, i) => (
          <span key={i} style={{ marginRight: 32 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>{t.name}</span>
            <span style={{ color: '#e2e8f0', marginRight: 4, fontFamily: 'DM Mono, monospace' }}>
              {t.price ? `$${t.price < 10 ? t.price.toFixed(4) : t.price < 1000 ? t.price.toFixed(2) : t.price.toFixed(0)}` : ''}
            </span>
            <span style={{ color: t.up ? '#10B981' : '#EF4444' }}>{t.up ? '▲' : '▼'} {t.val}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ token, setToken }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const user = JSON.parse(localStorage.getItem('tl_user') || '{}')

  const [toast, setToast]               = useState(null)
  const [lang, setLang]                 = useState(() => localStorage.getItem('tl_lang') || 'fr')
  const [legalAccepted, setLegalAccepted] = useState(() => localStorage.getItem('tl_legal_accepted') === 'true')
  const [userDropdown, setUserDropdown] = useState(false)
  const [mobileMenu, setMobileMenu]     = useState(false)

  const toggleLang = () => {
    const next = lang === 'fr' ? 'en' : 'fr'
    setLang(next)
    localStorage.setItem('tl_lang', next)
  }

  useEffect(() => {
    gsap.fromTo('.dash-content', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
  }, [location.pathname])

  const logout = () => {
    setToken(null)
    localStorage.removeItem('tl_token')
    localStorage.removeItem('tl_user')
    navigate('/')
  }

  const active = location.pathname.split('/').pop()

  return (
    <LangContext.Provider value={lang}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Topbar — glass morphism ── */}
        <div style={{
          background: 'rgba(8,11,20,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: isMobile ? '0 16px' : '0 28px',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <img src="/logo.png" alt="ThePnLab" style={{ height: isMobile ? 32 : 40, objectFit: 'contain' }} />
              {!isMobile && (
                <span style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#9F6CF0', borderRadius: 6, padding: '2px 8px', fontSize: '0.64rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>SIMULATION</span>
              )}
            </div>

            {/* Nav Desktop — pill style */}
            {!isMobile && (
              <nav style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                {NAV.map(n => (
                  <button key={n.path} onClick={() => navigate(`/dashboard/${n.path}`)} style={{
                    background: active === n.path ? 'rgba(124,58,237,0.22)' : 'transparent',
                    border: active === n.path ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                    color: active === n.path ? '#C4B5FD' : 'rgba(255,255,255,0.45)',
                    borderRadius: 8, padding: '6px 13px', cursor: 'pointer',
                    fontFamily: 'DM Sans', fontWeight: active === n.path ? 600 : 500,
                    fontSize: '0.82rem', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => { if (active !== n.path) e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
                    onMouseLeave={e => { if (active !== n.path) e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
                  >
                    {n.fr} {lang === 'fr' ? n.labelFr : n.labelEn}
                  </button>
                ))}
              </nav>
            )}

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={toggleLang} style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '5px 9px', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)',
                transition: 'all 0.15s',
              }}>
                {lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
              </button>

              {!isMobile && (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setUserDropdown(v => !v)} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '5px 10px 5px 6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                  }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span style={{ fontFamily: 'DM Sans', fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem' }}>{user.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>{userDropdown ? '▲' : '▼'}</span>
                  </button>

                  {userDropdown && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
                      background: '#0e0c1f', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 14, padding: 8, minWidth: 190,
                      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                    }} onMouseLeave={() => setUserDropdown(false)}>
                      <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
                        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{user.name}</div>
                        {user.school && <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{user.school}</div>}
                      </div>
                      {[
                        { icon: '⚙️', label: lang === 'fr' ? 'Paramètres' : 'Settings', action: () => { navigate('/dashboard/settings'); setUserDropdown(false) } },
                        { icon: '⚖️', label: lang === 'fr' ? 'Mentions légales' : 'Legal', action: () => { navigate('/dashboard/legal'); setUserDropdown(false) } },
                        { icon: '👥', label: lang === 'fr' ? 'À propos' : 'About', action: () => { navigate('/dashboard/about'); setUserDropdown(false) } },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 8, border: 'none',
                          background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                          fontFamily: 'DM Sans', fontSize: '0.84rem', textAlign: 'left', transition: 'all 0.12s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span>{item.icon}</span> {item.label}
                        </button>
                      ))}
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                      <button onClick={logout} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 8, border: 'none',
                        background: 'transparent', color: '#FCA5A5', cursor: 'pointer',
                        fontFamily: 'DM Sans', fontSize: '0.84rem', textAlign: 'left', transition: 'all 0.12s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span>🚪</span> {lang === 'fr' ? 'Déconnexion' : 'Log out'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isMobile && (
                <button onClick={() => setMobileMenu(v => !v)} style={{
                  background: mobileMenu ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                  border: mobileMenu ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '7px 11px', cursor: 'pointer',
                  color: mobileMenu ? '#C4B5FD' : 'rgba(255,255,255,0.7)',
                  fontSize: '1.1rem', transition: 'all 0.2s ease',
                  boxShadow: mobileMenu ? '0 0 12px rgba(124,58,237,0.3)' : 'none',
                }}>{mobileMenu ? '✕' : '☰'}</button>
              )}
            </div>
          </div>

          {/* Ticker strip — desktop only */}
          {!isMobile && <TickerStrip />}
        </div>

        {/* Mobile dropdown menu */}
        {isMobile && mobileMenu && (
          <div style={{
            background: 'rgba(8,8,20,0.97)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            borderBottom: '1px solid rgba(124,58,237,0.12)',
            padding: '14px 16px 18px', zIndex: 99,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'slideDown 0.2s ease',
          }}>
            <style>{}</style>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {NAV.map(n => {
                const isA = active === n.path
                return (
                  <button key={n.path} onClick={() => { navigate(`/dashboard/${n.path}`); setMobileMenu(false) }} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
                    background: isA ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.035)',
                    border: isA ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    color: isA ? '#C4B5FD' : 'rgba(255,255,255,0.6)',
                    fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.75rem', textAlign: 'center',
                    boxShadow: isA ? '0 4px 16px rgba(124,58,237,0.2)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '1.4rem', filter: isA ? 'drop-shadow(0 0 6px rgba(167,139,250,0.5))' : 'none' }}>{n.fr}</span>
                    {lang === 'fr' ? n.labelFr : n.labelEn}
                  </button>
                )
              })}
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigate('/dashboard/settings'); setMobileMenu(false) }} style={{
                flex: 1, padding: '11px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.65)', fontFamily: 'DM Sans', fontSize: '0.83rem', cursor: 'pointer',
              }}>
                ⚙️ {lang === 'fr' ? 'Paramètres' : 'Settings'}
              </button>
              <button onClick={logout} style={{
                padding: '11px 16px', borderRadius: 12,
                border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)',
                color: '#FCA5A5', fontFamily: 'DM Sans', fontSize: '0.83rem', cursor: 'pointer',
              }}>
                🚪 {lang === 'fr' ? 'Quitter' : 'Logout'}
              </button>
            </div>
          </div>
        )}

        {/* Simulation disclaimer — minimal */}
        <div style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)', padding: isMobile ? '6px 16px' : '6px 28px', fontSize: '0.74rem', color: 'rgba(252,211,77,0.75)', display: 'flex', alignItems: 'center', gap: 6 }}>
          ⚠️ {lang === 'fr' ? 'Simulation — aucun argent réel · pas de conseil financier' : 'Simulation — no real money · not financial advice'}
        </div>

        {/* Main content */}
        <div className="dash-content" style={{ flex: 1, padding: isMobile ? '16px 14px' : '24px 28px', paddingBottom: isMobile ? '84px' : 24 }}>
          <Routes>
            <Route path="market"      element={<MarketTab showToast={setToast} />} />
            <Route path="portfolio"   element={<PortfolioTab />} />
            <Route path="bot"         element={<BotTab />} />
            <Route path="news"        element={<NewsTab />} />
            <Route path="leaderboard" element={<LeaderboardTab />} />
            <Route path="academy"     element={<Academy lang={lang} />} />
            <Route path="settings"    element={<SettingsTab setToken={setToken} showToast={setToast} />} />
            <Route path="legal"       element={<LegalPage lang={lang} />} />
            <Route path="about"       element={<AboutPage lang={lang} />} />
            <Route path="*"           element={<MarketTab showToast={setToast} />} />
          </Routes>
        </div>

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}

        {!legalAccepted && (
          <LegalModal lang={lang} onAccept={() => {
            localStorage.setItem('tl_legal_accepted', 'true')
            setLegalAccepted(true)
          }} />
        )}

        {/* Mobile bottom nav — premium glass */}
        {isMobile && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
            background: 'rgba(8,9,20,0.96)',
            backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            borderTop: '1px solid rgba(124,58,237,0.12)',
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            padding: '8px 4px', paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          }}>
            {NAV.map(n => {
              const isActive = active === n.path
              return (
                <button key={n.path} onClick={() => navigate(`/dashboard/${n.path}`)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(124,58,237,0.15)' : 'transparent',
                  padding: '6px 10px 5px', borderRadius: 12, minWidth: 52,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.25), inset 0 1px 0 rgba(124,58,237,0.2)' : 'none',
                  border: isActive ? '1px solid rgba(124,58,237,0.25)' : '1px solid transparent',
                  position: 'relative',
                }}>
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                      width: 24, height: 2, borderRadius: '0 0 4px 4px',
                      background: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                      boxShadow: '0 0 8px rgba(124,58,237,0.6)',
                    }} />
                  )}
                  <span style={{
                    fontSize: '1.25rem', lineHeight: 1,
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(167,139,250,0.5))' : 'none',
                    transition: 'filter 0.2s',
                  }}>{n.fr}</span>
                  <span style={{
                    fontSize: '0.58rem', fontFamily: 'DM Sans',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#C4B5FD' : 'rgba(255,255,255,0.28)',
                    transition: 'color 0.2s',
                    letterSpacing: '0.01em',
                  }}>
                    {lang === 'fr' ? n.labelFr : n.labelEn}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Footer desktop */}
        {!isMobile && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(8,11,20,0.8)',
            padding: '12px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
              © 2026 ThePnLab · {lang === 'fr' ? 'Simulation éducative — aucun argent réel' : 'Educational simulation — no real money'}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem' }}>
              {[
                { label: 'CGU', path: 'legal' },
                { label: lang === 'fr' ? 'Paramètres' : 'Settings', path: 'settings' },
                { label: lang === 'fr' ? 'À propos' : 'About', path: 'about' },
              ].map((l, i) => (
                <button key={i} onClick={() => navigate(`/dashboard/${l.path}`)} style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.72rem', padding: 0,
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.color = '#9F6CF0'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >{l.label}</button>
              ))}
            </div>
          </div>
        )}

      </div>
    </LangContext.Provider>
  )
}

/* ══════════════════════════════════════════
   MARKET TAB
══════════════════════════════════════════ */
function MarketTab({ showToast }) {
  const t    = useT()
  const lang = useLang()
  const isMobile = useIsMobile()

  const SECTORS = {
    // ── Tech & IA US ─────────────────────────────────────────────────────
    [t('Tech & IA','Tech & AI')]: {
      NVDA:'NVIDIA', AAPL:'Apple', MSFT:'Microsoft', GOOGL:'Google',
      META:'Meta', AMZN:'Amazon', TSLA:'Tesla', AMD:'AMD',
      ORCL:'Oracle', NFLX:'Netflix', ADBE:'Adobe', CRM:'Salesforce',
      INTC:'Intel', QCOM:'Qualcomm', AVGO:'Broadcom',
    },
    // ── Finance US ───────────────────────────────────────────────────────
    [t('Finance','Finance')]: {
      JPM:'JPMorgan', BAC:'Bank of America', GS:'Goldman Sachs',
      MS:'Morgan Stanley', BLK:'BlackRock', V:'Visa', MA:'Mastercard',
      AXP:'American Express', WFC:'Wells Fargo', C:'Citigroup',
      'BRK-B':'Berkshire B', SPGI:'S&P Global',
    },
    // ── Santé & Pharma ───────────────────────────────────────────────────
    [t('Santé','Health')]: {
      LLY:'Eli Lilly', NVO:'Novo Nordisk', ABBV:'AbbVie',
      JNJ:'J&J', MRK:'Merck', PFE:'Pfizer',
      MRNA:'Moderna', AMGN:'Amgen', BMY:'Bristol-Myers',
      GILD:'Gilead', ISRG:'Intuitive Surgical',
    },
    // ── Consommation & Retail ────────────────────────────────────────────
    [t('Conso & Retail','Consumer')]: {
      MCD:"McDonald's", SBUX:'Starbucks', NKE:'Nike',
      TGT:'Target', WMT:'Walmart', COST:'Costco',
      HD:'Home Depot', PG:'Procter & Gamble',
      KO:'Coca-Cola', PEP:'PepsiCo', MDLZ:'Mondelez',
    },
    // ── Énergie ──────────────────────────────────────────────────────────
    [t('Énergie','Energy')]: {
      XOM:'ExxonMobil', CVX:'Chevron', COP:'ConocoPhillips',
      SLB:'Schlumberger', BP:'BP', SHEL:'Shell',
      'CL=F':t('WTI Pétrole','WTI Oil'),
      'NG=F':t('Gaz Naturel','Natural Gas'),
      NEE:'NextEra Energy', ENPH:'Enphase (Solaire)',
    },
    // ── Métaux & Matières premières ───────────────────────────────────────
    [t('Métaux & MP','Metals')]: {
      'GC=F':t('Or','Gold'), 'SI=F':t('Argent','Silver'),
      'HG=F':t('Cuivre','Copper'), 'PL=F':t('Platine','Platinum'),
      NEM:'Newmont (Or)', GOLD:'Barrick Gold',
      FCX:'Freeport (Cuivre)', AA:'Alcoa (Alu)',
    },
    // ── ETF US ───────────────────────────────────────────────────────────
    [t('ETF US','US ETFs')]: {
      SPY:'S&P 500 (SPY)', QQQ:'Nasdaq 100 (QQQ)',
      IWM:'Russell 2000 (IWM)', DIA:'Dow Jones (DIA)',
      VOO:'Vanguard S&P 500 (VOO)', VTI:'Vanguard Total Market',
      XLF:'ETF Finance (XLF)', XLE:'ETF Énergie (XLE)',
      XLK:'ETF Tech (XLK)', XLV:'ETF Santé (XLV)',
      ARKK:'ARK Innovation', SOXX:'Semi-conducteurs',
    },
    // ── ETF Obligations & Macro ───────────────────────────────────────────
    [t('ETF Oblig & Macro','Bond ETFs')]: {
      TLT:'Treasury 20Y (TLT)', IEF:'Treasury 10Y (IEF)',
      BND:'Vanguard Bonds (BND)', HYG:'High Yield (HYG)',
      LQD:'Corp Bonds (LQD)', GLD:'Gold ETF (GLD)',
      SLV:'Silver ETF (SLV)', VNQ:'REIT Immo (VNQ)',
    },
    // ── CAC 40 ───────────────────────────────────────────────────────────
    [t('🇫🇷 CAC 40','🇫🇷 CAC 40')]: {
      'MC.PA':'LVMH', 'OR.PA':"L'Oréal", 'TTE.PA':'TotalEnergies',
      'AIR.PA':'Airbus', 'RMS.PA':'Hermès', 'BNP.PA':'BNP Paribas',
      'SAN.PA':'Sanofi', 'AI.PA':'Air Liquide', 'SU.PA':'Schneider',
      'BN.PA':'Danone', 'CAP.PA':'Capgemini', 'STM.PA':'STMicro',
      'VIE.PA':'Veolia', 'DG.PA':'Vinci', 'SGO.PA':'Saint-Gobain',
    },
    // ── ETF Europe ───────────────────────────────────────────────────────
    [t('🇪🇺 ETF Europe','🇪🇺 Europe ETFs')]: {
      'IWDA.AS':'World MSCI (IWDA)', 'VEUR.AS':'Europe Vanguard',
      'CSPX.AS':'S&P 500 iShares', EWG:'Allemagne (EWG)',
      EWQ:'France (EWQ)', EWU:'UK (EWU)',
      'EXW1.DE':'MSCI World iShares DE', 'XDWD.DE':'World Xtrackers',
    },
    // ── Crypto ───────────────────────────────────────────────────────────
    [t('₿ Crypto','₿ Crypto')]: {
      'BTC-USD':'Bitcoin', 'ETH-USD':'Ethereum', 'SOL-USD':'Solana',
      'BNB-USD':'BNB', 'ADA-USD':'Cardano', 'XRP-USD':'XRP',
      'DOGE-USD':'Dogecoin', 'AVAX-USD':'Avalanche',
      'DOT-USD':'Polkadot', 'LINK-USD':'Chainlink',
    },
    // ── Aéro, Défense & Industrie ─────────────────────────────────────────
    [t('Aéro & Industrie','Aero & Industry')]: {
      BA:'Boeing', LMT:'Lockheed Martin', RTX:'RTX Corp',
      NOC:'Northrop Grumman', GE:'GE Aerospace',
      CAT:'Caterpillar', DE:'John Deere',
      UPS:'UPS', FDX:'FedEx', MMM:'3M',
    },
  }
  const sectorKeys = Object.keys(SECTORS)

  const [sector, setSector]             = useState(sectorKeys[0])
  const [ticker, setTicker]             = useState('NVDA')
  const [ind, setInd]                   = useState(null)
  const [indInterval, setIndInterval]   = useState('1d')
  const [mode, setMode]                 = useState('qty')
  const [val, setVal]                   = useState(1)
  const [msg, setMsg]                   = useState('')
  const [msgOk, setMsgOk]              = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [positions, setPositions]       = useState([])

  // Fetch portfolio positions pour afficher P&L si actif détenu
  useEffect(() => {
    API.get('/api/portfolio/summary?portfolio=USER')
      .then(r => setPositions(r.data.positions || []))
      .catch(() => {})
  }, [])

  // Refresh positions après un ordre
  const refreshPositions = () => {
    API.get('/api/portfolio/summary?portfolio=USER')
      .then(r => setPositions(r.data.positions || []))
      .catch(() => {})
  }

  // Position courante sur le ticker sélectionné
  const currentPosition = positions.find(p => p.ticker === ticker)

  // Recherche cross-secteur
  const allTickersList = Object.entries(SECTORS).flatMap(([sec, tickers]) =>
    Object.entries(tickers).map(([k, v]) => ({ sector: sec, ticker: k, name: v }))
  )
  const searchResults = searchQuery.length >= 1
    ? allTickersList.filter(({ ticker: t, name }) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()) ||
        name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  // ── Statut marché pour le ticker sélectionné ─────────────────────────────
  const getTickerMarketStatus = (t) => {
    const isCrypto    = t.includes('-USD')
    const isCommodity = t.endsWith('=F')
    const isEU        = t.endsWith('.PA') || t.endsWith('.AS') || t.endsWith('.DE')
    if (isCrypto || isCommodity) return { open: true, label: '24/7 — Toujours ouvert', color: '#10b981' }

    const now = new Date()
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    if (isWeekend) {
      if (isEU) return { open: false, label: 'Euronext fermé — Weekend', color: '#ef4444' }
      return { open: false, label: 'NYSE/NASDAQ fermé — Weekend', color: '#ef4444' }
    }
    if (isEU) {
      const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
      const h = paris.getHours(), m = paris.getMinutes()
      const afterOpen  = h > 9 || (h === 9 && m >= 0)
      const beforeClose = h < 17 || (h === 17 && m <= 30)
      if (afterOpen && beforeClose) return { open: true,  label: `Euronext ouvert — ${h}h${String(m).padStart(2,'0')} Paris`, color: '#10b981' }
      if (!afterOpen)               return { open: false, label: 'Euronext fermé — ouvre à 09h00 Paris', color: '#ef4444' }
      return { open: false, label: 'Euronext fermé — clôture à 17h30 Paris', color: '#ef4444' }
    }
    // Actions US + ETFs US
    const ny    = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const h = ny.getHours(), m = ny.getMinutes()
    const ph = paris.getHours(), pm = paris.getMinutes()
    const afterOpen  = h > 9 || (h === 9 && m >= 30)
    const beforeClose = h < 16
    if (afterOpen && beforeClose) return { open: true,  label: `NYSE/NASDAQ ouvert — ${h}h${String(m).padStart(2,'0')} ET (${ph}h${String(pm).padStart(2,'0')} Paris)`, color: '#10b981' }
    if (!afterOpen)               return { open: false, label: `NYSE/NASDAQ fermé — ouvre à 09h30 ET`, color: '#ef4444' }
    return { open: false, label: `NYSE/NASDAQ fermé — clôture à 16h00 ET`, color: '#ef4444' }
  }
  const mktStatus = getTickerMarketStatus(ticker)
  const [question, setQuestion]         = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [msgs, setMsgs]                 = useState([])
  const coachEndRef                     = useRef(null)

  // ── Fetch indicateurs pour les tickers NON-CAC40 (TradingView)
  // Pour le CAC40, les indicateurs arrivent via onIndicatorsUpdate depuis Chart.jsx
  useEffect(() => {
    if (CAC40_SET.has(ticker)) {
      setInd(null)       // sera rempli par onIndicatorsUpdate
      setIndInterval('1d')
      return
    }
    const fetchData = () => {
      API.get(`/api/market/indicators/${ticker}`).then(r => {
        setInd(r.data)
        setIndInterval('1d')
      }).catch(() => {})
    }
    setInd(null)
    fetchData()
    const isCrypto = ticker.includes('-USD')
    const interval = setInterval(fetchData, isCrypto ? 30000 : 60000)
    return () => clearInterval(interval)
  }, [ticker])

  // ── Callback appelé par YFinanceChart quand les indicateurs changent d'intervalle
  const handleIndicatorsUpdate = useCallback((data) => {
    setInd(data)
    setIndInterval(data?.interval || '1d')
  }, [])

  const order = async (side) => {
    try {
      const r = await API.post('/api/portfolio/order', { ticker, side, mode, value: parseFloat(val), portfolio: 'USER' })
      setMsg(r.data.message); setMsgOk(true)
      showToast?.(r.data.message)
      refreshPositions()
    } catch (e) {
      setMsg(e.response?.data?.detail || t('Erreur','Error')); setMsgOk(false)
    }
    setTimeout(() => setMsg(''), 4000)
  }

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, coachLoading])

  const askCoach = async () => {
    if (!question.trim() || !ind) return
    const q = question.trim()
    setCoachLoading(true)
    setMsgs(m => [...m, { role: 'user', text: q }])
    setQuestion('')
    try {
      const r = await API.post('/api/coach/ask', {
        question: q,
        ticker,
        price: ind.price,
        rsi: ind.rsi,
        macd: ind.macd > ind.signal ? 'BULL' : 'BEAR',
        sma50: ind.sma50,
        conversation_history: msgs.slice(-6).map(m => ({ role: m.role, text: m.text })),
      })
      setMsgs(m => [...m, { role: 'coach', text: r.data.response, qtype: r.data.question_type }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'coach', text: `❌ ${t('Coach indisponible.','Coach unavailable.')}` }])
    }
    setCoachLoading(false)
  }

  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
        {t('Marché & Trading','Market & Trading')}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginBottom: 18 }}>
        {t('Analyse, passe des ordres et interroge le coach IA','Analyze, place orders and ask the AI coach')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '290px 1fr', gap: 14 }}>
        {/* Panneau gauche */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, marginBottom: isMobile ? 80 : 0 }}>
          {/* Barre de recherche cross-secteur */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Rechercher un actif…', 'Search asset…')}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#F1F5F9',
                padding: '9px 12px 9px 34px',
                fontFamily: 'DM Sans', fontSize: '0.85rem', outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', pointerEvents: 'none' }}>
              &#128269;
            </span>
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#1A1530', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, marginTop: 4, overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {searchResults.map(({ sector: sec, ticker: t2, name }) => (
                  <div
                    key={t2}
                    onClick={() => {
                      setTicker(t2)
                      setSector(sec)
                      setSearchQuery('')
                    }}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: '#C4B5FD', fontSize: '0.82rem' }}>{t2}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem', marginLeft: 8 }}>{name}</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{sec.replace(/[^\w\s&]/g, '').trim()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.0 }}>{t('Secteur','Sector')}</label>
          <select value={sector} onChange={e => { setSector(e.target.value); setTicker(Object.keys(SECTORS[e.target.value])[0]) }} style={{ ...SELECT_STYLE, marginTop: 5, marginBottom: 12 }}>
            {sectorKeys.map(s => <option key={s} value={s} style={{ background: '#1A1530' }}>{s}</option>)}
          </select>

          <label style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.0 }}>{t('Actif','Asset')}</label>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={{ ...SELECT_STYLE, marginTop: 5, marginBottom: 8 }}>
            {Object.entries(SECTORS[sector] || {}).map(([k, v]) => (
              <option key={k} value={k} style={{ background: '#1A1530' }}>{v} ({k})</option>
            ))}
          </select>

          {/* Badge statut marché */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, marginBottom: 14,
            background: mktStatus.open ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${mktStatus.open ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: mktStatus.color,
              boxShadow: mktStatus.open ? `0 0 6px ${mktStatus.color}` : 'none',
            }} />
            <span style={{ fontSize: '0.72rem', color: mktStatus.color, fontFamily: 'DM Mono' }}>
              {mktStatus.label}
            </span>
          </div>

          {/* Panel positions ouvertes — toutes les positions avec P&L inline */}
          {positions.filter(p => p.quantity > 0).length > 0 && (
            <div style={{
              marginBottom: 12, borderRadius: 10,
              border: '1px solid rgba(124,58,237,0.2)',
              background: 'rgba(124,58,237,0.04)',
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: '0.64rem', color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: 1.0,
                padding: '6px 12px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                {t('Positions ouvertes', 'Open positions')}
              </div>
              {positions.filter(p => p.quantity > 0).map(p => {
                const found = allTickersList.find(x => x.ticker === p.ticker)
                const isActive = ticker === p.ticker
                return (
                  <div
                    key={p.ticker}
                    onClick={() => {
                      if (found) { setSector(found.sector); setTicker(p.ticker) }
                      else setTicker(p.ticker)
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: 700, color: isActive ? '#C4B5FD' : '#fff' }}>
                      {p.ticker}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: 700, color: p.pnl >= 0 ? '#10B981' : '#EF4444' }}>
                        {p.pnl >= 0 ? '+' : ''}${p.pnl?.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: p.pnl_pct >= 0 ? '#6EE7B7' : '#FCA5A5', marginLeft: 5 }}>
                        ({p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct?.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Banner position — visible si actif détenu */}
          {currentPosition && currentPosition.quantity > 0 && (
            <div style={{
              padding: '9px 12px', borderRadius: 10, marginBottom: 10,
              background: currentPosition.pnl >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${currentPosition.pnl >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 }}>
                {t('Ma position', 'My position')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
                    {currentPosition.quantity.toFixed(4)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginLeft: 5 }}>
                    {t('actions', 'shares')} @ ${currentPosition.avg_price?.toFixed(2)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '0.85rem', fontWeight: 700, color: currentPosition.pnl >= 0 ? '#10B981' : '#EF4444' }}>
                    {currentPosition.pnl >= 0 ? '+' : ''}${currentPosition.pnl?.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: currentPosition.pnl_pct >= 0 ? '#6EE7B7' : '#FCA5A5' }}>
                    {currentPosition.pnl_pct >= 0 ? '+' : ''}{currentPosition.pnl_pct?.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {ind ? (
            <>
              {/* Price — big number */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0 6px' }}>
                <div style={{ fontFamily: 'Syne', fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>${ind.price?.toFixed(2)}</div>
                {CAC40_SET.has(ticker) && (
                  <span style={{ fontSize: '0.65rem', color: '#C4B5FD', background: 'rgba(124,58,237,0.12)', padding: '1px 6px', borderRadius: 4, fontFamily: 'DM Mono', fontWeight: 700 }}>{indInterval}</span>
                )}
              </div>

              {/* Indicators row */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                  { label: 'RSI', val: ind.rsi?.toFixed(0), color: ind.rsi > 70 ? '#EF4444' : ind.rsi < 30 ? '#10B981' : '#9F6CF0' },
                  { label: 'MACD', val: ind.macd > ind.signal ? '↑ Bull' : '↓ Bear', color: ind.macd > ind.signal ? '#10B981' : '#EF4444' },
                  { label: 'SMA50', val: `$${ind.sma50?.toFixed(0)}`, color: ind.price > ind.sma50 ? '#10B981' : '#EF4444' },
                ].map((x, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{x.label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontWeight: 700, color: x.color, fontSize: '0.82rem' }}>{x.val}</div>
                  </div>
                ))}
              </div>

              {/* ── Strike levels — clés techniques ── */}
              {ind.high52w && (
                <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>
                    {t('Niveaux clés (52 semaines)', 'Key levels (52 weeks)')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: t('Plus haut 52s', '52w High'), val: `$${ind.high52w?.toFixed(2)}`, pct: ind.pct_from_high, color: '#EF4444', icon: '▲' },
                      { label: t('Plus bas 52s', '52w Low'), val: `$${ind.low52w?.toFixed(2)}`, pct: ind.pct_from_low, color: '#10B981', icon: '▼' },
                      { label: 'SMA200', val: ind.sma200 ? `$${ind.sma200?.toFixed(0)}` : 'N/A', pct: null, color: ind.price > ind.sma200 ? '#10B981' : '#EF4444', icon: ind.price > ind.sma200 ? '↑' : '↓' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: s.color }}>{s.icon}</span> {s.label}
                        </span>
                        <span style={{ fontFamily: 'DM Mono', fontSize: '0.72rem', color: '#fff', fontWeight: 600 }}>
                          {s.val}
                          {s.pct != null && (
                            <span style={{ color: s.pct >= 0 ? '#10B981' : '#EF4444', marginLeft: 5, fontSize: '0.65rem' }}>
                              {s.pct >= 0 ? '+' : ''}{s.pct?.toFixed(1)}%
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Visual position bar */}
                  {ind.high52w && ind.low52w && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
                          background: 'linear-gradient(90deg, #EF4444, #F59E0B, #10B981)',
                          width: `${Math.max(2, Math.min(98, ((ind.price - ind.low52w) / (ind.high52w - ind.low52w)) * 100))}%`,
                          transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
                        <span>Low</span><span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>•{((ind.price - ind.low52w) / (ind.high52w - ind.low52w) * 100).toFixed(0)}%</span><span>High</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.83rem', margin: '16px 0', textAlign: 'center' }}>{t('Chargement…','Loading…')}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['qty', 'amount'].map(m => (
              <button key={m} onClick={() => { setMode(m); setVal(m === 'qty' ? 1 : 100) }} style={{ flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.8rem', fontWeight: 600, background: mode === m ? 'rgba(124,58,237,0.2)' : 'transparent', border: `1px solid ${mode === m ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: mode === m ? '#9F6CF0' : 'var(--muted)' }}>
                {m === 'qty' ? t('# Actions','# Shares') : t('Montant $','Amount $')}
              </button>
            ))}
          </div>

          <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} min={mode === 'qty' ? 1 : 10} step={mode === 'qty' ? 1 : 50}
            placeholder={mode === 'qty' ? t("Nombre d'actions",'Number of shares') : t('Montant en $','Amount in $')}
            style={{ width: '100%', marginBottom: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '9px 12px', fontFamily: 'DM Sans', boxSizing: 'border-box' }}
          />

          {/* Quick amount presets */}
          {mode === 'amount' && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {[100, 250, 500, 1000].map(amt => (
                <button key={amt} onClick={() => setVal(amt)} style={{
                  padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                  fontFamily: 'DM Mono', fontWeight: 600,
                  background: val === amt ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${val === amt ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                  color: val === amt ? '#C4B5FD' : 'var(--muted)',
                }}>
                  ${amt}
                </button>
              ))}
            </div>
          )}

          {/* Estimation */}
          {ind?.price > 0 && val > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10, padding: '5px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, fontFamily: 'DM Mono' }}>
              {mode === 'amount'
                ? `≈ ${(val / ind.price).toFixed(4)} ${t('actions', 'shares')} @ $${ind.price?.toFixed(2)}`
                : `≈ $${(val * ind.price).toFixed(2)} ${t('total', 'total')}`
              }
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => order('BUY')}
              disabled={!mktStatus.open}
              title={!mktStatus.open ? mktStatus.label : ''}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                background: mktStatus.open ? 'linear-gradient(135deg, #059669, #10B981)' : 'rgba(255,255,255,0.06)',
                color: mktStatus.open ? '#fff' : 'var(--muted)',
                fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.9rem',
                cursor: mktStatus.open ? 'pointer' : 'not-allowed', opacity: mktStatus.open ? 1 : 0.5 }}>
              {t('Acheter','Buy')}
            </button>
            <button
              onClick={() => order('SELL')}
              disabled={!mktStatus.open}
              title={!mktStatus.open ? mktStatus.label : ''}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                background: mktStatus.open ? 'linear-gradient(135deg, #DC2626, #EF4444)' : 'rgba(255,255,255,0.06)',
                color: mktStatus.open ? '#fff' : 'var(--muted)',
                fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.9rem',
                cursor: mktStatus.open ? 'pointer' : 'not-allowed', opacity: mktStatus.open ? 1 : 0.5 }}>
              {t('Vendre','Sell')}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: msgOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msgOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '0.82rem', color: msgOk ? '#6EE7B7' : '#FCA5A5' }}>
              {msg}
            </div>
          )}
        </div>

        {/* Panneau droit — chart + coach */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 18,
            padding: 0,
            height: isMobile ? 360 : 540,
            overflow: 'hidden',
          }}>
            <Chart ticker={ticker} onIndicatorsUpdate={handleIndicatorsUpdate} />
          </div>

          {/* ── Coach IA panel — redesigned ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px 18px', marginBottom: isMobile ? 90 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                💬 {t('Coach IA','AI Coach')}
              </div>
              {msgs.length > 0 && (
                <button onClick={() => setMsgs([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'DM Sans' }}>
                  {t('Effacer','Clear')} ✕
                </button>
              )}
            </div>

            {/* Quick questions */}
            {msgs.length === 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('Questions rapides','Quick questions')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {[
                    t('Analyser ce graphique', 'Analyze this chart'),
                    t('Dois-je acheter ?', 'Should I buy?'),
                    t('Quel stop loss ?', 'What stop loss?'),
                    t('Risque du trade ?', 'Trade risk?'),
                  ].map((q, i) => (
                    <button key={i} onClick={() => setQuestion(q)} style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                      color: '#a78bfa', fontFamily: 'DM Sans', fontWeight: 500,
                    }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            <div style={{ maxHeight: msgs.length ? 200 : 0, overflowY: 'auto', marginBottom: msgs.length ? 12 : 0, display: 'flex', flexDirection: 'column', gap: 10, transition: 'max-height 0.3s' }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: '0.83rem', lineHeight: 1.65,
                  background: m.role === 'user' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  color: m.role === 'user' ? '#C4B5FD' : 'rgba(255,255,255,0.85)',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                }}>
                  {m.role === 'coach' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ color: '#9F6CF0', fontWeight: 700, fontSize: '0.75rem' }}>🎓 Coach</span>
                      {m.qtype && (
                        <span style={{ fontSize: '0.62rem', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '1px 6px', borderRadius: 4, fontFamily: 'DM Mono', textTransform: 'uppercase' }}>{m.qtype}</span>
                      )}
                    </div>
                  )}
                  {m.text}
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, width: 'fit-content' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>⏳</span> {t('Le coach réfléchit...','Coach is thinking...')}
                </div>
              )}
              <div ref={coachEndRef} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !coachLoading && askCoach()}
                placeholder={t('Ta question au coach IA...','Ask the AI coach...')}
                disabled={!ind}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', padding: '9px 13px', fontFamily: 'DM Sans', fontSize: '0.86rem', outline: 'none', minWidth: 0, transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button onClick={askCoach} disabled={coachLoading || !ind || !question.trim()} style={{
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', border: 'none', color: '#fff',
                borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
                fontFamily: 'DM Sans', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.84rem',
                opacity: coachLoading || !ind || !question.trim() ? 0.5 : 1, transition: 'opacity 0.15s',
              }}>
                {coachLoading ? '...' : (isMobile ? '→' : t('Envoyer','Send'))}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   EQUITY CHART
══════════════════════════════════════════ */
function EquityChart({ userSeries, botSeries }) {
  const t = useT()
  const STARTING_EQUITY = 10000

  // Build maps from date → equity
  // Backend guarantees: $10k anchor before first real data + live today point
  const userMap = {}
  const aiMap   = {}
  userSeries?.forEach(p => { userMap[p.time?.slice(0, 10)] = p.equity })
  botSeries?.forEach(p  => { aiMap[p.time?.slice(0, 10)]   = p.equity })

  // Merge both timelines and sort chronologically
  let allDates = [...new Set([...Object.keys(userMap), ...Object.keys(aiMap)])].sort()

  // Fallback: if both series are empty show a flat $10k line for today
  if (allDates.length === 0) {
    const today = new Date().toISOString().slice(0, 10)
    userMap[today] = STARTING_EQUITY
    aiMap[today]   = STARTING_EQUITY
    allDates = [today]
  }

  const chartData = allDates.map(date => ({
    time: date,
    user: userMap[date] != null ? parseFloat((+userMap[date]).toFixed(2)) : undefined,
    bot:  aiMap[date]   != null ? parseFloat((+aiMap[date]).toFixed(2))   : undefined,
  }))

  const yMin = Math.min(
    ...chartData.flatMap(d => [d.user, d.bot].filter(Boolean)),
    STARTING_EQUITY * 0.92
  )
  const yMax = Math.max(
    ...chartData.flatMap(d => [d.user, d.bot].filter(Boolean)),
    STARTING_EQUITY * 1.08
  )

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#12101f', border: '1px solid rgba(167,139,250,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'DM Mono', fontWeight: 700 }}>${p.value?.toFixed(2)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>{p.name}</span>
            <span style={{ color: p.value >= STARTING_EQUITY ? '#10B981' : '#EF4444', fontSize: '0.72rem' }}>
              {p.value >= STARTING_EQUITY ? '+' : ''}{((p.value - STARTING_EQUITY) / STARTING_EQUITY * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} width={52} domain={[yMin * 0.99, yMax * 1.01]} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={STARTING_EQUITY} stroke="rgba(255,255,255,0.12)" strokeDasharray="5 4" label={{ value: '$10k', fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'DM Mono' }} />
        <Line type="monotone" dataKey="user" stroke="#a78bfa" strokeWidth={2.5} dot={false} name={t('Moi','Me')} connectNulls />
        <Line type="monotone" dataKey="bot"  stroke="#10B981" strokeWidth={2.5} dot={false} name="Bot IA" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ══════════════════════════════════════════
   PORTFOLIO TAB
══════════════════════════════════════════ */
function PortfolioTab() {
  const t = useT()
  const isMobile = useIsMobile()
  const [data, setData]         = useState(null)
  const [equity, setEquity]     = useState([])
  const [equityAI, setEquityAI] = useState([])
  const [trades, setTrades]     = useState([])
  const [pf, setPf]             = useState('USER')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const fetchAll = () => {
      setLoading(true)
      Promise.all([
        API.get(`/api/portfolio/summary?portfolio=${pf}`).then(r => setData(r.data)).catch(() => {}),
        API.get('/api/portfolio/equity?portfolio=USER').then(r => setEquity(r.data)).catch(() => {}),
        API.get('/api/portfolio/equity?portfolio=AI').then(r => setEquityAI(r.data)).catch(() => {}),
        API.get(`/api/portfolio/trades?portfolio=${pf}&limit=50`).then(r => setTrades(r.data)).catch(() => {}),
      ]).finally(() => setLoading(false))
    }
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [pf])

  const STARTING_CASH = 10000
  // userPnlPct: always use live summary equity (data.equity) — always accurate and instant
  // botPnlPct:  use last point of AI equity series (backend guarantees today's live equity as last point)
  const lastEquity   = data?.equity ?? STARTING_CASH
  const lastEquityAI = equityAI.length ? equityAI[equityAI.length - 1]?.equity : STARTING_CASH
  const userPnlPct    = (((lastEquity - STARTING_CASH) / STARTING_CASH) * 100).toFixed(2)
  const botPnlPct     = (((lastEquityAI - STARTING_CASH) / STARTING_CASH) * 100).toFixed(2)
  const isUserWinning = parseFloat(userPnlPct) >= parseFloat(botPnlPct)

  const sellTrades = trades.filter(tr => tr.side === 'SELL')
  const wins        = sellTrades.filter(tr => tr.profit > 0)
  const losses      = sellTrades.filter(tr => tr.profit <= 0)
  const winRate     = sellTrades.length ? ((wins.length / sellTrades.length) * 100).toFixed(0) : 0
  const bestTrade   = sellTrades.length ? Math.max(...sellTrades.map(tr => tr.profit)) : 0
  const worstTrade  = sellTrades.length ? Math.min(...sellTrades.map(tr => tr.profit)) : 0
  const avgWin      = wins.length ? (wins.reduce((a, t) => a + t.profit, 0) / wins.length).toFixed(2) : 0
  const avgLoss     = losses.length ? (losses.reduce((a, t) => a + t.profit, 0) / losses.length).toFixed(2) : 0

  const allocation = data?.positions?.map(p => ({
    ticker: p.ticker, value: p.value,
    pct:    data.positions_value > 0 ? ((p.value / data.equity) * 100).toFixed(1) : 0,
    pnl:    p.pnl,
  })) || []

  const COLORS = ['#7C3AED', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899']

  const pnlPositive = (data?.pnl_total ?? 0) >= 0
  const pnlColor    = pnlPositive ? '#10B981' : '#EF4444'

  return (
    <div>
      {/* ── Portfolio selector tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['USER', 'AI'].map(p => (
          <button key={p} onClick={() => setPf(p)} style={{
            padding: '7px 18px', borderRadius: 10, cursor: 'pointer',
            fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.84rem',
            background: pf === p ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${pf === p ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
            color: pf === p ? '#C4B5FD' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
          }}>
            {p === 'USER' ? `👤 ${t('Mon portfolio', 'My portfolio')}` : `🤖 Bot IA`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 60, fontSize: '0.88rem' }}>{t('Chargement…', 'Loading…')}</div>
      ) : (
        <>
          {/* ── HERO EQUITY — Revolut style ── */}
          {data && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: isMobile ? '24px 20px' : '32px 28px', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              {/* Background glow */}
              <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: pnlPositive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', filter: 'blur(40px)', pointerEvents: 'none' }} />

              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontFamily: 'DM Sans', fontWeight: 600 }}>
                {pf === 'USER' ? t('Mon Portfolio Total', 'My Total Portfolio') : 'Bot IA Portfolio'}
              </div>

              {/* Big equity number */}
              <div style={{ fontFamily: 'Syne', fontSize: isMobile ? '2.4rem' : '3rem', fontWeight: 800, color: '#fff', letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 10 }}>
                ${data.equity?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {/* PnL row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Syne', fontSize: '1.2rem', fontWeight: 700, color: pnlColor }}>
                  {pnlPositive ? '+' : ''}${data.pnl_total?.toFixed(2)}
                </span>
                <span style={{
                  padding: '3px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'DM Mono',
                  background: pnlPositive ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
                  color: pnlColor,
                  border: `1px solid ${pnlPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  {pnlPositive ? '+' : ''}{data.pnl_pct_total?.toFixed(2)}%
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
                  {t('depuis $10 000', 'since $10,000')}
                </span>
              </div>

              {/* Quick stats row */}
              <div style={{ display: 'flex', gap: isMobile ? 12 : 24, marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Cash', val: `$${data.cash?.toFixed(0)}`, sub: `${data.cash_pct?.toFixed(0) ?? 100}%` },
                  { label: t('Investi', 'Invested'), val: `$${(data.equity - data.cash)?.toFixed(0)}`, sub: `${(100-(data.cash_pct ?? 100)).toFixed(0)}%` },
                  { label: t('Positions', 'Positions'), val: data.positions?.length || 0, sub: '' },
                  { label: 'Win Rate', val: `${winRate}%`, sub: `${trades.filter(t=>t.side==='SELL').length} trades`, color: parseInt(winRate) >= 50 ? '#10B981' : '#EF4444' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 2, fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem', color: s.color || '#fff' }}>{s.val}
                      {s.sub && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginLeft: 4, fontFamily: 'DM Sans' }}>{s.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sellTrades.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                📊 {t('Statistiques de trading', 'Trading Statistics')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'repeat(6, 1fr)', gap: 12 }}>
                {[
                  { label: t('Meilleur', 'Best'), val: `+$${bestTrade.toFixed(2)}`, color: '#10B981' },
                  { label: t('Pire', 'Worst'), val: `$${worstTrade.toFixed(2)}`, color: '#EF4444' },
                  { label: t('Moy. gain', 'Avg win'), val: `+$${avgWin}`, color: '#10B981' },
                  { label: t('Moy. perte', 'Avg loss'), val: `$${avgLoss}`, color: '#EF4444' },
                  { label: '✅ Wins', val: wins.length, color: '#10B981' },
                  { label: '❌ Losses', val: losses.length, color: '#EF4444' },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: 0.6 }}>{s.label}</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, color: s.color, fontSize: '0.95rem' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Equity chart — always shown (starts at $10k even if no trades) ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: isMobile ? '16px 14px' : '20px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginBottom: 4 }}>
                  {t('Courbe de performance', 'Performance curve')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                  {t('Moi vs Bot IA — depuis $10 000', 'Me vs AI Bot — since $10,000')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: '#a78bfa' }} />
                  <span style={{ fontSize: '0.75rem', color: '#a78bfa', fontFamily: 'DM Mono', fontWeight: 600 }}>
                    👤 {parseFloat(userPnlPct) >= 0 ? '+' : ''}{userPnlPct}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: '#10B981' }} />
                  <span style={{ fontSize: '0.75rem', color: '#10B981', fontFamily: 'DM Mono', fontWeight: 600 }}>
                    🤖 {parseFloat(botPnlPct) >= 0 ? '+' : ''}{botPnlPct}%
                  </span>
                </div>
                {equity.length > 0 && (
                  <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 6, background: isUserWinning ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.1)', border: `1px solid ${isUserWinning ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.25)'}`, color: isUserWinning ? '#10B981' : '#9F6CF0', fontFamily: 'DM Sans', fontWeight: 600 }}>
                    {isUserWinning ? '🏆 ' + t('Tu mènes', 'You lead') : '🤖 Bot ' + t('mène', 'leads')}
                  </span>
                )}
              </div>
            </div>
            <EquityChart userSeries={equity} botSeries={equityAI} />
          </div>

          {data && allocation.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.88rem' }}>
                  {t('Allocation du capital', 'Capital allocation')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
                  <span style={{ color: '#60A5FA', fontFamily: 'DM Mono', fontWeight: 600 }}>{data.cash_pct?.toFixed(0) ?? 100}%</span> Cash &nbsp;·&nbsp;
                  <span style={{ color: '#7C3AED', fontFamily: 'DM Mono', fontWeight: 600 }}>{(100-(data.cash_pct??100)).toFixed(0)}%</span> {t('Investi', 'Invested')}
                </div>
              </div>
              <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.04)' }}>
                {allocation.map((p, i) => (
                  <div key={i} title={`${p.ticker}: ${p.pct}%`} style={{ width: `${p.pct}%`, background: COLORS[i % COLORS.length], transition: 'width 0.4s', minWidth: parseFloat(p.pct) > 0 ? 2 : 0 }} />
                ))}
                <div style={{ flex: 1, background: 'rgba(96,165,250,0.2)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                {allocation.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>{p.ticker}</span>
                    <span style={{ color: p.pnl >= 0 ? '#10B981' : '#EF4444', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '0.72rem' }}>{p.pct}%</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(96,165,250,0.5)', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'DM Mono', fontSize: '0.72rem' }}>Cash</span>
                  <span style={{ color: '#60A5FA', fontFamily: 'DM Mono', fontWeight: 600, fontSize: '0.72rem' }}>{data.cash_pct?.toFixed(0) ?? 100}%</span>
                </div>
              </div>
            </div>
          )}

          {data?.positions?.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                💼 {t('Positions ouvertes', 'Open positions')} <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>({data.positions.length})</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 560 }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {['Ticker', t('Qté', 'Qty'), t('Prix moy.', 'Avg'), t('Cours', 'Last'), t('Valeur', 'Value'), 'PnL', '%'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 12px', color: '#9F6CF0', fontWeight: 700, fontFamily: 'DM Mono' }}>{p.ticker}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>{p.quantity}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>${p.avg_price}</td>
                        <td style={{ padding: '10px 12px', color: '#60A5FA', fontFamily: 'DM Mono' }}>${p.last_price}</td>
                        <td style={{ padding: '10px 12px', color: '#F59E0B', fontWeight: 600, fontFamily: 'DM Mono' }}>${p.value?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', color: p.pnl >= 0 ? '#10B981' : '#EF4444', fontWeight: 700, fontFamily: 'DM Mono' }}>{p.pnl >= 0 ? '+' : ''}${p.pnl?.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, fontFamily: 'DM Mono',
                            background: (p.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                            color: (p.pnl_pct ?? 0) >= 0 ? '#10B981' : '#EF4444',
                            border: `1px solid ${(p.pnl_pct ?? 0) >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                          }}>
                            {(p.pnl_pct ?? 0) >= 0 ? '+' : ''}{(p.pnl_pct ?? 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trades.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '16px 20px' }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', marginBottom: 14, fontSize: '0.9rem' }}>
                🔄 {t('Historique des trades', 'Trade History')} <span style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>({trades.length})</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: 480 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                    <tr style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                      {['Ticker', t('Côté', 'Side'), t('Prix', 'Price'), t('Qté', 'Qty'), 'P&L', t('Acteur', 'Actor'), t('Date', 'Date')].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((tr, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '8px 12px', color: '#9F6CF0', fontWeight: 600, fontFamily: 'DM Mono' }}>{tr.ticker}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.75rem', fontWeight: 700, background: tr.side === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: tr.side === 'BUY' ? '#10B981' : '#EF4444', border: `1px solid ${tr.side === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>{tr.side}</span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text)', fontFamily: 'DM Mono' }}>${tr.price}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>{tr.quantity}</td>
                        <td style={{ padding: '8px 12px', color: tr.profit > 0 ? '#10B981' : tr.profit < 0 ? '#EF4444' : 'var(--muted)', fontWeight: tr.profit !== 0 ? 700 : 400, fontFamily: 'DM Mono' }}>
                          {tr.side === 'SELL' ? `${tr.profit >= 0 ? '+' : ''}$${tr.profit?.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 7px', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700,
                            background: tr.actor === 'BOT' ? 'rgba(124,58,237,0.15)' : 'rgba(96,165,250,0.12)',
                            color: tr.actor === 'BOT' ? '#C4B5FD' : '#60A5FA',
                            border: `1px solid ${tr.actor === 'BOT' ? 'rgba(124,58,237,0.3)' : 'rgba(96,165,250,0.25)'}`,
                          }}>
                            {tr.actor === 'BOT' ? '🤖' : '👤'} {tr.actor}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '0.75rem', fontFamily: 'DM Mono' }}>{tr.created_at?.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trades.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p>{t("Aucun trade pour l'instant. Va sur le Market pour commencer !", 'No trades yet. Go to Market to start!')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   BOT TAB
══════════════════════════════════════════ */
function BotTab() {
  const t    = useT()
  const lang = useLang()
  const [history, setHistory]   = useState([])
  const [histPage, setHistPage] = useState(0)
  const [hasMore, setHasMore]   = useState(false)
  const [histLoading, setHistLoading] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState(null)

  const loadHistory = async (page = 0) => {
    setHistLoading(true)
    try {
      const r = await API.get(`/api/bot/history?page=${page}&per_page=5`)
      if (page === 0) {
        setHistory(r.data.reports || [])
      } else {
        setHistory(prev => [...prev, ...(r.data.reports || [])])
      }
      setHasMore(r.data.has_more || false)
      setHistPage(page)
    } catch (e) {
      console.error('History fetch error:', e)
    }
    setHistLoading(false)
  }

  useEffect(() => { loadHistory(0) }, [])

  const statusColor = (s) => s === 'active' ? '#10B981' : s === 'idle' ? '#F59E0B' : 'var(--muted)'
  const statusLabel = (s, status) => {
    if (status === 'active') return `🟢 ${s === 'fr' ? 'Actif' : 'Active'}`
    return `⏸️ ${s === 'fr' ? 'En attente' : 'Standby'}`
  }

  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t('Bot IA','AI Bot')}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 20 }}>{t('Analyse automatique · toutes les 30min (9h-22h Paris) · Rapport pédagogique','Automated analysis · every 30min (9h-22h Paris) · Educational report')}</div>

      <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#a78bfa', marginBottom: 10, fontSize: '0.95rem' }}>{t('⚡ Comment fonctionne le bot ?','⚡ How does the bot work?')}</div>
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          {t("Le bot analyse en continu 50+ actifs (actions US, ETFs, crypto, CAC40) avec RSI, MACD, Bollinger et volume. Il sélectionne les meilleures opportunités et prend position automatiquement.",'The bot continuously analyzes 50+ assets (US stocks, ETFs, crypto, CAC40) using RSI, MACD, Bollinger and volume. It automatically selects the best opportunities.')}
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          {t("Cycle automatique toutes les 30 min (lun-ven, 9h-22h Paris). Le week-end, seule la crypto est active. Le bot ne trade pas hors des heures de marché.",'Automatic cycle every 30 min (Mon-Fri, 9h-22h Paris). On weekends, only crypto is active. The bot does not trade outside market hours.')}
        </p>
      </div>

      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: '0.8rem', color: '#d97706', lineHeight: 1.5 }}>
        ⚠️ {t("Simulation uniquement — aucun argent réel. Les décisions du bot sont éducatives et ne constituent pas un conseil financier.",'Simulation only — no real money. Bot decisions are educational and not financial advice.')}
      </div>

      <BotReport lang={lang} />

      <div style={{ marginTop: 28 }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 16 }}>
          📋 {t('Historique des cycles','Cycle History')}
        </div>

        {history.length === 0 && !histLoading && (
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '20px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
            {t("Aucun cycle enregistré pour l'instant.",'No cycles recorded yet.')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map((report, idx) => (
            <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.8rem', color: statusColor(report.status), fontWeight: 600 }}>
                    {statusLabel(lang, report.status)}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
                    {report.date_fr || report.timestamp?.slice(0, 16)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {report.total_trades > 0 && (
                    <span style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', color: '#C4B5FD' }}>
                      {report.total_trades} trade{report.total_trades > 1 ? 's' : ''}
                    </span>
                  )}
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{expandedIdx === idx ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedIdx === idx && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: 12, marginBottom: 12 }}>
                    {lang === 'fr' ? report.summary_fr : report.summary_en}
                  </div>

                  {report.trades?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                        {t('Décisions','Decisions')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {report.trades.map((trade, ti) => (
                          <div key={ti} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'Syne', fontWeight: 700, color: '#9F6CF0' }}>{trade.ticker}</span>
                              <span style={{ padding: '2px 8px', borderRadius: 5, fontSize: '0.73rem', fontWeight: 700, background: trade.action === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: trade.action === 'BUY' ? '#10B981' : '#EF4444', border: `1px solid ${trade.action === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                {trade.action}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#F59E0B', fontFamily: 'DM Mono' }}>${trade.price?.toFixed(2)}</span>
                              <span style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>{trade.time}</span>
                              {trade.confidence && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '1px 6px' }}>
                                  {t('Conf.','Conf.')} {trade.confidence}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                              {lang === 'fr' ? trade.rationale_fr : trade.rationale_en}
                            </div>
                            {trade.position_before && (
                              <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                📊 {t('Position avant','Position before')} : {trade.position_before.quantity} @ ${trade.position_before.avg_price} →{' '}
                                <span style={{ color: trade.position_before.pnl_pct >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                                  {trade.position_before.pnl_pct >= 0 ? '+' : ''}{trade.position_before.pnl_pct}% (${trade.position_before.pnl_abs >= 0 ? '+' : ''}{trade.position_before.pnl_abs})
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.screened?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                        {t('Actifs analysés','Screened assets')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {report.screened.map((ticker, si) => (
                          <span key={si} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                            {ticker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.errors?.length > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.78rem', color: '#FCA5A5' }}>
                      {report.errors.join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {histLoading && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: '0.85rem' }}>{t('Chargement…','Loading…')}</div>
        )}

        {hasMore && !histLoading && (
          <button
            onClick={() => loadHistory(histPage + 1)}
            style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'DM Sans', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {t('Charger plus','Load more')} ↓
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   NEWS TAB
══════════════════════════════════════════ */
function NewsTab() {
  const t = useT()
  const [news, setNews] = useState(null)
  useEffect(() => { API.get('/api/news/feed').then(r => setNews(r.data)).catch(() => {}) }, [])
  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t('News Macro','Macro News')}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 20 }}>{t('Actualités géopolitiques et macroéconomiques filtrées','Filtered geopolitical and macroeconomic news')}</div>
      {news ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 16px', borderRadius: 10,
              background: news.risk === 'HIGH' ? 'rgba(239,68,68,0.1)' : news.risk === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${news.risk === 'HIGH' ? 'rgba(239,68,68,0.3)' : news.risk === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              color: news.risk === 'HIGH' ? '#FCA5A5' : news.risk === 'MEDIUM' ? '#FCD34D' : '#6EE7B7',
              fontSize: '0.85rem', fontWeight: 600 }}>
              {t('Risque macro','Macro risk')} : {news.risk} ({news.risk_score}/100)
            </div>
            {news.risk_explanation && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {news.risk_explanation}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {news.articles?.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; e.currentTarget.style.background = 'rgba(124,58,237,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', lineHeight: 1.4 }}>{a.title}</div>
                    {a.trusted && <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>✅ Trusted</span>}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 6 }}>{a.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>{a.source}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      ) : <div style={{ color: 'var(--muted)' }}>{t('Chargement des news…','Loading news…')}</div>}
    </div>
  )
}

/* ══════════════════════════════════════════
   LEADERBOARD TAB
══════════════════════════════════════════ */
function LeaderboardTab() {
  const t = useT()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  useEffect(() => { API.get('/api/portfolio/leaderboard').then(r => setRows(r.data)).catch(() => {}) }, [])
  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t('Classement','Leaderboard')}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 20 }}>{t('Capital de départ identique · 10 000$','Same starting capital · $10,000')}</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
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

/* ══════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════ */
function SettingsTab({ setToken, showToast }) {
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
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(79,70,229,0.05))',
        border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 14,
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
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px', marginBottom: 14 }}>
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
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px', marginBottom: 14 }}>
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
