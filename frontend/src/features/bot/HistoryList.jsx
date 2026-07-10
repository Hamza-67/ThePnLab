import { useState } from 'react'
import { Card, Badge, Button, Spinner, EmptyState } from '../../components/ui'
import { useT, useLang } from '../../context/LangContext'
import { useBotHistory } from './useBotData'
import CycleCard from './CycleCard'

/** Historique paginé des cycles du bot. */
export default function HistoryList() {
  const t = useT()
  const lang = useLang()
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState(null)
  const { data: history, isLoading } = useBotHistory(page)

  if (isLoading && !history) return <Spinner label={t('Chargement…', 'Loading…')} />

  const reports = history?.reports || []
  if (reports.length === 0) {
    return <EmptyState icon="📋" title={t('Aucun cycle enregistré', 'No cycles recorded yet')} />
  }

  return (
    <div className="flex flex-col gap-2.5">
      {reports.map((report, idx) => {
        const isOpen = expanded === idx
        return (
          <Card key={idx} className="!p-0 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : idx)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-transparent border-none cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <Badge tone={report.total_trades > 0 ? 'violet' : 'neutral'}>
                  {report.total_trades > 0
                    ? `${report.total_trades} trade${report.total_trades > 1 ? 's' : ''}`
                    : t('aucun trade', 'no trade')}
                </Badge>
                <span className="text-white text-sm font-semibold">
                  {report.date_fr || report.timestamp?.slice(0, 16)}
                </span>
              </div>
              <span className="text-white/30 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-border-soft">
                {(report.summary_fr || report.summary_en) && (
                  <p className="text-white/45 text-sm leading-relaxed mt-3 mb-3 px-3 py-2.5 rounded-lg bg-white/[0.03]">
                    {lang === 'fr' ? report.summary_fr : report.summary_en}
                  </p>
                )}

                {report.trades?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {report.trades.map((trade, ti) => <CycleCard key={ti} trade={trade} />)}
                  </div>
                )}

                {report.screened?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[0.68rem] text-white/30 uppercase tracking-wider mb-1.5">
                      {t('Actifs analysés', 'Screened assets')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {report.screened.map((tk, si) => (
                        <span key={si} className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-xs font-mono">{tk}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.errors?.length > 0 && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-red/5 border border-red/20 text-xs text-red/80">
                    {report.errors.join(' · ')}
                  </div>
                )}
              </div>
            )}
          </Card>
        )
      })}

      <div className="flex gap-2 justify-center mt-1">
        {page > 0 && (
          <Button variant="ghost" onClick={() => setPage(p => p - 1)}>← {t('Plus récents', 'Newer')}</Button>
        )}
        {history?.has_more && (
          <Button variant="ghost" onClick={() => setPage(p => p + 1)}>{t('Plus anciens', 'Older')} →</Button>
        )}
      </div>
    </div>
  )
}
