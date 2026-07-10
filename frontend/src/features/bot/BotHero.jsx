import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import API from '../../api/client'
import { Card, Badge, Button } from '../../components/ui'
import { useT } from '../../context/LangContext'
import { useBotStatus, useSystemStatus } from './useBotData'

/** Hero du bot : pill de statut (actif / cycle en cours / pause nocturne),
 *  planning v6, countdown vers le prochain cycle horaire, bouton trigger. */
export default function BotHero() {
  const t = useT()
  const qc = useQueryClient()
  const { data: status } = useBotStatus()
  const { data: system } = useSystemStatus()
  const [triggerMsg, setTriggerMsg] = useState(null)
  const [triggering, setTriggering] = useState(false)

  const running = status?.running
  const quiet   = system?.in_quiet_hours

  // Cycles horaires (v6) — prochain déclenchement à la minute 0
  const minsToNext = 60 - new Date().getMinutes()

  const pill = running
    ? { tone: 'violet', label: `⏳ ${t('Cycle en cours…', 'Cycle running…')}` }
    : quiet
    ? { tone: 'gold', label: `🌙 ${t(`En pause (${system?.quiet_hours}h Paris)`, `Paused (${system?.quiet_hours}h Paris)`)}` }
    : { tone: 'green', label: `🟢 ${t('Actif', 'Active')}` }

  const trigger = async () => {
    setTriggering(true)
    setTriggerMsg(null)
    try {
      const r = await API.post('/api/bot/trigger')
      if (r.data.status === 'cooldown' || r.data.status === 'already_running') {
        setTriggerMsg({ ok: false, text: r.data.message || t('Cycle déjà en cours ou cooldown actif.', 'Cycle already running or cooldown active.') })
      } else {
        setTriggerMsg({ ok: true, text: t('Cycle déclenché — résultats dans 1-3 min ✓', 'Cycle triggered — results in 1-3 min ✓') })
        qc.invalidateQueries({ queryKey: ['bot-status'] })
      }
    } catch (e) {
      setTriggerMsg({ ok: false, text: e.response?.data?.detail || t('Erreur réseau', 'Network error') })
    }
    setTriggering(false)
    setTimeout(() => setTriggerMsg(null), 10000)
  }

  return (
    <Card className="mb-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🤖</div>
          <div>
            <div className="font-title font-extrabold text-white text-lg">Trade AI</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge tone={pill.tone}>{pill.label}</Badge>
              {!running && !quiet && (
                <span className="text-white/30 text-xs font-mono">
                  {t(`prochain cycle ~${minsToNext}min`, `next cycle ~${minsToNext}min`)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="ghost" onClick={trigger} disabled={triggering || running} className="whitespace-nowrap">
            {running ? `⏳ ${t('Analyse en cours…', 'Running…')}` : `▶ ${t('Déclencher un cycle', 'Trigger cycle')}`}
          </Button>
          {triggerMsg && (
            <span className={`text-xs ${triggerMsg.ok ? 'text-green' : 'text-red'}`}>{triggerMsg.text}</span>
          )}
        </div>
      </div>

      {/* Ligne infos v6 */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-white/5 text-xs text-white/35 flex-wrap">
        <span>🧠 {status?.model || 'gemini-2.0-flash'}</span>
        <span>🕐 {status?.schedule || t('Cycles horaires 9h-22h Paris + monitor TP/SL 10min', 'Hourly cycles 9am-10pm Paris + 10min TP/SL monitor')}</span>
        <span>🎯 {status?.tp_sl || 'TP +15% · SL -7%'}</span>
      </div>
    </Card>
  )
}
