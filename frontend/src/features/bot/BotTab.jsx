import { useState } from 'react'
import { Card, StatBox, Tabs, EmptyState } from '../../components/ui'
import { useT, useLang } from '../../context/LangContext'
import { useBotReport } from './useBotData'
import BotHero from './BotHero'
import CycleCard from './CycleCard'
import PerformancePanel from './PerformancePanel'
import HistoryList from './HistoryList'
import HowItWorks from './HowItWorks'

/** Onglet Trade AI — shell : hero + tabs (aujourd'hui / perf / historique / infos). */
export default function BotTab() {
  const t = useT()
  const lang = useLang()
  const [tab, setTab] = useState('today')
  const { data: report } = useBotReport(lang)

  return (
    <div className="max-w-3xl">
      <div className="font-title text-xl font-extrabold text-white mb-1">Trade AI</div>
      <div className="text-white/35 text-sm mb-5">
        {t('Le bot analyse le marché chaque heure et trade en autonomie — chaque décision est expliquée.',
           'The bot analyzes the market every hour and trades autonomously — every decision is explained.')}
      </div>

      <BotHero />

      <Tabs
        className="mb-4 flex-wrap"
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'today',   label: t("Aujourd'hui", 'Today') },
          { value: 'perf',    label: t('Performance 30j', '30d Performance') },
          { value: 'history', label: t('Historique', 'History') },
          { value: 'info',    label: t('Comment ça marche ?', 'How it works?') },
        ]}
      />

      {tab === 'today' && (
        <div className="flex flex-col gap-4">
          {(report?.summary_fr || report?.summary_en) && (
            <Card>
              <div className="text-[0.68rem] text-violet-pale uppercase tracking-wider mb-2">
                🌐 {t('Lecture du marché', 'Market read')}
              </div>
              <p className="text-white/55 text-sm leading-relaxed m-0">
                {lang === 'fr' ? report.summary_fr : report.summary_en}
              </p>
            </Card>
          )}

          <Card>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label={t('Trades exécutés', 'Trades executed')} value={report?.total_trades ?? 0} />
              <StatBox label={t("Cycles aujourd'hui", 'Cycles today')} value={report?.cycles_run ?? 0} />
              <StatBox label={t('Actifs analysés', 'Assets screened')} value="50+" />
            </div>
          </Card>

          {report?.trades?.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-white/35 uppercase tracking-wider">
                {t('Décisions du jour', "Today's decisions")}
              </div>
              {[...report.trades].reverse().map((trade, i) => <CycleCard key={i} trade={trade} />)}
            </div>
          ) : (
            <EmptyState
              icon="😴"
              title={t("Pas de trade aujourd'hui", 'No trades today')}
              subtitle={lang === 'fr' ? report?.message_fr : report?.message_en}
            />
          )}
        </div>
      )}

      {tab === 'perf' && <PerformancePanel />}
      {tab === 'history' && <HistoryList />}
      {tab === 'info' && <HowItWorks />}
    </div>
  )
}
