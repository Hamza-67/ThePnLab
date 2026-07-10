import { useState, useEffect } from 'react'

const STATS = [
  { icon: '📈', value: '50+', label: 'Actifs tradables' },
  { icon: '🤖', value: '3x', label: 'Cycles IA / jour' },
  { icon: '🎓', value: '100%', label: 'Éducatif & gratuit' },
  { icon: '⚡', value: '<2min', label: 'Données temps réel' },
]

const TIMELINE = [
  { date: 'Sept. 2025', label: 'Idée initiale', desc: 'Constat : aucun outil ne permet aux étudiants de vraiment comprendre les marchés sans risquer leur argent.' },
  { date: 'Nov. 2025', label: 'Premiers commits', desc: 'Stack choisie : FastAPI + React. Premiers graphiques OHLC, premiers ordres simulés.' },
  { date: 'Janv. 2026', label: 'Bot IA v1', desc: 'Intégration de Gemini 2.5 Flash. Le bot commence à trader de façon autonome 3 fois par jour.' },
  { date: '16 mars 2026', label: '🚀 Lancement beta', desc: 'ThePnLab est en ligne sur www.thepnlab.com. Premiers utilisateurs, premiers trades réels simulés.' },
]

const TECH = [
  { name: 'FastAPI', desc: 'Backend Python haute performance', color: '#10B981' },
  { name: 'React 18', desc: 'Interface utilisateur dynamique', color: '#60A5FA' },
  { name: 'PostgreSQL', desc: 'Base de données relationnelle', color: '#A78BFA' },
  { name: 'Gemini 2.5', desc: 'Intelligence artificielle de trading', color: '#FBBF24' },
  { name: 'Railway', desc: 'Infrastructure cloud scalable', color: '#F472B6' },
  { name: 'Vercel', desc: 'Déploiement frontend mondial', color: '#E2E8F0' },
]

export default function AboutPage({ lang = 'fr' }) {
  const isFr = lang === 'fr'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
  }, [])

  return (
    <div style={{
      maxWidth: 720,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all 0.5s ease',
    }}>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.08))',
        border: '1px solid rgba(124,58,237,0.25)',
        borderRadius: 24, padding: '40px 36px', marginBottom: 32, position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow bg */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2), transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ fontSize: '2.8rem', marginBottom: 12 }}>📊</div>
        <div style={{ fontFamily: 'Syne', fontWeight: 900, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: '#fff', marginBottom: 12, lineHeight: 1.2 }}>
          {isFr ? 'La salle de marché\ndes étudiants.' : 'The students\'\ntrading floor.'}
        </div>
        <div style={{ color: '#94A3B8', fontSize: '1rem', lineHeight: 1.7, maxWidth: 520 }}>
          {isFr
            ? 'ThePnLab donne accès à une expérience de trading professionnelle — données réelles, bot IA, classement live — sans jamais risquer un seul euro. Parce que la meilleure façon d\'apprendre la finance, c\'est de la pratiquer.'
            : 'ThePnLab gives access to a professional trading experience — real data, AI bot, live rankings — without ever risking a single euro. Because the best way to learn finance is to practice it.'}
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
        {STATS.map((s, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: '1.8rem' }}>{s.icon}</div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '1.5rem', color: '#C4B5FD' }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CRÉATEUR ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '28px 28px', marginBottom: 32,
      }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 20 }}>
          👨‍💻 {isFr ? 'Le créateur' : 'The creator'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 800, color: '#fff', fontFamily: 'Syne',
          }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>Hamza</div>
            <div style={{ color: '#7C3AED', fontSize: '0.83rem', fontWeight: 600, marginBottom: 8 }}>
              Arts et Métiers ParisTech — Campus de Lille
            </div>
            <div style={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.7 }}>
              {isFr
                ? 'Étudiant ingénieur passionné par la finance quantitative et le machine learning. ThePnLab est né d\'une conviction simple : les étudiants méritent des outils professionnels pour apprendre à trader, sans jamais risquer leur argent.'
                : 'Engineering student passionate about quantitative finance and machine learning. ThePnLab was born from a simple conviction: students deserve professional tools to learn trading, without ever risking their money.'}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <a href="https://fr.linkedin.com/in/hamza-houir-alami-016a88372" target="_blank" rel="noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                background: 'rgba(10,102,194,0.15)', border: '1px solid rgba(10,102,194,0.3)',
                color: '#60A5FA', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                transition: 'all 0.2s',
              }}>
                🔗 LinkedIn
              </a>
              <a href="mailto:hamzahouiralami@gmail.com" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                color: '#C4B5FD', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
              }}>
                ✉️ Contact
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIMELINE ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '28px 28px', marginBottom: 32,
      }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 24 }}>
          🗓️ {isFr ? 'Histoire du projet' : 'Project history'}
        </div>
        <div style={{ position: 'relative' }}>
          {/* Ligne verticale */}
          <div style={{
            position: 'absolute', left: 71, top: 0, bottom: 0, width: 1,
            background: 'linear-gradient(to bottom, rgba(124,58,237,0.6), rgba(124,58,237,0.05))',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {TIMELINE.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 64, textAlign: 'right', fontSize: '0.72rem', color: 'var(--muted)', paddingTop: 3, lineHeight: 1.4 }}>
                  {item.date}
                </div>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                  background: i === TIMELINE.length - 1 ? '#7C3AED' : 'var(--border)',
                  border: `2px solid ${i === TIMELINE.length - 1 ? '#C4B5FD' : 'var(--border)'}`,
                  boxShadow: i === TIMELINE.length - 1 ? '0 0 12px rgba(124,58,237,0.6)' : 'none',
                  position: 'relative', zIndex: 1,
                }} />
                <div style={{ flex: 1, paddingBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.88rem', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ color: '#94A3B8', fontSize: '0.82rem', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STACK TECH ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '28px 28px', marginBottom: 32,
      }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 20 }}>
          ⚙️ {isFr ? 'Stack technique' : 'Tech stack'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {TECH.map((t, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.82rem' }}>{t.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTACT / PARTENARIAT ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.06))',
        border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 20, padding: '28px 28px',
      }}>
        <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1rem', marginBottom: 8 }}>
          🤝 {isFr ? 'Partenariats & contact' : 'Partnerships & contact'}
        </div>
        <div style={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 20 }}>
          {isFr
            ? 'ThePnLab est ouvert aux partenariats avec des clubs de finance, associations étudiantes, et établissements souhaitant intégrer la plateforme dans leur cursus. Chaque collaboration est gratuite en phase beta.'
            : 'ThePnLab is open to partnerships with finance clubs, student associations, and institutions wishing to integrate the platform into their curriculum. Every collaboration is free during the beta phase.'}
        </div>
        <a href="mailto:hamzahouiralami@gmail.com" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 20px', borderRadius: 12,
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          color: '#fff', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
        }}>
          ✉️ {isFr ? 'Nous contacter' : 'Contact us'}
        </a>
      </div>

    </div>
  )
}