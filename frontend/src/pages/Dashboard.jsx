import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import Academy from './Academy'
import LegalModal, { LegalPage } from './LegalModal'
import AboutPage from './AboutPage'
import Toast from '../components/Toast'
import TickerStrip from '../features/market/TickerStrip'
import MarketTab from '../features/market/MarketTab'
import PortfolioTab from '../features/portfolio/PortfolioTab'
import BotTab from '../features/bot/BotTab'
import NewsTab from '../features/news/NewsTab'
import LeaderboardTab from '../features/leaderboard/LeaderboardTab'
import SettingsTab from '../features/settings/SettingsTab'
import { LangContext } from '../context/LangContext'
import useIsMobile from '../lib/useIsMobile'

// Ré-exports historiques — certains fichiers importaient depuis Dashboard
export { LangContext, useLang, useT } from '../context/LangContext'

const NAV = [
  { path: 'market',      fr: '📈',  en: '📈',  labelFr: 'Marché',     labelEn: 'Market'     },
  { path: 'portfolio',   fr: '💼',  en: '💼',  labelFr: 'Portfolio',  labelEn: 'Portfolio'  },
  { path: 'bot',         fr: '🤖',  en: '🤖',  labelFr: 'Bot IA',     labelEn: 'AI Bot'     },
  { path: 'news',        fr: '📰',  en: '📰',  labelFr: 'News',       labelEn: 'News'       },
  { path: 'leaderboard', fr: '🏆',  en: '🏆',  labelFr: 'Classement', labelEn: 'Leaderboard'},
  { path: 'academy',     fr: '📚',  en: '📚',  labelFr: 'Académie',   labelEn: 'Academy'    },
]

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
