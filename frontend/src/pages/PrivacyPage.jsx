/**
 * PrivacyPage.jsx — Politique de confidentialité ThePnLab
 * Page publique accessible sans connexion.
 *
 * Intégration dans App.jsx (routes publiques) :
 *   import PrivacyPage from './pages/PrivacyPage'
 *   <Route path="/privacy" element={<PrivacyPage />} />
 *
 * Et dans index.html ou footer, ajoute un lien :
 *   <a href="/privacy">Politique de confidentialité</a>
 */

import { useState } from 'react'

const SECTIONS_FR = [
  {
    icon: '🏢',
    title: 'Responsable du traitement',
    content: `ThePnLab est un projet éducatif développé par Hamza Houiralami, étudiant à Arts et Métiers ParisTech (Campus de Lille).

Contact : hamzahouiralami@gmail.com
Site : www.thepnlab.com`
  },
  {
    icon: '📋',
    title: 'Données collectées',
    content: `Lors de votre inscription, ThePnLab collecte :
• Votre prénom (ou pseudonyme)
• Votre adresse email
• Votre école / établissement (optionnel)
• Votre mot de passe (chiffré avec bcrypt — jamais stocké en clair)

Lors de l'utilisation de la plateforme, ThePnLab enregistre :
• Vos ordres simulés (ticker, côté, prix, quantité)
• L'évolution de votre portefeuille virtuel
• Vos snapshots d'équité (courbe de performance)`
  },
  {
    icon: '🎯',
    title: 'Finalités du traitement',
    content: `Vos données sont utilisées exclusivement pour :
• Faire fonctionner votre compte et votre portefeuille virtuel
• Afficher le classement entre utilisateurs (nom/pseudonyme + performance)
• Vous envoyer les emails transactionnels (confirmation d'inscription, réinitialisation de mot de passe)
• Améliorer la plateforme (analyses agrégées et anonymisées)

Aucune donnée n'est utilisée à des fins publicitaires ou commerciales.`
  },
  {
    icon: '⏱️',
    title: 'Durée de conservation',
    content: `Vos données sont conservées tant que votre compte est actif.

Si vous supprimez votre compte (disponible dans Paramètres → Supprimer mon compte), l'ensemble de vos données est définitivement effacé de nos serveurs dans un délai de 30 jours.`
  },
  {
    icon: '🤝',
    title: 'Partage des données',
    content: `ThePnLab ne vend, ne loue et ne partage jamais vos données personnelles avec des tiers à des fins commerciales.

Vos données peuvent être transmises à nos sous-traitants techniques uniquement dans le cadre du fonctionnement de la plateforme :
• Railway (hébergement backend et base de données) — serveurs EU
• Vercel (hébergement frontend) — CDN mondial
• Resend (envoi d'emails transactionnels)
• Google Analytics (statistiques de trafic anonymisées)`
  },
  {
    icon: '🍪',
    title: 'Cookies',
    content: `ThePnLab utilise uniquement des cookies techniques strictement nécessaires :
• Token d'authentification JWT (durée : 7 jours) — permet de rester connecté
• Préférence de langue (fr/en)
• Acceptation des CGU (stocké localement dans votre navigateur)

Aucun cookie publicitaire, aucun cookie de tracking tiers (Facebook Pixel, etc.).

Google Analytics est utilisé en mode anonymisé pour mesurer le trafic global. Aucune donnée personnelle identifiable n'est transmise à Google.`
  },
  {
    icon: '⚖️',
    title: 'Vos droits (RGPD)',
    content: `Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :

• Droit d'accès : obtenir une copie de vos données
• Droit de rectification : corriger des informations inexactes
• Droit à l'effacement : supprimer votre compte et toutes vos données
• Droit à la portabilité : recevoir vos données dans un format structuré
• Droit d'opposition : vous opposer à certains traitements

Pour exercer ces droits, contactez-nous à : hamzahouiralami@gmail.com
Nous répondrons dans un délai maximum de 30 jours.

Vous avez également le droit de déposer une réclamation auprès de la CNIL (www.cnil.fr).`
  },
  {
    icon: '🔒',
    title: 'Sécurité',
    content: `ThePnLab met en œuvre les mesures de sécurité suivantes :
• Mots de passe chiffrés avec bcrypt (salage automatique)
• Authentification par token JWT avec expiration
• Connexions chiffrées HTTPS sur l'ensemble de la plateforme
• Base de données accessible uniquement depuis le réseau interne Railway
• Aucun stockage de données bancaires (plateforme 100% simulée)`
  },
  {
    icon: '📅',
    title: 'Mise à jour de cette politique',
    content: `Cette politique de confidentialité a été mise à jour le 16 mars 2026.

ThePnLab se réserve le droit de modifier cette politique à tout moment. En cas de modification substantielle, les utilisateurs seront informés par email ou par notification dans l'application.`
  },
]

const SECTIONS_EN = [
  {
    icon: '🏢',
    title: 'Data controller',
    content: `ThePnLab is an educational project developed by Hamza Houiralami, student at Arts et Métiers ParisTech (Lille Campus).

Contact: hamzahouiralami@gmail.com
Website: www.thepnlab.com`
  },
  {
    icon: '📋',
    title: 'Data collected',
    content: `Upon registration, ThePnLab collects:
• Your first name (or username)
• Your email address
• Your school / institution (optional)
• Your password (hashed with bcrypt — never stored in plain text)

During platform use, ThePnLab records:
• Your simulated orders (ticker, side, price, quantity)
• Your virtual portfolio evolution
• Your equity snapshots (performance curve)`
  },
  {
    icon: '🎯',
    title: 'Processing purposes',
    content: `Your data is used exclusively to:
• Operate your account and virtual portfolio
• Display the leaderboard (name/username + performance)
• Send transactional emails (registration confirmation, password reset)
• Improve the platform (aggregated and anonymized analytics)

No data is used for advertising or commercial purposes.`
  },
  {
    icon: '⏱️',
    title: 'Retention period',
    content: `Your data is retained as long as your account is active.

If you delete your account (available in Settings → Delete my account), all your data is permanently erased from our servers within 30 days.`
  },
  {
    icon: '🤝',
    title: 'Data sharing',
    content: `ThePnLab never sells, rents, or shares your personal data with third parties for commercial purposes.

Your data may be processed by our technical subcontractors solely for platform operation:
• Railway (backend hosting and database) — EU servers
• Vercel (frontend hosting) — global CDN
• Resend (transactional email delivery)
• Google Analytics (anonymized traffic statistics)`
  },
  {
    icon: '🍪',
    title: 'Cookies',
    content: `ThePnLab uses only strictly necessary technical cookies:
• JWT authentication token (duration: 7 days) — keeps you logged in
• Language preference (fr/en)
• Terms acceptance (stored locally in your browser)

No advertising cookies, no third-party tracking cookies (Facebook Pixel, etc.).

Google Analytics is used in anonymized mode to measure overall traffic. No personally identifiable data is transmitted to Google.`
  },
  {
    icon: '⚖️',
    title: 'Your rights (GDPR)',
    content: `Under the General Data Protection Regulation (GDPR), you have the following rights:

• Right of access: obtain a copy of your data
• Right of rectification: correct inaccurate information
• Right to erasure: delete your account and all your data
• Right to portability: receive your data in a structured format
• Right to object: object to certain processing activities

To exercise these rights, contact us at: hamzahouiralami@gmail.com
We will respond within a maximum of 30 days.

You also have the right to lodge a complaint with your national data protection authority.`
  },
  {
    icon: '🔒',
    title: 'Security',
    content: `ThePnLab implements the following security measures:
• Passwords hashed with bcrypt (automatic salting)
• JWT authentication tokens with expiration
• HTTPS encrypted connections throughout the platform
• Database accessible only from Railway's internal network
• No storage of banking data (100% simulated platform)`
  },
  {
    icon: '📅',
    title: 'Policy updates',
    content: `This privacy policy was last updated on March 16, 2026.

ThePnLab reserves the right to modify this policy at any time. In case of substantial changes, users will be notified by email or in-app notification.`
  },
]

export default function PrivacyPage() {
  const [lang, setLang] = useState('fr')
  const isFr = lang === 'fr'
  const sections = isFr ? SECTIONS_FR : SECTIONS_EN

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0D0B1E 0%, #130F2E 100%)',
      padding: '40px 20px',
      fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: '#C4B5FD', marginBottom: 8 }}>
              📊 ThePnLab
            </div>
          </a>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#fff', marginBottom: 8 }}>
            {isFr ? '🔒 Politique de confidentialité' : '🔒 Privacy Policy'}
          </div>
          <div style={{ color: '#94A3B8', fontSize: '0.85rem', marginBottom: 20 }}>
            {isFr ? 'Dernière mise à jour : 16 mars 2026' : 'Last updated: March 16, 2026'}
          </div>

          {/* Lang toggle */}
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {['fr', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'DM Sans', fontWeight: 600, fontSize: '0.82rem',
                background: lang === l ? 'rgba(124,58,237,0.4)' : 'transparent',
                color: lang === l ? '#C4B5FD' : '#94A3B8',
                transition: 'all 0.2s',
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {/* Intro box */}
        <div style={{
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 16, padding: '20px 24px', marginBottom: 32,
          fontSize: '0.88rem', color: '#94A3B8', lineHeight: 1.7,
        }}>
          {isFr
            ? 'ThePnLab est une plateforme de simulation éducative. Aucun argent réel n\'est impliqué. Cette politique explique quelles données nous collectons, pourquoi, et comment vous pouvez les contrôler.'
            : 'ThePnLab is an educational simulation platform. No real money is involved. This policy explains what data we collect, why, and how you can control it.'}
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          {sections.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '22px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{s.title}</span>
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.83rem', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {s.content}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ color: '#64748B', fontSize: '0.78rem', marginBottom: 12 }}>
            © 2026 ThePnLab · {isFr ? 'Simulation éducative · Aucun argent réel' : 'Educational simulation · No real money'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <a href="/" style={{ color: '#7C3AED', fontSize: '0.78rem', textDecoration: 'none' }}>
              {isFr ? '← Retour à l\'accueil' : '← Back to home'}
            </a>
            <a href="mailto:hamzahouiralami@gmail.com" style={{ color: '#7C3AED', fontSize: '0.78rem', textDecoration: 'none' }}>
              {isFr ? 'Contact' : 'Contact'}
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}