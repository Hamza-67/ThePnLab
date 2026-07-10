/**
 * LegalModal.jsx — Consentement CGU + Mentions légales ThePnLab
 *
 * Intégration dans App.jsx ou Dashboard.jsx :
 *   import LegalModal from './LegalModal'
 *   // Dans le composant, après login :
 *   const [legalAccepted, setLegalAccepted] = useState(
 *     () => localStorage.getItem('tl_legal_accepted') === 'true'
 *   )
 *   {!legalAccepted && <LegalModal onAccept={() => {
 *     localStorage.setItem('tl_legal_accepted', 'true')
 *     setLegalAccepted(true)
 *   }} />}
 */

import { useState } from 'react'

/* ── Contenu CGU ── */
const CGU_FR = `
**1. Objet**
ThePnLab est une plateforme éducative de simulation de trading. Aucun ordre réel n'est passé sur les marchés financiers. Aucun argent réel n'est engagé.

**2. Données simulées**
Les prix affichés sont des données de marché réelles fournies à titre informatif. Les performances passées ne préjugent pas des performances futures. Les analyses et recommandations du bot IA sont purement éducatives.

**3. Absence de conseil financier**
ThePnLab ne fournit pas de conseils en investissement. Les contenus de la plateforme ne constituent pas des recommandations d'achat ou de vente de valeurs mobilières. L'utilisateur est seul responsable de ses décisions d'investissement réelles.

**4. Données personnelles**
ThePnLab collecte uniquement les données nécessaires au fonctionnement du service (nom, école, mot de passe chiffré). Aucune donnée n'est vendue à des tiers. Conformément au RGPD, vous pouvez demander la suppression de vos données depuis les Paramètres.

**5. Responsabilité**
ThePnLab ne peut être tenu responsable d'erreurs dans les données de marché, d'interruptions de service, ou de décisions prises par l'utilisateur sur la base des informations affichées.

**6. Acceptation**
En utilisant ThePnLab, vous acceptez les présentes conditions d'utilisation. Vous confirmez avoir au moins 16 ans.
`

const CGU_EN = `
**1. Purpose**
ThePnLab is an educational trading simulation platform. No real orders are placed on financial markets. No real money is involved.

**2. Simulated data**
Displayed prices are real market data provided for informational purposes only. Past performance does not guarantee future results. Bot AI analyses and recommendations are purely educational.

**3. No financial advice**
ThePnLab does not provide investment advice. Platform content does not constitute buy or sell recommendations for securities. The user is solely responsible for their real investment decisions.

**4. Personal data**
ThePnLab only collects data necessary for the service (name, school, encrypted password). No data is sold to third parties. In accordance with GDPR, you can request data deletion from Settings.

**5. Liability**
ThePnLab cannot be held liable for errors in market data, service interruptions, or decisions made by users based on displayed information.

**6. Acceptance**
By using ThePnLab, you accept these terms of use. You confirm you are at least 16 years old.
`

/* ── Modal de consentement ── */
export function LegalModal({ onAccept, lang = 'fr' }) {
  const [checked, setChecked] = useState(false)
  const [tab, setTab]         = useState('cgu')
  const isFr = lang === 'fr'

  const content = isFr ? CGU_FR : CGU_EN

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #0D0B1E, #130F2E)',
        border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 20, padding: 32, maxWidth: 560, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🏛️</div>
          <div>
            <div style={{ fontFamily: 'Syne', fontWeight: 800, color: '#fff', fontSize: '1.1rem' }}>ThePnLab</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{isFr ? 'Conditions d\'utilisation' : 'Terms of use'}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'cgu',      label: isFr ? '📄 CGU' : '📄 Terms'    },
            { key: 'mentions', label: isFr ? '⚖️ Mentions légales' : '⚖️ Legal notice' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans', fontSize: '0.82rem', fontWeight: 600,
              background: tab === t.key ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
              color: tab === t.key ? '#C4B5FD' : 'var(--muted)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Contenu scrollable */}
        <div style={{
          maxHeight: 260, overflowY: 'auto', padding: '16px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, marginBottom: 20, fontSize: '0.82rem', color: '#94A3B8', lineHeight: 1.7,
        }}>
          {tab === 'cgu' ? (
            <LegalText content={content} />
          ) : (
            <MentionsLegales lang={lang} />
          )}
        </div>

        {/* Checkbox */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#7C3AED', width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.83rem', color: '#CBD5E1', lineHeight: 1.5 }}>
            {isFr
              ? 'Je confirme avoir lu et accepté les conditions d\'utilisation. Je comprends que ThePnLab est une simulation éducative sans argent réel.'
              : 'I confirm I have read and accepted the terms of use. I understand ThePnLab is an educational simulation with no real money.'}
          </span>
        </label>

        {/* Bouton */}
        <button onClick={onAccept} disabled={!checked} style={{
          width: '100%', padding: '13px', borderRadius: 12, border: 'none',
          background: checked ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'rgba(255,255,255,0.05)',
          color: checked ? '#fff' : 'var(--muted)',
          fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.95rem',
          cursor: checked ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          boxShadow: checked ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
        }}>
          {isFr ? '✅ Accéder à ThePnLab' : '✅ Access ThePnLab'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.72rem', color: 'var(--muted)' }}>
          {isFr ? 'Simulation uniquement · Aucun argent réel · RGPD conforme' : 'Simulation only · No real money · GDPR compliant'}
        </div>
      </div>
    </div>
  )
}

/* ── Rendu du texte CGU (gras sur les titres) ── */
function LegalText({ content }) {
  return (
    <div>
      {content.trim().split('\n').map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} style={{ color: '#C4B5FD', fontWeight: 700, marginTop: i > 0 ? 12 : 0, marginBottom: 4 }}>{line.replace(/\*\*/g, '')}</div>
        }
        return <div key={i} style={{ marginBottom: 2 }}>{line}</div>
      })}
    </div>
  )
}

/* ── Mentions légales ── */
function MentionsLegales({ lang }) {
  const isFr = lang === 'fr'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        {
          title: isFr ? 'Éditeur' : 'Publisher',
          content: isFr
            ? 'ThePnLab est un projet éducatif développé dans le cadre d\'un cursus académique. Il ne constitue pas une entreprise commerciale enregistrée.'
            : 'ThePnLab is an educational project developed as part of an academic curriculum. It does not constitute a registered commercial entity.',
        },
        {
          title: isFr ? 'Hébergement' : 'Hosting',
          content: isFr
            ? 'L\'application est hébergée localement en environnement de développement. En production, les données sont stockées sur des serveurs sécurisés.'
            : 'The application is hosted locally in a development environment. In production, data is stored on secure servers.',
        },
        {
          title: isFr ? 'Propriété intellectuelle' : 'Intellectual property',
          content: isFr
            ? 'Le code source, le design et les contenus pédagogiques de ThePnLab sont la propriété de leurs auteurs. Toute reproduction est interdite sans autorisation.'
            : 'The source code, design and educational content of ThePnLab are the property of their authors. Any reproduction without permission is prohibited.',
        },
        {
          title: isFr ? 'Données personnelles (RGPD)' : 'Personal data (GDPR)',
          content: isFr
            ? 'Les données collectées (nom, école, performance de simulation) sont utilisées uniquement pour le fonctionnement de la plateforme. Droit d\'accès, rectification et suppression disponibles via Paramètres.'
            : 'Data collected (name, school, simulation performance) is used solely for platform operation. Right of access, correction and deletion available via Settings.',
        },
        {
          title: isFr ? 'Cookies' : 'Cookies',
          content: isFr
            ? 'ThePnLab utilise uniquement des cookies techniques essentiels (token d\'authentification, préférence de langue). Aucun cookie publicitaire ou de tracking.'
            : 'ThePnLab uses only essential technical cookies (authentication token, language preference). No advertising or tracking cookies.',
        },
      ].map((item, i) => (
        <div key={i}>
          <div style={{ color: '#C4B5FD', fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
          <div style={{ color: '#94A3B8' }}>{item.content}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Page légale accessible depuis Settings ── */
export function LegalPage({ lang = 'fr' }) {
  const [tab, setTab] = useState('cgu')
  const isFr = lang === 'fr'

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
        ⚖️ {isFr ? 'Informations légales' : 'Legal information'}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 24 }}>
        {isFr ? 'Conditions d\'utilisation · Mentions légales · RGPD' : 'Terms of use · Legal notice · GDPR'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'cgu',      label: isFr ? '📄 CGU' : '📄 Terms'              },
          { key: 'mentions', label: isFr ? '⚖️ Mentions légales' : '⚖️ Legal notice' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'DM Sans', fontSize: '0.83rem', fontWeight: 600,
            background: tab === t.key ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--muted)',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.8 }}>
        {tab === 'cgu'
          ? <LegalText content={isFr ? CGU_FR : CGU_EN} />
          : <MentionsLegales lang={lang} />
        }
      </div>

      <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.78rem', color: '#6EE7B7' }}>
        ✅ {isFr
          ? 'Tu as accepté ces conditions le jour de ton inscription. Pour supprimer tes données, utilise la section "Supprimer mon compte" dans les Paramètres.'
          : 'You accepted these terms on the day of your registration. To delete your data, use the "Delete my account" section in Settings.'}
      </div>
    </div>
  )
}

export default LegalModal