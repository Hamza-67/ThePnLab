import { useState } from 'react'
import { Badge } from '../../components/ui'
import { useT, useLang } from '../../context/LangContext'

const ACTION_TONE = { BUY: 'green', SELL: 'red', HOLD: 'neutral' }
const CONF_DOTS   = { HIGH: '●●●', MEDIUM: '●●○', LOW: '●○○' }
const RISK_TONE   = { LOW: 'green', MEDIUM: 'gold', HIGH: 'red' }

/** Carte décision du bot — chips action/confiance/risque + rationale dépliable. */
export default function CycleCard({ trade }) {
  const t = useT()
  const lang = useLang()
  const [open, setOpen] = useState(false)

  const action = trade.action || trade.side || 'HOLD'
  const rationale = lang === 'fr' ? trade.rationale_fr : trade.rationale_en
  const price = typeof trade.price === 'number' ? trade.price.toFixed(2) : trade.price

  return (
    <div className="bg-white/[0.03] border border-border-soft rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={ACTION_TONE[action] || 'neutral'}>
          {action === 'BUY' ? t('ACHAT', 'BUY') : action === 'SELL' ? t('VENTE', 'SELL') : t('ATTENTE', 'HOLD')}
        </Badge>
        <span className="font-title font-bold text-violet-light">{trade.ticker}</span>
        {price && <span className="font-mono text-gold text-sm">${price}</span>}
        <span className="text-white/25 text-xs font-mono ml-auto">{trade.time}</span>
        {trade.confidence && (
          <span className="text-violet-pale text-xs font-mono" title={t('Confiance', 'Confidence')}>
            {CONF_DOTS[trade.confidence] || '●●○'}
          </span>
        )}
        {trade.risk_level && (
          <Badge tone={RISK_TONE[trade.risk_level] || 'gold'}>
            {trade.risk_level === 'LOW' ? t('Risque faible', 'Low risk')
              : trade.risk_level === 'HIGH' ? t('Risque élevé', 'High risk')
              : t('Risque modéré', 'Medium risk')}
          </Badge>
        )}
      </div>

      {rationale && (
        <p className={`text-white/50 text-sm leading-relaxed mt-2 mb-0 ${open ? '' : 'line-clamp-2'}`}>
          {rationale}
        </p>
      )}

      {rationale && rationale.length > 120 && (
        <button
          onClick={() => setOpen(v => !v)}
          className="bg-transparent border-none text-violet-light/70 text-xs cursor-pointer p-0 mt-1.5 hover:text-violet-light"
        >
          {open ? t('▲ Réduire', '▲ Collapse') : t("▼ Voir l'explication complète", '▼ See full explanation')}
        </button>
      )}

      {trade.position_before && (
        <div className="mt-2 px-2.5 py-1.5 rounded-md bg-violet/5 border border-violet/15 text-xs text-white/40">
          📊 {t('Position avant', 'Position before')} : {trade.position_before.quantity} @ ${trade.position_before.avg_price} →{' '}
          <span className={trade.position_before.pnl_pct >= 0 ? 'text-green font-semibold' : 'text-red font-semibold'}>
            {trade.position_before.pnl_pct >= 0 ? '+' : ''}{trade.position_before.pnl_pct}%
          </span>
        </div>
      )}
    </div>
  )
}
