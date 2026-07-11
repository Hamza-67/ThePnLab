import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import API from '../../api/client'
import { Badge } from '../../components/ui'
import { useT } from '../../context/LangContext'
import { useBotStatus, useSystemStatus } from './useBotData'

/** Hero du bot — bannière pleine largeur : avatar lumineux, titre dégradé,
 *  statut (actif / cycle en cours / pause nocturne), countdown, bouton trigger. */
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
    : { tone: 'green', label: `● ${t('Actif', 'Active')}` }

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
    <div className="glass-panel-violet fade-up relative overflow-hidden p-6 md:p-8 mb-6">
      {/* Halo décoratif */}
      <div className="absolute -top-24 -right-16 size-72 rounded-full bg-violet/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-16 size-64 rounded-full bg-indigo/15 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between gap-6 flex-wrap">
        {/* Avatar + titre */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div className="size-16 md:size-20 rounded-2xl bg-gradient-to-br from-violet to-indigo flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-violet/50">
              🤖
            </div>
            <span className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-bg ${running ? 'bg-violet-light animate-pulse' : quiet ? 'bg-gold' : 'bg-green'}`} />
          </div>
          <div>
            <div className="text-gradient font-title font-extrabold text-3xl md:text-4xl tracking-tight leading-none">
              Trade AI
            </div>
            <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
              <Badge tone={pill.tone}>{pill.label}</Badge>
              {!running && !quiet && (
                <span className="text-white/40 text-xs font-mono">
                  {t(`prochain cycle dans ~${minsToNext} min`, `next cycle in ~${minsToNext} min`)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bouton trigger */}
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={trigger}
            disabled={triggering || running}
            className={`px-6 py-3 rounded-xl border-none font-semibold text-sm cursor-pointer text-white
              bg-gradient-to-br from-violet to-indigo shadow-lg shadow-violet/40
              hover:shadow-violet/60 hover:-translate-y-0.5 transition-all
              ${(triggering || running) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {running ? `⏳ ${t('Analyse en cours…', 'Running…')}` : `▶ ${t('Déclencher un cycle', 'Trigger cycle')}`}
          </button>
          {triggerMsg && (
            <span className={`text-xs ${triggerMsg.ok ? 'text-green' : 'text-red'}`}>{triggerMsg.text}</span>
          )}
        </div>
      </div>

      {/* Chips infos v6 */}
      <div className="relative flex gap-2.5 mt-6 flex-wrap">
        {[
          { icon: '🧠', text: status?.model || 'gemini-2.0-flash' },
          { icon: '🕐', text: t('1 cycle / heure · 9h-22h Paris · pause 0h-7h', '1 cycle / hour · 9am-10pm Paris · sleeps 0-7am') },
          { icon: '⏱️', text: t('Monitor TP/SL toutes les 10 min', 'TP/SL monitor every 10 min') },
          { icon: '🎯', text: 'TP +15% · SL −7%' },
        ].map((chip, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/55 font-mono">
            <span>{chip.icon}</span> {chip.text}
          </span>
        ))}
      </div>
    </div>
  )
}
