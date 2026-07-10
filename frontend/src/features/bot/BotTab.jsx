import { useState, useEffect } from 'react'
import API from '../../api/client'
import BotReport from '../../pages/BotReport'
import { useT, useLang } from '../../context/LangContext'

export default function BotTab() {
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
