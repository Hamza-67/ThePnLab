import { useState } from 'react'
import { Card, StatBox, Tabs, EmptyState } from '../../components/ui'
import { useT, useLang } from '../../context/LangContext'
import { useBotReport } from './useBotData'
import BotHero from './BotHero'
import CycleCard from './CycleCard'
import PerformancePanel from './PerformancePanel'
import HistoryList from './HistoryList'
import HowItWorks from './HowItWorks'

/** Onglet Trade AI — hero pleine largeur + tabs segmentés + layout 2 colonnes. */
export default function BotTab() {
  const t = useT()
  const lang = useLang()
  const [tab, setTab] = useState('today')
  const { data: report } = useBotReport(lang)

  return (
    <div className="max-w-5xl mx-auto">
      <BotHero />

      <Tabs
        className="mb-5"
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'today',   label: t("Aujourd'hui", 'Today') },
          { value: 'perf',    label: t('Performance', 'Performance') },
          { value: 'history', label: t('Historique', 'History') },
          { value: 'info',    label: t('Comment ça marche ?', 'How it works?') },
        ]}
      />

      {tab === 'today' && (
        <div className="flex flex-col gap-5">
          {/* Ligne du haut : lecture du marché (2/3) + stats du jour (1/3) */}
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="md:col-span-2 fade-up">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-8 rounded-lg bg-violet/15 border border-violet/25 flex items-center justify-center text-sm">🌐</span>
                <span className="text-xs text-violet-pale uppercase tracking-widest font-semibold">
                  {t('Lecture du marché', 'Market read')}
                </span>
              </div>
              <p className="text-white/60 text-[0.925rem] leading-relaxed m-0">
                {(lang === 'fr' ? report?.summary_fr : report?.summary_en) ||
                  t('En attente du prochain cycle d\'analyse…', 'Waiting for the next analysis cycle…')}
              </p>
            </Card>

            <Card className="fade-up-1 flex flex-col justify-center gap-5">
              <StatBox label={t('Trades exécutés', 'Trades executed')} value={report?.total_trades ?? 0}
                       tone={report?.total_trades > 0 ? 'green' : undefined} />
              <div className="h-px bg-white/5" />
              <StatBox label={t("Cycles aujourd'hui", 'Cycles today')} value={report?.cycles_run ?? 0} />
              <div className="h-px bg-white/5" />
              <StatBox label={t('Actifs analysés', 'Assets screened')} value="50+" />
            </Card>
          </div>

          {/* Décisions du jour */}
          {report?.trades?.length > 0 ? (
            <div className="fade-up-2">
              <div className="text-xs text-white/35 uppercase tracking-widest font-semibold mb-3">
                {t('Décisions du jour', "Today's decisions")} · {report.trades.length}
              </div>
              <div className="flex flex-col gap-2.5">
                {[...report.trades].reverse().map((trade, i) => <CycleCard key={i} trade={trade} />)}
              </div>
            </div>
          ) : (
            <Card className="fade-up-2">
              <EmptyState
                icon="😴"
                title={t("Pas de trade aujourd'hui", 'No trades today')}
                subtitle={lang === 'fr' ? report?.message_fr : report?.message_en}
              />
            </Card>
          )}
        </div>
      )}

      {tab === 'perf' && <PerformancePanel />}
      {tab === 'history' && <HistoryList />}
      {tab === 'info' && <HowItWorks />}
    </div>
  )
}
