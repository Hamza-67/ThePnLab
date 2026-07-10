import { useState, useEffect } from 'react'
import API from '../../api/client'

/* ── TICKER STRIP — données réelles via l'API market ── */
const STRIP_TICKERS = ['NVDA', 'AAPL', 'TSLA', 'BTC-USD', 'ETH-USD', 'META', 'MSFT', 'AMD', 'GOOGL', 'SOL-USD']

export default function TickerStrip() {
  const [prices, setPrices] = useState({})

  useEffect(() => {
    const fetchAll = () => {
      STRIP_TICKERS.forEach(tkr => {
        API.get(`/api/market/indicators/${tkr}`)
          .then(r => {
            const d = r.data
            if (d?.price > 0) {
              const prevClose = d.prev_close || d.price
              const chg = prevClose > 0 ? ((d.price - prevClose) / prevClose) * 100 : 0
              setPrices(s => ({ ...s, [tkr]: { price: d.price, change: chg } }))
            }
          }).catch(() => {
            // fallback: keep existing OHLC approach
            API.get(`/api/market/ohlc/${tkr}?interval=1d&period=5d`)
              .then(r => {
                const data = r.data?.data
                if (data && data.length >= 2) {
                  const prev = data[data.length - 2].close
                  const curr = data[data.length - 1].close
                  const chg = ((curr - prev) / prev) * 100
                  setPrices(s => ({ ...s, [tkr]: { price: curr, change: chg } }))
                }
              }).catch(() => {})
          })
      })
    }
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [])

  const entries = STRIP_TICKERS.map(tkr => {
    const info = prices[tkr]
    const name = tkr.replace('-USD', '')
    const up   = (info?.change ?? 0) >= 0
    const val  = info ? `${info.change >= 0 ? '+' : ''}${info.change.toFixed(2)}%` : '…'
    const price = info?.price ?? null
    return { name, up, val, price }
  })
  const doubled = [...entries, ...entries]

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0', fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'DM Mono', overflow: 'hidden', whiteSpace: 'nowrap' }}>
      <style>{`
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ticker-inner { display: inline-block; animation: ticker 40s linear infinite; }
        .ticker-inner:hover { animation-play-state: paused; }
      `}</style>
      <div className="ticker-inner">
        {doubled.map((t, i) => (
          <span key={i} style={{ marginRight: 32 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>{t.name}</span>
            <span style={{ color: '#e2e8f0', marginRight: 4, fontFamily: 'DM Mono, monospace' }}>
              {t.price ? `$${t.price < 10 ? t.price.toFixed(4) : t.price < 1000 ? t.price.toFixed(2) : t.price.toFixed(0)}` : ''}
            </span>
            <span style={{ color: t.up ? '#10B981' : '#EF4444' }}>{t.up ? '▲' : '▼'} {t.val}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
