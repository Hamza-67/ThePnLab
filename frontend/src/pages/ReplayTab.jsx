/**
 * ReplayTab.jsx — Mode Replay ThePnLab
 *
 * Intégration dans Dashboard.jsx :
 *   1. import ReplayTab from './ReplayTab'  (ou coller directement dans Dashboard.jsx)
 *   2. Dans les Routes ajouter :
 *        <Route path="replay" element={<ReplayTab />} />
 *   3. Dans NAV ajouter :
 *        { path: 'replay', fr: '⏮️ Replay', en: '⏮️ Replay' }
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import API from '../api/client'

// Si tu as déjà LangContext dans Dashboard.jsx, importer depuis là :
// import { useLang, useT } from './Dashboard'
// Sinon utilise ce fallback :
const useLang = () => 'fr'
const useT = () => (fr, en) => {
  const lang = useLang()
  return lang === 'fr' ? fr : en
}

/* ── constantes ── */
const TICKERS = {
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'NVDA':    'NVIDIA',
  'AAPL':    'Apple',
  'TSLA':    'Tesla',
  'MSFT':    'Microsoft',
  'GOOGL':   'Google',
  'META':    'Meta',
  'AMD':     'AMD',
}

const STARTING_CASH = 10_000
const FEE_RATE      = 0.001  // 0.1% frais simulés

/* ── mini candlestick SVG ── */
function CandleChart({ candles, currentIdx }) {
  if (!candles.length) return null
  const visible = candles.slice(0, currentIdx + 1)
  if (visible.length < 2) return null

  const W = 700, H = 220, PAD_X = 10, PAD_Y = 20
  const prices = visible.flatMap(c => [c.high, c.low])
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const toX = (i) => PAD_X + (i / (visible.length - 1 || 1)) * (W - PAD_X * 2)
  const toY = (v) => PAD_Y + (1 - (v - minP) / range) * (H - PAD_Y * 2)
  const cW  = Math.max(2, Math.min(10, (W - PAD_X * 2) / visible.length - 1))

  const yTicks = [minP, (minP + maxP) / 2, maxP]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {/* Grille */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD_X} y1={toY(v)} x2={W - PAD_X} y2={toY(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4" />
          <text x={W - PAD_X + 2} y={toY(v) + 4} fontSize="9" fill="rgba(255,255,255,0.3)">
            ${v.toFixed(v > 100 ? 0 : 2)}
          </text>
        </g>
      ))}

      {/* SMA20 */}
      {(() => {
        const pts = visible.filter(c => c.sma20).map((c, i) => `${toX(i)},${toY(c.sma20)}`)
        return pts.length > 1 ? <polyline points={pts.join(' ')} fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,2" opacity="0.6" /> : null
      })()}

      {/* Bougies */}
      {visible.map((c, i) => {
        const x    = toX(i)
        const bull = c.close >= c.open
        const col  = bull ? '#10B981' : '#EF4444'
        const yO   = toY(c.open)
        const yC   = toY(c.close)
        const yH   = toY(c.high)
        const yL   = toY(c.low)
        const bodyH = Math.max(1, Math.abs(yC - yO))
        const bodyY = Math.min(yO, yC)

        return (
          <g key={i}>
            {/* Mèche */}
            <line x1={x} y1={yH} x2={x} y2={yL} stroke={col} strokeWidth="1" />
            {/* Corps */}
            <rect x={x - cW / 2} y={bodyY} width={cW} height={bodyH}
              fill={col} opacity={i === currentIdx ? 1 : 0.75} rx="0.5" />
          </g>
        )
      })}

      {/* Curseur sur la dernière bougie */}
      <line
        x1={toX(visible.length - 1)} y1={PAD_Y}
        x2={toX(visible.length - 1)} y2={H - PAD_Y}
        stroke="rgba(167,139,250,0.4)" strokeWidth="1" strokeDasharray="3,3"
      />
    </svg>
  )
}

/* ── composant principal ── */
export default function ReplayTab() {
  // Si tu utilises le vrai LangContext de Dashboard, remplace ces lignes :
  const lang = 'fr'  // ou: const lang = useLang()
  const t    = (fr, en) => lang === 'fr' ? fr : en

  /* ── config session ── */
  const [ticker,    setTicker]    = useState('BTC-USD')
  const [dates,     setDates]     = useState([])
  const [selDate,   setSelDate]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  /* ── données replay ── */
  const [session,   setSession]   = useState(null)   // SessionResponse
  const [candles,   setCandles]   = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [speed,     setSpeed]     = useState(400)    // ms entre chaque bougie

  /* ── portfolio virtuel ── */
  const [cash,      setCash]      = useState(STARTING_CASH)
  const [position,  setPosition]  = useState(0)      // nb unités détenues
  const [avgPrice,  setAvgPrice]  = useState(0)
  const [trades,    setTrades]    = useState([])     // historique trades replay
  const [tradeMsg,  setTradeMsg]  = useState('')

  /* ── score final ── */
  const [finished,  setFinished]  = useState(false)

  const intervalRef = useRef(null)

  /* ── Chargement des jours disponibles ── */
  useEffect(() => {
    setDates([])
    setSelDate('')
    setSession(null)
    setError('')
    API.get(`/api/replay/available-days?ticker=${ticker}`)
      .then(r => { setDates(r.data.dates); setSelDate(r.data.dates[0] || '') })
      .catch(() => setError(t('Impossible de charger les dates disponibles.','Could not load available dates.')))
  }, [ticker])

  /* ── Lancement d'une session ── */
  const startSession = async () => {
    if (!selDate) return
    setLoading(true); setError(''); setFinished(false)
    setPlaying(false); setCurrentIdx(0)
    setCash(STARTING_CASH); setPosition(0); setAvgPrice(0); setTrades([])
    clearInterval(intervalRef.current)
    try {
      const r = await API.get(`/api/replay/session?ticker=${ticker}&date=${selDate}`)
      setSession(r.data)
      setCandles(r.data.candles)
      setCurrentIdx(0)
    } catch (e) {
      setError(e.response?.data?.detail || t('Erreur lors du chargement de la session.','Error loading session.'))
    }
    setLoading(false)
  }

  /* ── Autoplay ── */
  useEffect(() => {
    if (!playing || !candles.length) return
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= candles.length - 1) {
          setPlaying(false)
          setFinished(true)
          clearInterval(intervalRef.current)
          return prev
        }
        return prev + 1
      })
    }, speed)
    return () => clearInterval(intervalRef.current)
  }, [playing, speed, candles])

  /* ── Prix courant ── */
  const currentCandle = candles[currentIdx]
  const currentPrice  = currentCandle?.close ?? 0

  /* ── Equity virtuelle ── */
  const equity = cash + position * currentPrice
  const pnlPct = ((equity - STARTING_CASH) / STARTING_CASH * 100).toFixed(2)

  /* ── Actions trading replay ── */
  const replayBuy = () => {
    if (!currentCandle) return
    const spend = cash * 0.25  // Investit 25% du cash disponible
    const fee   = spend * FEE_RATE
    const qty   = (spend - fee) / currentPrice
    if (qty <= 0 || spend > cash) { setTradeMsg(`❌ ${t('Cash insuffisant','Insufficient cash')}`); return }

    const newAvg = position > 0
      ? (avgPrice * position + currentPrice * qty) / (position + qty)
      : currentPrice

    setCash(c => c - spend)
    setPosition(p => p + qty)
    setAvgPrice(newAvg)
    setTrades(tr => [...tr, {
      time: currentCandle.time, side: 'BUY',
      price: currentPrice, qty: qty.toFixed(4),
      cash: (cash - spend).toFixed(2),
    }])
    setTradeMsg(`✅ ${t('Achat','Buy')} ${qty.toFixed(4)} @ $${currentPrice.toFixed(2)}`)
    setTimeout(() => setTradeMsg(''), 3000)
  }

  const replaySell = () => {
    if (!currentCandle || position <= 0) { setTradeMsg(`❌ ${t('Pas de position à vendre','No position to sell')}`); return }
    const proceeds = position * currentPrice * (1 - FEE_RATE)
    const pnl      = (currentPrice - avgPrice) * position
    setCash(c => c + proceeds)
    setTrades(tr => [...tr, {
      time: currentCandle.time, side: 'SELL',
      price: currentPrice, qty: position.toFixed(4),
      pnl: pnl.toFixed(2),
      cash: (cash + proceeds).toFixed(2),
    }])
    setPosition(0); setAvgPrice(0)
    setTradeMsg(`✅ ${t('Vente','Sell')} @ $${currentPrice.toFixed(2)} — PnL : ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`)
    setTimeout(() => setTradeMsg(''), 3000)
  }

  /* ── Score final ── */
  const finalEquity   = finished ? cash + position * (candles[candles.length - 1]?.close ?? 0) : 0
  const finalPnlPct   = ((finalEquity - STARTING_CASH) / STARTING_CASH * 100).toFixed(2)
  const actualDayPct  = session?.day_change_pct ?? 0
  const beatMarket    = parseFloat(finalPnlPct) > actualDayPct

  /* ── RENDER ── */
  return (
    <div>
      {/* Header */}
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
        ⏮️ {t('Mode Replay','Replay Mode')}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 24 }}>
        {t('Rejoue une journée historique bougie par bougie et entraîne-toi sans risque','Replay a historical trading day candle by candle and practice risk-free')}
      </div>

      {/* ── CONFIG ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
            {t('Actif','Asset')}
          </label>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={SELECT}>
            {Object.entries(TICKERS).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>
            {t('Journée à rejouer','Day to replay')}
          </label>
          <select value={selDate} onChange={e => setSelDate(e.target.value)} style={SELECT}>
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={startSession} disabled={loading || !selDate} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
          color: '#fff', fontFamily: 'DM Sans', fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer', fontSize: '0.88rem',
          opacity: !selDate ? 0.5 : 1,
        }}>
          {loading ? '⏳...' : `▶ ${t('Lancer','Start')}`}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 16 }}>
          ❌ {error}
        </div>
      )}

      {/* ── SESSION ACTIVE ── */}
      {candles.length > 0 && !finished && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

            {/* Graphique */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              {/* Header graphique */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>
                    {ticker}
                  </span>
                  <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: '0.8rem' }}>
                    {selDate} · {currentCandle?.time}
                  </span>
                </div>
                <div style={{ fontFamily: 'Syne', fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                  ${currentPrice.toFixed(currentPrice > 100 ? 2 : 4)}
                </div>
              </div>

              {/* Graphique bougies */}
              <div style={{ height: 220 }}>
                <CandleChart candles={candles} currentIdx={currentIdx} />
              </div>

              {/* Indicateurs temps réel */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'RSI',    val: currentCandle?.rsi?.toFixed(1) ?? '—', color: (currentCandle?.rsi ?? 50) > 70 ? '#EF4444' : (currentCandle?.rsi ?? 50) < 30 ? '#10B981' : '#9F6CF0' },
                  { label: 'MACD',   val: currentCandle?.macd != null ? (currentCandle.macd > (currentCandle.signal ?? 0) ? '↑ Bull' : '↓ Bear') : '—', color: currentCandle?.macd > (currentCandle?.signal ?? 0) ? '#10B981' : '#EF4444' },
                  { label: 'SMA20',  val: currentCandle?.sma20?.toFixed(currentPrice > 100 ? 0 : 2) ?? '—', color: '#F59E0B' },
                  { label: t('Progression','Progress'), val: `${currentIdx + 1} / ${candles.length}`, color: '#94A3B8' },
                ].map((x, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{x.label}</div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, color: x.color, fontSize: '0.9rem' }}>{x.val}</div>
                  </div>
                ))}
              </div>

              {/* Contrôles playback */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0 || playing}
                  style={{ ...BTN_CTRL, opacity: currentIdx === 0 ? 0.4 : 1 }}>⏮</button>

                <button onClick={() => setPlaying(p => !p)}
                  style={{ ...BTN_CTRL, background: playing ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', border: `1px solid ${playing ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`, color: playing ? '#FCA5A5' : '#6EE7B7', flex: 1, fontWeight: 700 }}>
                  {playing ? `⏸ ${t('Pause','Pause')}` : `▶ ${t('Play','Play')}`}
                </button>

                <button onClick={() => setCurrentIdx(i => Math.min(candles.length - 1, i + 1))} disabled={currentIdx >= candles.length - 1 || playing}
                  style={{ ...BTN_CTRL, opacity: currentIdx >= candles.length - 1 ? 0.4 : 1 }}>⏭</button>

                <button onClick={() => { setPlaying(false); setCurrentIdx(candles.length - 1); setTimeout(() => setFinished(true), 100) }}
                  style={{ ...BTN_CTRL }}>⏩ {t('Fin','End')}</button>

                {/* Vitesse */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('Vitesse','Speed')}</span>
                  {[{ label: '1×', val: 800 }, { label: '2×', val: 400 }, { label: '4×', val: 150 }].map(s => (
                    <button key={s.val} onClick={() => setSpeed(s.val)} style={{
                      padding: '4px 10px', borderRadius: 6, border: `1px solid ${speed === s.val ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                      background: speed === s.val ? 'rgba(124,58,237,0.2)' : 'transparent',
                      color: speed === s.val ? '#C4B5FD' : 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel trading */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Equity */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Capital virtuel','Virtual capital')}</div>
                {[
                  { label: 'Equity',               val: `$${equity.toFixed(2)}`,          color: '#fff' },
                  { label: 'Cash',                  val: `$${cash.toFixed(2)}`,             color: '#60A5FA' },
                  { label: t('Position','Position'), val: position > 0 ? `${position.toFixed(4)} ${ticker.replace('-USD','')}` : '—', color: '#9F6CF0' },
                  { label: 'PnL',                   val: `${pnlPct >= 0 ? '+' : ''}${pnlPct}%`, color: parseFloat(pnlPct) >= 0 ? '#10B981' : '#EF4444' },
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{m.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: m.color }}>{m.val}</span>
                  </div>
                ))}
              </div>

              {/* Boutons achat/vente */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={replayBuy} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #059669, #10B981)', color: '#fff', fontFamily: 'DM Sans', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
                  🟢 {t('Acheter 25%','Buy 25%')}
                </button>
                <button onClick={replaySell} disabled={position <= 0} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #DC2626, #EF4444)', color: '#fff', fontFamily: 'DM Sans', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.25)', opacity: position <= 0 ? 0.5 : 1 }}>
                  🔴 {t('Tout vendre','Sell all')}
                </button>
              </div>

              {tradeMsg && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: tradeMsg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${tradeMsg.startsWith('✅') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '0.82rem', color: tradeMsg.startsWith('✅') ? '#6EE7B7' : '#FCA5A5' }}>
                  {tradeMsg}
                </div>
              )}

              {/* Historique trades */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, flex: 1, overflowY: 'auto', maxHeight: 200 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Mes trades','My trades')}</div>
                {trades.length === 0
                  ? <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{t('Aucun trade pour l\'instant','No trades yet')}</div>
                  : [...trades].reverse().map((tr, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--muted)' }}>{tr.time}</span>
                      <span style={{ color: tr.side === 'BUY' ? '#10B981' : '#EF4444', fontWeight: 600 }}>{tr.side}</span>
                      <span style={{ color: '#fff' }}>${parseFloat(tr.price).toFixed(2)}</span>
                      {tr.pnl && <span style={{ color: parseFloat(tr.pnl) >= 0 ? '#10B981' : '#EF4444' }}>{parseFloat(tr.pnl) >= 0 ? '+' : ''}${tr.pnl}</span>}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ÉCRAN FINAL ── */}
      {finished && session && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>
            {parseFloat(finalPnlPct) > 5 ? '🏆' : parseFloat(finalPnlPct) > 0 ? '✅' : '📉'}
          </div>
          <div style={{ fontFamily: 'Syne', fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: 8 }}>
            {t('Session terminée !','Session complete!')}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'Syne', color: parseFloat(finalPnlPct) >= 0 ? '#10B981' : '#EF4444', marginBottom: 4 }}>
            {finalPnlPct >= 0 ? '+' : ''}{finalPnlPct}%
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 24 }}>
            {t('Performance sur','Performance on')} {selDate} · {ticker}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            {[
              { label: t('Equity finale','Final equity'),       val: `$${finalEquity.toFixed(2)}`,       color: '#fff' },
              { label: t('Marché ce jour','Market that day'),   val: `${actualDayPct >= 0 ? '+' : ''}${actualDayPct}%`, color: actualDayPct >= 0 ? '#10B981' : '#EF4444' },
              { label: t('Trades passés','Trades placed'),      val: trades.length,                       color: '#F59E0B' },
            ].map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, color: m.color, fontSize: '1.1rem' }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 20px', borderRadius: 12, background: beatMarket ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${beatMarket ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, color: beatMarket ? '#6EE7B7' : '#FCA5A5', fontSize: '0.88rem', marginBottom: 20, lineHeight: 1.5 }}>
            {beatMarket
              ? `🎯 ${t('Tu as battu le marché ! Performance de +','You beat the market! You outperformed by +')}${(parseFloat(finalPnlPct) - actualDayPct).toFixed(2)}%`
              : `📚 ${t(`Le marché a performé mieux que toi. Bonne leçon ! Essaie une autre journée.`,'The market outperformed you. Good lesson! Try another day.')}`}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => { setFinished(false); setSession(null); setCandles([]); setCash(STARTING_CASH); setPosition(0); setAvgPrice(0); setTrades([]) }}
              style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>
              {t('Nouvelle session','New session')}
            </button>
            <button onClick={startSession}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 700 }}>
              🔄 {t('Rejouer ce jour','Replay this day')}
            </button>
          </div>
        </div>
      )}

      {/* État vide */}
      {!candles.length && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⏮️</div>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '1.1rem', marginBottom: 8 }}>
            {t('Prêt à t\'entraîner ?','Ready to practice?')}
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            {t('Sélectionne un actif et une journée, puis clique sur Lancer.','Select an asset and a day, then click Start.')}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── styles réutilisables ── */
const SELECT = {
  width: '100%', background: '#1A1530',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
  color: '#F1F5F9', padding: '9px 12px', fontFamily: 'DM Sans',
  cursor: 'pointer', outline: 'none', fontSize: '0.88rem',
}

const BTN_CTRL = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.85rem',
}