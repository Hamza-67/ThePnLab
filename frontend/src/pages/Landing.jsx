import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api/client'

export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled]           = useState(false)
  const [visibleSections, setVisibleSections] = useState(new Set())
  const [stats, setStats]                 = useState({ users: 0, trades: 0 })
  const [waitEmail, setWaitEmail]         = useState('')
  const [waitStatus, setWaitStatus]       = useState(null) // null | 'loading' | 'ok' | 'error'
  const [waitMsg, setWaitMsg]             = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) setVisibleSections(prev => new Set([...prev, e.target.id]))
      }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Fetch real stats once
  useEffect(() => {
    API.get('/api/auth/stats')
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [])

  const handleWaitlist = async (source = 'landing') => {
    if (!waitEmail.trim() || !waitEmail.includes('@')) {
      setWaitStatus('error')
      setWaitMsg('Entre un email valide 📧')
      return
    }
    setWaitStatus('loading')
    try {
      const res = await API.post('/api/auth/waitlist', { email: waitEmail.trim().toLowerCase(), source })
      setWaitStatus('ok')
      setWaitMsg(res.data.message)
    } catch (e) {
      setWaitStatus('error')
      setWaitMsg(e?.response?.data?.detail || 'Une erreur est survenue')
    }
  }

  const visible = (id) => visibleSections.has(id)

  return (
    <div style={{ minHeight: '100vh', background: '#08090F', color: '#EEF0F5', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glow { 0%,100%{opacity:0.5} 50%{opacity:0.85} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.6)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
        .anim-up { animation: fadeUp 0.7s cubic-bezier(.22,.68,0,1.2) forwards; }
        .anim-in { animation: fadeIn 0.6s ease forwards; }
        .hero-cta:hover { transform: translateY(-2px) !important; box-shadow: 0 16px 48px rgba(124,58,237,0.55) !important; }
        .hero-cta-sec:hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.2) !important; }
        .feat-card:hover { transform: translateY(-4px); border-color: rgba(124,58,237,0.4) !important; background: rgba(124,58,237,0.06) !important; }
        .feat-card { transition: all 0.25s ease; }
        .step-card:hover { border-color: rgba(124,58,237,0.35) !important; }
        .step-card { transition: all 0.25s ease; }
        .ticker-scroll { animation: ticker 28s linear infinite; white-space: nowrap; }
.waitlist-input:focus { border-color: rgba(124,58,237,0.6) !important; outline: none; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
        .waitlist-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,0.5) !important; }
        @media(max-width:640px){
          .nav-links { display:none !important; }
          .hero-title { font-size: 2.2rem !important; }
          .hero-sub { font-size: 0.92rem !important; }
          .stats-row { gap: 24px !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .cta-section { padding: 50px 20px !important; }
.academy-grid { grid-template-columns: 1fr !important; }
        }
        @media(max-width:400px){
          .features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Sticky Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 64,
        background: scrolled ? 'rgba(8,9,15,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <img src="/logo.png" alt="ThePnLab" style={{ height: 46, objectFit: 'contain' }} />

        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {['Fonctionnalités', 'Comment ça marche', 'Cours', 'Contact'].map((l, i) => (
            <button key={i} onClick={() => {
              const ids = ['features', 'how', 'academy', 'waitlist-section']
              document.getElementById(ids[i])?.scrollIntoView({ behavior: 'smooth' })
            }} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
              fontFamily: 'DM Sans', fontSize: '0.875rem', fontWeight: 500,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
            >{l}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => navigate('/login')} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '8px 18px',
            cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.85rem',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.25)'; e.target.style.color = '#fff' }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.color = 'rgba(255,255,255,0.7)' }}
          >Connexion</button>
          <button className="hero-cta" onClick={() => navigate('/login?signup=1')} style={{
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            border: 'none', color: '#fff', borderRadius: 10, padding: '8px 20px',
            cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.85rem',
            boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
            transition: 'all 0.2s',
          }}>Commencer →</button>
        </div>
      </nav>

      {/* ── Ambient background orbs ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -200, left: -200, width: 700, height: 700, background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)', animation: 'glow 8s ease infinite' }} />
        <div style={{ position: 'absolute', top: 400, right: -200, width: 600, height: 600, background: 'radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 65%)', animation: 'glow 10s ease infinite 3s' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '30%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 65%)', animation: 'glow 12s ease infinite 6s' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── HERO ── */}
        <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 20px 60px', textAlign: 'center' }}>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 999, padding: '6px 16px', marginBottom: 28,
            animation: 'fadeUp 0.6s ease forwards',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
            <span style={{ color: '#A78BFA', fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5 }}>
              {stats.users > 0 ? `${stats.users} étudiants actifs · ` : ''}Plateforme éducative · 100% gratuite
            </span>
          </div>

          {/* Title */}
          <h1 className="hero-title" style={{
            fontFamily: 'Syne', fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
            fontWeight: 900, lineHeight: 1.08, letterSpacing: -2,
            color: '#fff', marginBottom: 24, maxWidth: 820,
            animation: 'fadeUp 0.7s 0.1s ease both',
          }}>
            Apprends le trading.<br />
            <span style={{
              background: 'linear-gradient(135deg, #A78BFA 0%, #60A5FA 50%, #34D399 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Sans risquer un centime.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="hero-sub" style={{
            fontSize: 'clamp(0.95rem, 2.2vw, 1.1rem)', color: 'rgba(255,255,255,0.45)',
            maxWidth: 560, lineHeight: 1.75, marginBottom: 44,
            animation: 'fadeUp 0.7s 0.2s ease both',
          }}>
            Données de marché réelles. Spot, CFD et Futures avec levier. Bot IA transparent.
            Coach personnalisé. Tout ce qu'il faut pour maîtriser les marchés financiers.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeUp 0.6s 0.3s ease both' }}>
            <button className="hero-cta" onClick={() => navigate('/login?signup=1')} style={{
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              border: 'none', color: '#fff', borderRadius: 14,
              padding: '15px 36px', fontFamily: 'DM Sans', fontWeight: 700,
              fontSize: '1rem', cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124,58,237,0.45)',
              transition: 'all 0.2s',
            }}>
              Créer mon compte — c'est gratuit
            </button>
            <button className="hero-cta-sec" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.75)', borderRadius: 14,
              padding: '15px 28px', fontFamily: 'DM Sans', fontWeight: 600,
              fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              Voir comment ça marche
            </button>
          </div>

          {/* Social proof */}
          <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeUp 0.6s 0.45s ease both' }}>
            <div style={{ display: 'flex' }}>
              {['#7C3AED','#4F46E5','#10B981','#F59E0B','#EF4444'].map((c, i) => (
                <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', background: c, border: '2px solid #08090F', marginLeft: i ? -8 : 0 }} />
              ))}
            </div>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
              {stats.users > 0 ? `${stats.users} étudiants inscrits` : 'Rejoins des centaines d\'étudiants'} · <span style={{ color: '#A78BFA' }}>0€ requis</span>
            </span>
          </div>

          {/* Mock dashboard card */}
          <div className="glass-panel" style={{
            marginTop: 64, width: '100%', maxWidth: 860,
            padding: '24px 28px',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 40px 120px rgba(0,0,0,0.5)',
            animation: 'fadeUp 0.8s 0.55s ease both',
          }}>
            {/* Mock header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['#EF4444','#F59E0B','#10B981'].map((c,i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'DM Mono', letterSpacing: 1 }}>THEPNLAB · SIMULATION</div>
              <div style={{ width: 60 }} />
            </div>

            {/* Mock content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Portfolio', val: '$12,340', change: '+23.4%', up: true },
                { label: 'Cash', val: '$4,218', change: 'disponible', up: null },
                { label: 'Win Rate', val: '68%', change: '34 trades', up: true },
                { label: 'Bot IA', val: '$13,850', change: '+38.5%', up: true },
              ].map((m, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.label}</div>
                  <div style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{m.val}</div>
                  <div style={{ fontSize: '0.72rem', color: m.up === true ? '#10B981' : m.up === false ? '#EF4444' : 'rgba(255,255,255,0.3)', marginTop: 2 }}>{m.change}</div>
                </div>
              ))}
            </div>

            {/* Mock chart bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60 }}>
              {[35,52,40,68,45,72,55,80,60,75,82,90,78,95,88].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`,
                  background: i === 14 ? 'linear-gradient(180deg, #7C3AED, #4F46E5)' : `rgba(124,58,237,${0.15 + h/300})`,
                  borderRadius: '3px 3px 0 0',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Ticker strip ── */}
        <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0', background: 'rgba(255,255,255,0.015)' }}>
          <div className="ticker-scroll" style={{ display: 'inline-flex', gap: 40 }}>
            {[...Array(2)].map((_, rep) =>
              [
                { t: 'NVDA',    p: '$875.40',  c: '+3.8%', up: true },
                { t: 'TQQQ',   p: '$62.15',   c: '+4.2%', up: true },
                { t: 'BTC-USD',p: '$68,240',  c: '+2.1%', up: true },
                { t: 'PLTR',   p: '$24.80',   c: '+5.6%', up: true },
                { t: 'SOXL',   p: '$37.20',   c: '+6.1%', up: true },
                { t: 'AAPL',   p: '$189.84',  c: '+1.2%', up: true },
                { t: 'COIN',   p: '$214.50',  c: '+2.1%', up: true },
                { t: 'SOL-USD',p: '$185.60',  c: '+7.2%', up: true },
                { t: 'MSTR',   p: '$1,340',   c: '+8.4%', up: true },
                { t: 'SPY',    p: '$521.40',  c: '+0.4%', up: true },
                { t: 'TSLA',   p: '$248.73',  c: '+1.8%', up: true },
                { t: 'MC.PA',  p: '€748.20',  c: '+0.6%', up: true },
                { t: 'IONQ',   p: '$28.90',   c: '+9.3%', up: true },
                { t: 'RDDT',   p: '$62.40',   c: '+3.1%', up: true },
                { t: 'NVDL',   p: '$41.80',   c: '+7.4%', up: true },
              ].map((item, i) => (
                <span key={`${rep}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'DM Mono', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.t}</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{item.p}</span>
                  <span style={{ color: item.up ? '#10B981' : '#EF4444' }}>{item.c}</span>
                  <span style={{ color: 'rgba(255,255,255,0.1)', marginLeft: 8 }}>·</span>
                </span>
              ))
            )}
          </div>
        </div>

        {/* ── Stats réels ── */}
        <section style={{ padding: '80px 20px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="stats-row" style={{ display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { val: '$10 000', label: 'Capital virtuel de départ', sub: 'pour tous les utilisateurs' },
              { val: stats.users > 0 ? `${stats.users}+` : '100+', label: 'Étudiants inscrits', sub: 'et ça grandit chaque semaine' },
              { val: '16', label: 'Cours niveau Master', sub: 'de débutant à expert' },
              { val: '0€', label: 'Risque réel', sub: 'simulation complète' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne', fontSize: '2.4rem', fontWeight: 900, background: 'linear-gradient(135deg, #A78BFA, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginTop: 6 }}>{s.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" data-animate style={{ padding: '40px 20px 80px', maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, color: '#A78BFA', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Fonctionnalités</div>
            <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: -1, marginBottom: 12 }}>
              Tout ce qu'un trader en herbe a besoin
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Une plateforme complète pensée pour les étudiants qui veulent vraiment comprendre les marchés.
            </p>
          </div>

          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              {
                icon: '📈', color: '#7C3AED',
                title: 'Spot, CFD & Futures',
                desc: 'Trade au comptant ou avec levier (x2-x20) en long comme en short : marge, prix de liquidation, financement overnight — comme sur un vrai broker, sans le risque.',
                tag: 'Nouveau',
              },
              {
                icon: '🤖', color: '#4F46E5',
                title: 'Bot IA transparent',
                desc: 'Le bot analyse RSI, MACD, ADX et momentum chaque heure, avec 5 garde-fous codés (régime SPY, VIX, ML-ban). Chaque décision est expliquée en français — apprends en l\'observant.',
                tag: 'v6',
              },
              {
                icon: '💬', color: '#10B981',
                title: 'Coach IA personnalisé',
                desc: 'Coach adapté à ton historique de trades. Répond à tes questions en temps réel avec contexte de marché. Anti-répétition intégré — vraiment.',
                tag: 'ML',
              },
              {
                icon: '📚', color: '#F59E0B',
                title: 'Académie · 16 cours',
                desc: 'Bougies japonaises, RSI, MACD, Momentum, Machine Learning, Risque 2%... Des cours structurés niveau Master, de 7 à 25 minutes.',
                tag: 'Expert',
              },
              {
                icon: '📰', color: '#EF4444',
                title: 'News macro en direct',
                desc: 'Bulletins EU (9h) et US (15h30) — géopolitique, Fed, résultats trimestriels. Comprends l\'impact des actualités sur les marchés.',
                tag: 'Daily',
              },
              {
                icon: '🏆', color: '#A78BFA',
                title: 'Classement & compétition',
                desc: 'Compare tes performances avec ton école. Capital identique pour tous — seule la stratégie compte. Rankings en temps réel.',
                tag: 'Social',
              },
            ].map((f, i) => (
              <div key={i} className="feat-card glass-panel" style={{
                padding: '28px 24px', cursor: 'default',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(${f.color === '#7C3AED' ? '124,58,237' : f.color === '#4F46E5' ? '79,70,229' : f.color === '#10B981' ? '16,185,129' : f.color === '#F59E0B' ? '245,158,11' : f.color === '#EF4444' ? '239,68,68' : '167,139,250'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                    {f.icon}
                  </div>
                  <span style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 99, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#A78BFA', letterSpacing: 0.5 }}>{f.tag}</span>
                </div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1rem', color: '#fff', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" data-animate style={{ padding: '40px 20px 80px', maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, color: '#6EE7B7', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Comment ça marche</div>
            <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
              Prêt en moins de 2 minutes
            </h2>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              {
                num: '01', color: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.3)',
                title: 'Crée ton compte',
                desc: 'Inscription rapide avec ton email. 10 000$ crédités instantanément.',
                detail: 'Aucune carte bancaire requise',
              },
              {
                num: '02', color: 'rgba(79,70,229,0.2)', borderColor: 'rgba(79,70,229,0.3)',
                title: 'Explore & trade',
                desc: 'Accède à 55+ actifs en temps réel. Analyse les graphiques, passe tes ordres.',
                detail: 'Marché US, CAC40, Crypto, Matières premières',
              },
              {
                num: '03', color: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.3)',
                title: 'Apprends & progresse',
                desc: 'Suis les cours de l\'Académie, pose tes questions au Coach IA, compare-toi avec le leaderboard.',
                detail: 'Du débutant à l\'expert',
              },
            ].map((s, i) => (
              <div key={i} className="step-card" style={{
                background: s.color, border: `1px solid ${s.borderColor}`,
                borderRadius: 20, padding: '28px 24px',
              }}>
                <div style={{ fontFamily: 'DM Mono', fontSize: '2.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.15)', lineHeight: 1, marginBottom: 16 }}>{s.num}</div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '1.05rem', color: '#fff', marginBottom: 10 }}>{s.title}</div>
                <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 12 }}>{s.desc}</div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>{s.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Academy preview ── */}
        <section id="academy" data-animate style={{ padding: '40px 20px 80px', maxWidth: 1000, margin: '0 auto' }}>
          <div className="academy-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, color: '#FCD34D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>Académie</div>
              <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, color: '#fff', letterSpacing: -1, lineHeight: 1.2, marginBottom: 16 }}>
                Des cours qui font vraiment la différence
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem', lineHeight: 1.75, marginBottom: 28 }}>
                16 cours structurés, de la bougie japonaise à la gestion quantitative du risque. Chaque cours est conçu par des passionnés de finance pour des étudiants ambitieux.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Débutant', count: 5, color: '#10B981' },
                  { label: 'Intermédiaire', count: 7, color: '#F59E0B' },
                  { label: 'Expert', count: 4, color: '#A78BFA' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{l.label}</span>
                    <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem', color: l.color, marginLeft: 'auto' }}>{l.count} cours</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🕯️', title: 'Bougies japonaises', level: 'Débutant', time: '12 min', color: '#10B981' },
                { icon: '📊', title: 'RSI & MACD avancé', level: 'Intermédiaire', time: '18 min', color: '#F59E0B' },
                { icon: '⚡', title: 'Momentum & High-Beta', level: 'Expert', time: '15 min', color: '#A78BFA' },
                { icon: '🧠', title: 'Machine Learning trading', level: 'Intermédiaire', time: '10 min', color: '#F59E0B' },
                { icon: '🛡️', title: 'Règle des 2% · Risk Mgmt', level: 'Débutant', time: '7 min', color: '#10B981' },
              ].map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: '12px 16px', transition: 'all 0.2s', cursor: 'default',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; e.currentTarget.style.background = 'rgba(124,58,237,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.025)' }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{c.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>{c.level} · {c.time}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bot showcase ── */}
        <section style={{ padding: '40px 20px 80px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 999, padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, color: '#818CF8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>Bot IA v6</div>
          <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, color: '#fff', letterSpacing: -1, marginBottom: 12 }}>
            Un adversaire IA à battre
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7, fontSize: '0.9rem' }}>
            Un cycle d'analyse par heure, un monitor TP/SL toutes les 10 minutes, et des garde-fous
            codés en dur contre les marchés baissiers. Apprends en observant ses décisions expliquées.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 680, margin: '0 auto' }}>
            {[
              { label: 'Take Profit', val: '+15%', color: '#10B981' },
              { label: 'Stop Loss', val: '-7%', color: '#EF4444' },
              { label: 'Pyramiding', val: '+10%', color: '#F59E0B' },
              { label: 'Allocation max', val: '15%', color: '#A78BFA' },
            ].map((m, i) => (
              <div key={i} className="glass-panel card-hover" style={{ padding: '16px 12px' }}>
                <div style={{ fontFamily: 'DM Mono', fontSize: '1.4rem', fontWeight: 700, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </section>


        {/* ══════════════════════════════════════════
            WAITLIST / EMAIL CAPTURE
        ══════════════════════════════════════════ */}
        <section id="waitlist-section" data-animate style={{ padding: '40px 20px 80px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(79,70,229,0.07))',
            border: '1px solid rgba(124,58,237,0.25)',
            borderRadius: 28, padding: '48px 40px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Live counter */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 99, padding: '4px 12px', marginBottom: 24 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulse-dot 2s infinite', display: 'inline-block' }} />
              <span style={{ fontSize: '0.72rem', color: '#6EE7B7', fontWeight: 600 }}>
                {stats.waitlist > 0 ? `${stats.waitlist} personnes sur la liste` : 'Sois parmi les premiers'}
              </span>
            </div>

            <h2 style={{ fontFamily: 'Syne', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 12, position: 'relative' }}>
              Reste informé des nouveautés 🚀
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 1.7, fontSize: '0.88rem', position: 'relative' }}>
              Nouvelles fonctionnalités, mises à jour du bot IA, cours inédits — sois le premier à les recevoir directement dans ta boîte mail.
            </p>

            {waitStatus === 'ok' ? (
              <div style={{
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 14, padding: '18px 24px', fontSize: '0.9rem', color: '#6EE7B7', fontWeight: 600,
              }}>
                🎉 {waitMsg}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
                <input
                  className="waitlist-input"
                  type="email"
                  placeholder="ton@email.com"
                  value={waitEmail}
                  onChange={e => { setWaitEmail(e.target.value); setWaitStatus(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleWaitlist('landing')}
                  style={{
                    flex: 1, padding: '13px 18px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${waitStatus === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    color: '#fff', fontFamily: 'DM Sans', fontSize: '0.9rem',
                    transition: 'border-color 0.2s',
                  }}
                />
                <button
                  className="waitlist-btn"
                  onClick={() => handleWaitlist('landing')}
                  disabled={waitStatus === 'loading'}
                  style={{
                    padding: '13px 22px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    border: 'none', color: '#fff', fontFamily: 'DM Sans', fontWeight: 700,
                    fontSize: '0.9rem', cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                    opacity: waitStatus === 'loading' ? 0.7 : 1,
                  }}
                >
                  {waitStatus === 'loading' ? '...' : 'Me notifier →'}
                </button>
              </div>
            )}

            {waitStatus === 'error' && (
              <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#F87171' }}>{waitMsg}</div>
            )}

            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', marginTop: 16 }}>
              Aucun spam · Désabonnement en 1 clic · RGPD compliant
            </div>
          </div>
        </section>

        {/* ── CTA banner ── */}
        <section className="cta-section" style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{
            maxWidth: 680, margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.08))',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 28, padding: '56px 40px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, background: 'radial-gradient(ellipse, rgba(124,58,237,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ fontFamily: 'Syne', fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 900, color: '#fff', marginBottom: 14, letterSpacing: -0.5, position: 'relative' }}>
              Commence à trader aujourd'hui.
            </div>
            <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 32, lineHeight: 1.7, fontSize: '0.9rem', position: 'relative' }}>
              Rejoins la plateforme, reçois 10 000$ virtuels et découvre si tu as l'étoffe d'un trader.
            </p>
            <button className="hero-cta" onClick={() => navigate('/login?signup=1')} style={{
              background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              border: 'none', color: '#fff', borderRadius: 14,
              padding: '16px 40px', fontFamily: 'DM Sans', fontWeight: 700,
              fontSize: '1rem', cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
              transition: 'all 0.2s', position: 'relative',
            }}>
              Créer mon compte gratuit →
            </button>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', marginTop: 16 }}>Aucune carte bancaire · Aucun risque · 100% éducatif</div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '28px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
          background: 'rgba(255,255,255,0.01)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/logo.png" alt="ThePnLab" style={{ height: 28, objectFit: 'contain', opacity: 0.6 }} />
            <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.2)' }}>© 2026 · Simulation éducative — aucun argent réel</span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {[
              { label: 'Confidentialité', href: '/privacy' },
              { label: 'Mentions légales', href: '/privacy' },
              { label: 'Contact', href: 'mailto:hamzahouiralami@gmail.com' },
            ].map((l, i) => (
              <a key={i} href={l.href} style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.25)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = '#C4B5FD'}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.25)'}
              >{l.label}</a>
            ))}
          </div>
        </footer>

      </div>
    </div>
  )
}
