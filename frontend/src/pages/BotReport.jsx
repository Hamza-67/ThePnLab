import { useState, useEffect } from 'react'
import API from '../api/client'

/* ═══════════════════════════════════════════════════════════════
   BotReport.jsx — Rapport quotidien du bot TradingLab
   Affiche ce que le bot a fait aujourd'hui + pourquoi
═══════════════════════════════════════════════════════════════ */

const ACTION_COLORS = {
  BUY:  { bg: 'rgba(16, 185, 129, 0.12)', border: '#10b981', text: '#10b981', label: 'ACHAT' },
  SELL: { bg: 'rgba(239, 68, 68, 0.12)',  border: '#ef4444', text: '#ef4444', label: 'VENTE' },
  HOLD: { bg: 'rgba(107, 114, 128, 0.1)', border: '#6b7280', text: '#9ca3af', label: 'ATTENTE' },
}

const RISK_BADGE = {
  LOW:    { color: '#10b981', label: 'Risque faible' },
  MEDIUM: { color: '#f59e0b', label: 'Risque modéré' },
  HIGH:   { color: '#ef4444', label: 'Risque élevé' },
}

const CONFIDENCE_STARS = { HIGH: '●●●', MEDIUM: '●●○', LOW: '●○○' }

export default function BotReport({ lang = 'fr' }) {
  const [report, setReport]       = useState(null)
  const [perf, setPerf]           = useState(null)
  const [status, setStatus]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState({})
  const [tab, setTab]             = useState('today') // 'today' | 'perf' | 'info'
  const [resetting, setResetting]   = useState(false)
  const [resetMsg, setResetMsg]     = useState(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState(null)
  const [botRunning, setBotRunning] = useState(false)
  const [history, setHistory] = useState(null)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)

  const t = (fr, en) => lang === 'fr' ? fr : en

  // Poll /api/bot/status every 8s when bot is running to detect completion
  // Auto-timeout after 6 minutes to avoid "stuck pending" UX
  useEffect(() => {
    if (!botRunning) return

    const startedAt = Date.now()
    const MAX_WAIT_MS = 6 * 60 * 1000 // 6 minutes

    const poll = setInterval(async () => {
      // Frontend safety timeout — even if backend flag is stuck
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        clearInterval(poll)
        setBotRunning(false)
        setTriggering(false)
        setTriggerMsg({
          ok: false,
          text: t(
            'Le cycle prend plus de temps que prévu. Vérifie les logs Railway.',
            'Cycle is taking longer than expected. Check Railway logs.'
          ),
        })
        setTimeout(() => setTriggerMsg(null), 15000)
        return
      }

      try {
        const s = await API.get('/api/bot/status').then(r => r.data)
        setStatus(s)
        if (!s.running) {
          clearInterval(poll)
          setBotRunning(false)
          setTriggering(false)
          setTriggerMsg({ ok: true, text: t('Cycle terminé — rapport mis à jour ✓', 'Cycle complete — report updated ✓') })
          setTimeout(() => setTriggerMsg(null), 8000)
          // Refresh report data
          const [r, p] = await Promise.all([
            API.get(`/api/bot/report/today?lang=${lang}`).then(r => r.data),
            API.get('/api/bot/performance?days=30').then(r => r.data),
          ])
          setReport(r)
          setPerf(p)
        }
      } catch (_) {}
    }, 8000)
    return () => clearInterval(poll)
  }, [botRunning, lang])

  // Sync botRunning with status.running on initial load
  useEffect(() => {
    if (status?.running) {
      setBotRunning(true)
      setTriggering(true)
    }
  }, [status?.running])

  const handleTrigger = async () => {
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const r = await API.post('/api/bot/trigger')
      if (r.data.status === 'already_running') {
        // Ne pas relancer le polling — juste informer l'utilisateur
        // Le cycle actuel se terminera de lui-même (max 3 min côté backend)
        setTriggering(false)
        setBotRunning(false)
        setTriggerMsg({ ok: false, text: t(
          'Un cycle est déjà en cours. Attends 1-3 min puis réessaie.',
          'A cycle is already running. Wait 1-3 min then try again.'
        )})
        setTimeout(() => setTriggerMsg(null), 10000)
      } else {
        setBotRunning(true)
        setTriggerMsg({ ok: true, text: r.data.message || t('Cycle déclenché ✓', 'Cycle triggered ✓') })
      }
    } catch (e) {
      setTriggering(false)
      setTriggerMsg({ ok: false, text: e.response?.data?.detail || 'Erreur réseau' })
      setTimeout(() => setTriggerMsg(null), 8000)
    }
  }

  const handleResetBot = async () => {
    if (!window.confirm(t(
      'Remettre le portfolio IA à zéro ? Tous les trades et positions seront effacés.',
      'Reset AI portfolio to zero? All trades and positions will be deleted.'
    ))) return
    setResetting(true)
    setResetMsg(null)
    try {
      const r = await API.post('/api/bot/reset')
      setResetMsg({ ok: true, text: r.data.message || 'Portfolio réinitialisé ✓' })
    } catch (e) {
      setResetMsg({ ok: false, text: e.response?.data?.detail || 'Erreur réseau' })
    }
    setResetting(false)
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [r, p, s] = await Promise.all([
          API.get(`/api/bot/report/today?lang=${lang}`).then(r => r.data),
          API.get('/api/bot/performance?days=30').then(r => r.data),
          API.get('/api/bot/status').then(r => r.data),
        ])
        setReport(r)
        setPerf(p)
        setStatus(s)
      } catch (e) {
        console.error('BotReport fetch error:', e)
      }
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // Refresh toutes les 5min
    return () => clearInterval(interval)
  }, [lang])

  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    if (tab !== 'history') return
    const load = async () => {
      setHistoryLoading(true)
      try {
        const r = await API.get(`/api/bot/history?page=${historyPage}&per_page=20`).then(r => r.data)
        setHistory(r)
      } catch(e) { console.error(e) }
      setHistoryLoading(false)
    }
    load()
  }, [tab, historyPage])

  /* ─── Loading ─── */
  if (loading) return (
    <div style={styles.container}>
      <div style={styles.loadingBox}>
        <div style={styles.pulse}>⚡</div>
        <p style={styles.loadingText}>{t('Analyse du marché en cours...', 'Market analysis in progress...')}</p>
      </div>
    </div>
  )

  /* ─── Header ─── */
  const StatusDot = ({ active }) => (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: active ? '#10b981' : '#6b7280',
      boxShadow: active ? '0 0 8px #10b981' : 'none',
      marginRight: 6,
    }} />
  )

  // Calcul de l'état marché côté client (Paris = UTC+1/+2)
  const getMarketStatus = () => {
    const now = new Date()
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const ny    = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const day   = paris.getDay() // 0=dim, 6=sam
    const isWeekend = day === 0 || day === 6

    const euOk = !isWeekend &&
      (paris.getHours() > 9 || (paris.getHours() === 9 && paris.getMinutes() >= 0)) &&
      (paris.getHours() < 17 || (paris.getHours() === 17 && paris.getMinutes() <= 30))

    const usOk = !isWeekend &&
      (ny.getHours() > 9 || (ny.getHours() === 9 && ny.getMinutes() >= 30)) &&
      ny.getHours() < 16

    const parts = ['Crypto 24/7']
    if (euOk) parts.push(`Paris ${paris.getHours()}h${String(paris.getMinutes()).padStart(2,'0')}`)
    if (usOk) parts.push(`NYSE ${ny.getHours()}h${String(ny.getMinutes()).padStart(2,'0')} ET`)

    if (isWeekend) return { label: `Weekend — Crypto uniquement`, color: '#f59e0b' }
    if (!euOk && !usOk) return { label: `Hors séance — Crypto uniquement`, color: '#f59e0b' }
    return { label: parts.join(' · '), color: '#10b981' }
  }

  const mktStatus = getMarketStatus()

  // Prochain cycle (toutes les 30min)
  const getNextCycle = () => {
    const now = new Date()
    const mins = now.getMinutes()
    const rem  = 30 - (mins % 30)
    return rem === 30 ? 0 : rem
  }

  return (
    <div style={styles.container}>

      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.botIcon}>🤖</div>
          <div>
            <h2 style={styles.title}>
              {t('Bot IA TradingLab', 'TradingLab AI Bot')}
            </h2>
            <p style={styles.subtitle}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: '#10b981', boxShadow: '0 0 8px #10b981',
                marginRight: 6,
              }} />
              {t('Actif', 'Active')} · Gemini Flash · {t('toutes les 30min', 'every 30min')}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: mktStatus.color }}>
              {mktStatus.label}
              {getNextCycle() > 0 && (
                <span style={{ color: '#64748b', marginLeft: 8 }}>
                  · {t(`prochain cycle dans ~${getNextCycle()}min`, `next cycle in ~${getNextCycle()}min`)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div style={styles.dateBadge}>
          {report?.date || new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={styles.tabBar}>
        {[
          { key: 'today',   label: t("Aujourd'hui", "Today") },
          { key: 'perf',    label: t("Performance 30j", "30d Performance") },
          { key: 'info',    label: t("Comment ça marche ?", "How does it work?") },
          { key: 'history', label: t('Historique', 'History') },
        ].map(tab_ => (
          <button
            key={tab_.key}
            style={{ ...styles.tab, ...(tab === tab_.key ? styles.tabActive : {}) }}
            onClick={() => setTab(tab_.key)}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ════════════ TAB : AUJOURD'HUI ════════════ */}
      {tab === 'today' && (
        <div>
          {/* Résumé marché */}
          {report?.summary_fr && (
            <div style={styles.marketSummaryBox}>
              <span style={styles.geminiLabel}>🌐 Gemini</span>
              <p style={styles.marketSummaryText}>
                {lang === 'fr' ? report.summary_fr : report.summary_en}
              </p>
            </div>
          )}

          {/* Stat bar */}
          <div style={styles.statBar}>
            <StatBox
              label={t('Trades exécutés', 'Trades executed')}
              value={report?.total_trades ?? 0}
              icon="⚡"
            />
            <StatBox
              label={t('Cycles aujourd\'hui', 'Cycles today')}
              value={report?.cycles_run ?? 0}
              icon="🔄"
            />
            <StatBox
              label={t('Actifs analysés', 'Assets screened')}
              value="50+"
              icon="🔍"
            />
          </div>

          {/* Liste des trades */}
          {/* ── Bouton Déclencher ── accessible directement depuis "Aujourd'hui" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid #7c3aed',
                background: triggering ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.2)',
                color: '#a78bfa', cursor: triggering ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {botRunning
                ? '⏳ ' + t('Analyse en cours (1-3 min)...', 'Analysis running (1-3 min)...')
                : '▶ ' + t('Déclencher maintenant', 'Trigger now')}
            </button>
            {triggerMsg && (
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: triggerMsg.ok ? '#10b981' : '#ef4444',
              }}>
                {triggerMsg.ok ? '✓ ' : '✗ '}{triggerMsg.text}
              </span>
            )}
          </div>

          {report?.trades?.length > 0 ? (
            <div style={styles.tradesList}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ ...styles.sectionTitle, margin: 0 }}>
                  {t('3 dernières décisions', 'Last 3 decisions')}
                </h3>
                {report.trades.length > 3 && (
                  <button
                    onClick={() => setTab('history')}
                    style={{
                      background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
                      borderRadius: 7, padding: '4px 12px', color: '#a78bfa',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t(`Voir tous (${report.trades.length})`, `View all (${report.trades.length})`)} →
                  </button>
                )}
              </div>

              {[...report.trades].reverse().slice(0, 3).map((trade, i) => {
                const colors = ACTION_COLORS[trade.action] || ACTION_COLORS.HOLD
                const risk = RISK_BADGE[trade.risk_level] || RISK_BADGE.MEDIUM
                const conf = CONFIDENCE_STARS[trade.confidence] || '●●○'
                const isExpanded = expanded[i]

                return (
                  <div
                    key={i}
                    style={{
                      ...styles.tradeCard,
                      borderLeft: `3px solid ${colors.border}`,
                      background: colors.bg,
                    }}
                  >
                    {/* Trade header */}
                    <div style={styles.tradeHeader}>
                      <div style={styles.tradeLeft}>
                        <span style={{ ...styles.actionBadge, color: colors.text, borderColor: colors.border }}>
                          {colors.label}
                        </span>
                        <span style={styles.ticker}>{trade.ticker}</span>
                        <span style={styles.price}>
                          ${typeof trade.price === 'number' ? trade.price.toFixed(2) : trade.price}
                        </span>
                      </div>
                      <div style={styles.tradeRight}>
                        <span style={styles.time}>{trade.time}</span>
                        <span style={{ ...styles.riskBadge, color: risk.color, borderColor: risk.color }}>
                          {risk.label}
                        </span>
                        <span style={styles.confBadge}>{conf}</span>
                      </div>
                    </div>

                    {/* Rationale preview */}
                    <p style={styles.rationale}>
                      {lang === 'fr' ? trade.rationale_fr : trade.rationale_en}
                    </p>

                    {/* Expand button */}
                    <button style={styles.expandBtn} onClick={() => toggleExpand(i)}>
                      {isExpanded
                        ? t('▲ Moins de détails', '▲ Less detail')
                        : t('▼ Voir l\'explication complète', '▼ See full explanation')}
                    </button>

                    {isExpanded && (
                      <div style={styles.expandedBox}>
                        <div style={styles.expandedGrid}>
                          <div>
                            <p style={styles.expandedLabel}>🇫🇷 Analyse (FR)</p>
                            <p style={styles.expandedText}>{trade.rationale_fr}</p>
                          </div>
                          <div>
                            <p style={styles.expandedLabel}>🇬🇧 Analysis (EN)</p>
                            <p style={styles.expandedText}>{trade.rationale_en}</p>
                          </div>
                        </div>
                        <p style={styles.executedInfo}>
                          ✅ {t(
                            `Exécuté sur ${trade.executed_on}/${trade.total_portfolios} portefeuilles`,
                            `Executed on ${trade.executed_on}/${trade.total_portfolios} portfolios`
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Si plus de 3 trades → lien vers l'onglet historique */}
              {report.trades.length > 3 && (
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button
                    onClick={() => setTab('history')}
                    style={{
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: '8px 20px', color: 'var(--muted, #94a3b8)',
                      fontSize: 13, cursor: 'pointer', width: '100%',
                    }}
                  >
                    + {report.trades.length - 3} {t('autres trades aujourd\'hui → Voir l\'historique complet', 'more trades today → View full history')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={styles.noTradeBox}>
              <div style={styles.noTradeIcon}>😴</div>
              <p style={styles.noTradeTitle}>
                {t('Pas de trade aujourd\'hui', 'No trades today')}
              </p>
              <p style={styles.noTradeText}>
                {lang === 'fr' ? report?.message_fr : report?.message_en}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════ TAB : PERFORMANCE ════════════ */}
      {tab === 'perf' && (
        <div>
          {perf?.status === 'ok' ? (
            <>
              {/* Métriques clés */}
              <div style={styles.statBar}>
                <StatBox
                  label={t('Win Rate', 'Win Rate')}
                  value={`${perf.win_rate_pct}%`}
                  icon="🎯"
                  color={perf.win_rate_pct >= 50 ? '#10b981' : '#ef4444'}
                />
                <StatBox
                  label={t('P&L Total (30j)', 'Total P&L (30d)')}
                  value={`${perf.total_pnl >= 0 ? '+' : ''}$${perf.total_pnl?.toFixed(2)}`}
                  icon="💰"
                  color={perf.total_pnl >= 0 ? '#10b981' : '#ef4444'}
                />
                <StatBox
                  label={t('Trades exécutés', 'Total trades')}
                  value={perf.total_trades}
                  icon="🔄"
                />
              </div>

              {/* Détail wins/losses */}
              <div style={styles.perfGrid}>
                <div style={styles.perfCard}>
                  <p style={styles.perfLabel}>✅ {t('Gains / Pertes', 'Wins / Losses')}</p>
                  <p style={styles.perfValue}>
                    <span style={{ color: '#10b981' }}>{perf.wins}W</span>
                    {' · '}
                    <span style={{ color: '#ef4444' }}>{perf.losses}L</span>
                    <span style={{ fontSize: 13, color: '#64748b', marginLeft: 8 }}>
                      ({perf.closed_trades} {t('clôturés', 'closed')} / {perf.buy_trades} {t('ouverts', 'open')})
                    </span>
                  </p>
                </div>
                <div style={styles.perfCard}>
                  <p style={styles.perfLabel}>📊 {t('Actifs tradés', 'Traded assets')}</p>
                  <p style={styles.perfValue}>
                    {Object.keys(perf.by_ticker || {}).length} {t('actifs', 'assets')}
                    {perf.best_ticker && (
                      <span style={{ fontSize: 12, color: '#10b981', marginLeft: 8 }}>
                        🏆 {perf.best_ticker} +${perf.best_pnl?.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Détail par actif */}
              {perf.by_ticker && Object.keys(perf.by_ticker).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ ...styles.perfLabel, marginBottom: 8 }}>
                    📋 {t('Détail par actif (30j)', 'Per-asset breakdown (30d)')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(perf.by_ticker)
                      .sort((a, b) => b[1].pnl - a[1].pnl)
                      .map(([ticker, s]) => (
                        <div key={ticker} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
                          borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 14 }}>{ticker}</span>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13 }}>
                            <span style={{ color: '#94a3b8' }}>
                              {s.wins}W/{s.losses}L · WR {s.win_rate}%
                              {s.win_rate >= 65 && s.pnl > 0 && <span style={{ color: '#10b981', marginLeft: 4 }}>⭐ STAR</span>}
                              {s.win_rate < 35 && <span style={{ color: '#ef4444', marginLeft: 4 }}>⚠ ÉVITÉ</span>}
                            </span>
                            <span style={{ color: s.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                              {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Derniers trades */}
              {perf.recent_trades?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ ...styles.perfLabel, marginBottom: 8 }}>
                    🕐 {t('Derniers trades', 'Recent trades')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {perf.recent_trades.slice(0, 6).map((tr, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 12px', background: 'rgba(255,255,255,0.03)',
                        borderRadius: 6, fontSize: 13,
                      }}>
                        <span style={{ color: tr.side === 'BUY' ? '#10b981' : '#ef4444', fontWeight: 600, minWidth: 36 }}>
                          {tr.side}
                        </span>
                        <span style={{ color: '#f1f5f9', fontWeight: 600, minWidth: 70 }}>{tr.ticker}</span>
                        <span style={{ color: '#94a3b8' }}>${tr.price}</span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>{tr.date?.slice(0, 16)}</span>
                        {tr.pnl !== null && (
                          <span style={{ color: tr.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                            {tr.pnl >= 0 ? '+' : ''}${tr.pnl.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ML note */}
              <div style={styles.mlBox}>
                <span style={styles.mlLabel}>🧠 Machine Learning</span>
                <p style={styles.mlText}>
                  {t(
                    'Ces stats sont injectées dans Gemini à chaque cycle. Les actifs ⭐ STAR (WR ≥ 65% + PnL positif) sont privilégiés. Les actifs ⚠ ÉVITÉ (WR < 35%) sont déprioritisés automatiquement.',
                    'These stats are injected into Gemini each cycle. ⭐ STAR assets (WR ≥ 65% + positive PnL) are prioritized. ⚠ AVOID assets (WR < 35%) are deprioritized automatically.'
                  )}
                </p>
              </div>
            </>
          ) : (
            <div style={styles.noTradeBox}>
              <p style={styles.noTradeTitle}>
                {perf?.status === 'no_data'
                  ? t('Aucun trade pour l\'instant', 'No trades yet')
                  : t('Pas encore de données de performance', 'No performance data yet')}
              </p>
              <p style={styles.noTradeText}>
                {t(
                  'Le bot a besoin de quelques cycles pour générer des statistiques. Il tourne toutes les 30min pendant les heures de marché.',
                  'The bot needs a few cycles to generate stats. It runs every 30min during market hours.'
                )}
              </p>
            </div>
          )}

          {/* ── Bouton Forcer un cycle ── */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ ...styles.perfLabel, marginBottom: 10 }}>
              🔧 {t('Outils de débogage', 'Debug tools')}
            </p>
            {triggerMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: triggerMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${triggerMsg.ok ? '#10b981' : '#ef4444'}`,
                color: triggerMsg.ok ? '#10b981' : '#ef4444',
              }}>
                {triggerMsg.text}
              </div>
            )}
            <button
              onClick={handleTrigger}
              disabled={triggering}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '1px solid #7c3aed',
                background: triggering ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.15)',
                color: '#a78bfa', cursor: triggering ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {botRunning
                ? t('⏳ Cycle en cours (1-3 min)...', '⏳ Cycle running (1-3 min)...')
                : t('▶ Forcer un cycle maintenant', '▶ Force a cycle now')}
            </button>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
              {t(
                'Déclenche immédiatement un cycle bot sans attendre le prochain :00 ou :30.',
                'Immediately triggers a bot cycle without waiting for the next :00 or :30.'
              )}
            </p>
          </div>

          {/* ── Bouton Reset Portfolio IA ── */}
          <div style={{
            marginTop: 24, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <p style={{ ...styles.perfLabel, marginBottom: 10 }}>
              ⚙️ {t('Gestion du portfolio IA', 'AI portfolio management')}
            </p>
            {resetMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
                background: resetMsg.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${resetMsg.ok ? '#10b981' : '#ef4444'}`,
                color: resetMsg.ok ? '#10b981' : '#ef4444',
              }}>
                {resetMsg.text}
              </div>
            )}
            <button
              onClick={handleResetBot}
              disabled={resetting}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '1px solid #ef4444',
                background: resetting ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.1)',
                color: '#ef4444', cursor: resetting ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {resetting
                ? t('Réinitialisation...', 'Resetting...')
                : t('🗑️ Remettre le portfolio IA à zéro', '🗑️ Reset AI portfolio to zero')}
            </button>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
              {t(
                'Efface toutes les positions, trades et snapshots du bot. Le capital est remis à $10 000.',
                'Clears all bot positions, trades and snapshots. Capital is reset to $10,000.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* ════════════ TAB : COMMENT ÇA MARCHE ════════════ */}
      {tab === 'info' && (
        <div style={styles.infoBox}>
          {[
            {
              step: '1', icon: '🔍',
              title: t('Screener algorithmique v2', 'Algorithmic screener v2'),
              desc: t(
                'Toutes les 30min, le bot analyse ~35 actifs clés en parallèle (actions US high-beta, ETFs, crypto, CAC40) avec 8 indicateurs : RSI, MACD, Bollinger, ADX (force de tendance), ATR (volatilité), Volume, Momentum 1j/5j. Score composite [-20, +20]. Actifs favoris : PLTR, COIN, MSTR, BTC-USD, NVDA, TSLA.',
                'Every 30min, the bot analyzes ~35 key assets in parallel (US high-beta stocks, ETFs, crypto, CAC40) using 8 indicators: RSI, MACD, Bollinger, ADX (trend strength), ATR (volatility), Volume, 1d/5d Momentum. Composite score [-20, +20]. Preferred: PLTR, COIN, MSTR, BTC-USD, NVDA, TSLA.'
              ),
            },
            {
              step: '2', icon: '🤖',
              title: t('Décision Gemini Flash — Momentum concentré', 'Gemini Flash — Concentrated momentum'),
              desc: t(
                'Gemini reçoit les actifs filtrés + macro (SPY, VIX, news) + niveaux 52s + historique ML. Stratégie : 3-6 positions max, trades larges. Sizing par confiance : HIGH→28%, MEDIUM→18%, LOW→10% du portfolio ($75 à $4000). TP automatique +15%, SL -8%, pyramiding à +8%.',
                'Gemini receives filtered assets + macro (SPY, VIX, news) + 52w levels + ML history. Strategy: 3-6 max positions, large trades. Confidence sizing: HIGH→28%, MEDIUM→18%, LOW→10% of portfolio ($75 to $4000). Auto TP +15%, SL -8%, pyramiding at +8%.'
              ),
            },
            {
              step: '3', icon: '⚡',
              title: t('Exécution multi-exchange', 'Multi-exchange execution'),
              desc: t(
                'Le signal est exécuté sur tous les portefeuilles AI automatiquement. Le bot trade NYSE (9h30-16h ET), Euronext (9h-17h30 CET) et Crypto 24h/7j — même le weekend. Circuit breaker activé uniquement si SPY chute > 3% (crypto non affectée).',
                'Signal is executed on all AI portfolios automatically. The bot trades NYSE (9:30-16:00 ET), Euronext (9:00-17:30 CET) and Crypto 24/7 — including weekends. Circuit breaker only triggers if SPY drops >3% (crypto unaffected).'
              ),
            },
            {
              step: '4', icon: '🧠',
              title: t('Apprentissage ML continu', 'Continuous ML learning'),
              desc: t(
                'Chaque trade SELL est enregistré avec son profit/perte. Le win rate par actif est recalculé et injecté dans le prochain prompt sous forme de tags : STAR (WR ≥ 65%, PnL positif) = à privilégier, EVITE (WR < 35%) = à éviter. Le bot s\'adapte automatiquement.',
                'Each SELL trade is logged with its profit/loss. Win rate per asset is recalculated and injected into the next prompt as tags: STAR (WR ≥ 65%, positive PnL) = prioritize, EVITE (WR < 35%) = avoid. The bot adapts automatically.'
              ),
            },
          ].map(item => (
            <div key={item.step} style={styles.infoStep}>
              <div style={styles.infoStepNum}>{item.icon}</div>
              <div>
                <p style={styles.infoStepTitle}>{item.title}</p>
                <p style={styles.infoStepDesc}>{item.desc}</p>
              </div>
            </div>
          ))}


          <div style={styles.disclaimerBox}>
            ⚠️ {t(
              'Ce bot est éducatif et fonctionne en paper trading (simulation). Il n\'engage pas d\'argent réel. Les performances passées ne garantissent pas les résultats futurs.',
              'This bot is educational and runs in paper trading (simulation) mode. It does not engage real money. Past performance does not guarantee future results.'
            )}
          </div>
        </div>
      )}

      {/* ════════════ TAB : HISTORIQUE ════════════ */}
      {tab === 'history' && (
        <div>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              {t('Chargement de l\'historique...', 'Loading history...')}
            </div>
          ) : !history?.reports?.length ? (
            <div style={styles.noTradeBox}>
              <div style={styles.noTradeIcon}>📭</div>
              <p style={styles.noTradeTitle}>{t('Aucun cycle enregistré', 'No recorded cycles')}</p>
              <p style={styles.noTradeText}>{t('Les cycles s\'accumuleront ici automatiquement.', 'Cycles will accumulate here automatically.')}</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                {history.total} {t('cycles enregistrés au total', 'total recorded cycles')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.reports.map((cycle, i) => {
                  const isExp = expanded[`h_${i}`]
                  const pnlDelta = (cycle.portfolio_value_after && cycle.portfolio_value_before)
                    ? cycle.portfolio_value_after - cycle.portfolio_value_before
                    : null
                  return (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${cycle.total_trades > 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 12, padding: 16,
                    }}>
                      {/* Cycle header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{cycle.date_fr}</span>
                          <span style={{
                            marginLeft: 10, fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: cycle.total_trades > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            color: cycle.total_trades > 0 ? '#a5b4fc' : '#64748b',
                            border: `1px solid ${cycle.total_trades > 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          }}>
                            {cycle.total_trades > 0 ? `⚡ ${cycle.total_trades} trade${cycle.total_trades > 1 ? 's' : ''}` : '😴 Pas de trade'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                          {cycle.spy_change_pct !== null && cycle.spy_change_pct !== undefined && (
                            <span style={{ color: cycle.spy_change_pct >= 0 ? '#10b981' : '#ef4444' }}>
                              SPY {cycle.spy_change_pct >= 0 ? '+' : ''}{cycle.spy_change_pct}%
                            </span>
                          )}
                          {cycle.vix !== null && cycle.vix !== undefined && (
                            <span style={{ color: cycle.vix > 25 ? '#f59e0b' : '#64748b' }}>
                              VIX {cycle.vix}
                            </span>
                          )}
                          {cycle.cycle_duration_s && (
                            <span style={{ color: '#475569', fontSize: 11 }}>⏱ {cycle.cycle_duration_s}s</span>
                          )}
                        </div>
                      </div>

                      {/* Portfolio delta */}
                      {pnlDelta !== null && (
                        <div style={{ marginBottom: 8, fontSize: 13 }}>
                          <span style={{ color: '#64748b' }}>Portfolio : </span>
                          <span style={{ color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                            ${cycle.portfolio_value_before?.toFixed(0)}
                          </span>
                          <span style={{ color: '#64748b', margin: '0 6px' }}>→</span>
                          <span style={{ color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>
                            ${cycle.portfolio_value_after?.toFixed(0)}
                          </span>
                          <span style={{
                            marginLeft: 8, fontWeight: 700, fontSize: 12,
                            color: pnlDelta >= 0 ? '#10b981' : '#ef4444',
                          }}>
                            {pnlDelta >= 0 ? '+' : ''}${pnlDelta.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Market summary */}
                      {cycle.summary_fr && cycle.summary_fr !== '—' && (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
                          display: isExp ? 'block' : '-webkit-box',
                          WebkitLineClamp: isExp ? undefined : 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: isExp ? 'visible' : 'hidden',
                        }}>
                          🌐 {lang === 'fr' ? cycle.summary_fr : cycle.summary_en}
                        </p>
                      )}

                      {/* Expand / collapse */}
                      <button style={styles.expandBtn} onClick={() => toggleExpand(`h_${i}`)}>
                        {isExp ? t('▲ Réduire', '▲ Collapse') : t('▼ Voir les décisions', '▼ See decisions')}
                      </button>

                      {isExp && (
                        <div style={{ marginTop: 12 }}>
                          {/* Actifs screened */}
                          {cycle.screened?.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                                🔍 {t('Actifs analysés', 'Screened assets')} ({cycle.screened.length})
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {cycle.screened.map(t_ => (
                                  <span key={t_} style={{
                                    fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                    background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
                                  }}>{t_}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Decisions */}
                          {cycle.trades?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                                ⚡ {t('Décisions exécutées', 'Executed decisions')}
                              </p>
                              {cycle.trades.map((d, j) => {
                                const colors = ACTION_COLORS[d.action] || ACTION_COLORS.HOLD
                                return (
                                  <div key={j} style={{
                                    padding: '10px 12px', borderRadius: 8,
                                    background: colors.bg,
                                    border: `1px solid ${colors.border}`,
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ ...styles.actionBadge, color: colors.text, borderColor: colors.border, fontSize: 10 }}>
                                          {colors.label}
                                        </span>
                                        <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{d.ticker}</span>
                                        <span style={{ color: '#94a3b8', fontSize: 12 }}>${typeof d.price === 'number' ? d.price.toFixed(2) : d.price}</span>
                                      </div>
                                      <div style={{ fontSize: 12, color: '#64748b' }}>
                                        ${d.amount_usd?.toFixed(0)} · {d.confidence}
                                      </div>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                                      {lang === 'fr' ? d.rationale_fr : d.rationale_en}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                              {t('Aucun trade exécuté ce cycle.', 'No trades executed this cycle.')}
                            </p>
                          )}

                          {/* Errors */}
                          {cycle.errors?.length > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                              <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>
                                ⚠ {cycle.errors.join(' | ')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {(history.has_more || historyPage > 0) && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  {historyPage > 0 && (
                    <button
                      onClick={() => setHistoryPage(p => p - 1)}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                    >
                      ← {t('Précédent', 'Previous')}
                    </button>
                  )}
                  {history.has_more && (
                    <button
                      onClick={() => setHistoryPage(p => p + 1)}
                      style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', cursor: 'pointer', fontSize: 13 }}
                    >
                      {t('Suivant', 'Next')} →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer scheduler */}
      {status && (
        <div style={styles.footer}>
          <span>🕐 {t('Prochain cycle :', 'Next cycle:')}</span>
          <span style={styles.scheduleTag}>
            {typeof status.schedule === 'string'
              ? status.schedule
              : t('toutes les 30min', 'every 30min')}
          </span>
          <span style={{ opacity: 0.4, marginLeft: 'auto', fontSize: 11 }}>Paris (CET)</span>
        </div>
      )}
    </div>
  )
}

/* ── StatBox ── */
function StatBox({ label, value, icon, color }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statIcon}>{icon}</div>
      <p style={{ ...styles.statValue, color: color || '#e2e8f0' }}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  )
}

/* ── Styles ── */
const styles = {
  container: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borderRadius: 16,
    border: '1px solid rgba(99,102,241,0.2)',
    padding: 24,
    fontFamily: "'Inter', sans-serif",
    color: '#e2e8f0',
    maxWidth: 800,
    margin: '0 auto',
  },
  loadingBox: {
    textAlign: 'center', padding: '60px 20px',
  },
  pulse: {
    fontSize: 40, marginBottom: 12,
    animation: 'pulse 1.5s infinite',
  },
  loadingText: { color: '#94a3b8', fontSize: 14 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  botIcon: {
    fontSize: 32,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: 12,
    width: 52, height: 52,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  subtitle: { margin: '4px 0 0', fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center' },
  dateBadge: {
    background: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 8, padding: '6px 14px',
    fontSize: 13, color: '#a5b4fc',
  },
  tabBar: {
    display: 'flex', gap: 4, marginBottom: 20,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: 4,
  },
  tab: {
    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 7,
    background: 'transparent', color: '#64748b', cursor: 'pointer',
    fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(99,102,241,0.2)',
    color: '#a5b4fc',
  },
  marketSummaryBox: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 10, padding: '12px 16px',
    marginBottom: 16,
  },
  geminiLabel: {
    fontSize: 11, color: '#6366f1', fontWeight: 600,
    display: 'block', marginBottom: 6,
  },
  marketSummaryText: { margin: 0, fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 },
  statBar: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10, marginBottom: 20,
  },
  statBox: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '14px 16px', textAlign: 'center',
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { margin: '0 0 4px', fontSize: 22, fontWeight: 700 },
  statLabel: { margin: 0, fontSize: 11, color: '#64748b' },
  sectionTitle: {
    fontSize: 14, fontWeight: 600, color: '#94a3b8',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  tradesList: { display: 'flex', flexDirection: 'column', gap: 10 },
  tradeCard: {
    borderRadius: 10, padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'all 0.2s',
  },
  tradeHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  tradeLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  tradeRight: { display: 'flex', alignItems: 'center', gap: 8 },
  actionBadge: {
    border: '1px solid', borderRadius: 6, padding: '3px 8px',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
  },
  ticker: { fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  price: { fontSize: 14, color: '#94a3b8' },
  time: { fontSize: 12, color: '#64748b' },
  riskBadge: {
    border: '1px solid', borderRadius: 6, padding: '3px 8px',
    fontSize: 11,
  },
  confBadge: { fontSize: 13, color: '#f59e0b', letterSpacing: 2 },
  rationale: {
    margin: '0 0 10px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  expandBtn: {
    background: 'none', border: 'none', color: '#6366f1',
    cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 500,
  },
  expandedBox: {
    marginTop: 12,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8, padding: 12,
  },
  expandedGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  expandedLabel: { margin: '0 0 6px', fontSize: 11, color: '#6366f1', fontWeight: 600 },
  expandedText: { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  executedInfo: { margin: '10px 0 0', fontSize: 12, color: '#10b981' },
  noTradeBox: {
    textAlign: 'center', padding: '40px 20px',
    background: 'rgba(255,255,255,0.02)', borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  noTradeIcon: { fontSize: 40, marginBottom: 12 },
  noTradeTitle: { margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#94a3b8' },
  noTradeText: { margin: 0, fontSize: 13, color: '#64748b' },
  perfGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 },
  perfCard: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)', padding: 16,
  },
  perfLabel: { margin: '0 0 8px', fontSize: 12, color: '#64748b' },
  perfValue: { margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  mlBox: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 10, padding: 14,
  },
  mlLabel: { fontSize: 12, color: '#6366f1', fontWeight: 600, display: 'block', marginBottom: 6 },
  mlText: { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  infoBox: { display: 'flex', flexDirection: 'column', gap: 16 },
  infoStep: {
    display: 'flex', gap: 14, alignItems: 'flex-start',
    background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14,
  },
  infoStepNum: { fontSize: 28, flexShrink: 0, marginTop: 2 },
  infoStepTitle: { margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#e2e8f0' },
  infoStepDesc: { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  costBox: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 10, padding: 14,
  },
  costTitle: { margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#10b981' },
  costText: { margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 },
  disclaimerBox: {
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 8, padding: 12, fontSize: 12, color: '#d97706', lineHeight: 1.5,
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 20, paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    fontSize: 12, color: '#64748b',
  },
  scheduleTag: {
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 4, padding: '2px 8px', color: '#a5b4fc', fontSize: 11,
  },
}
