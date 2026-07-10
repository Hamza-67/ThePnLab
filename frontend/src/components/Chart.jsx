import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import API from '../api/client'

const TV_SYMBOL = {
  // ── Tech & IA (NASDAQ) ─────────────────────────────────────────────
  'NVDA':    'NASDAQ:NVDA',
  'AAPL':    'NASDAQ:AAPL',
  'MSFT':    'NASDAQ:MSFT',
  'GOOGL':   'NASDAQ:GOOGL',
  'META':    'NASDAQ:META',
  'AMZN':    'NASDAQ:AMZN',
  'TSLA':    'NASDAQ:TSLA',
  'AMD':     'NASDAQ:AMD',
  'ORCL':    'NYSE:ORCL',
  'NFLX':    'NASDAQ:NFLX',
  'ADBE':    'NASDAQ:ADBE',
  'CRM':     'NYSE:CRM',
  'INTC':    'NASDAQ:INTC',
  'QCOM':    'NASDAQ:QCOM',
  'AVGO':    'NASDAQ:AVGO',
  // ── Finance (NYSE) ──────────────────────────────────────────────────
  'JPM':     'NYSE:JPM',
  'BAC':     'NYSE:BAC',
  'GS':      'NYSE:GS',
  'MS':      'NYSE:MS',
  'BLK':     'NYSE:BLK',
  'V':       'NYSE:V',
  'MA':      'NYSE:MA',
  'AXP':     'NYSE:AXP',
  'WFC':     'NYSE:WFC',
  'C':       'NYSE:C',
  'BRK-B':   'NYSE:BRK.B',
  'SPGI':    'NYSE:SPGI',
  // ── Santé (NYSE / NASDAQ) ───────────────────────────────────────────
  'LLY':     'NYSE:LLY',
  'NVO':     'NYSE:NVO',
  'ABBV':    'NYSE:ABBV',
  'JNJ':     'NYSE:JNJ',
  'MRK':     'NYSE:MRK',
  'PFE':     'NYSE:PFE',
  'MRNA':    'NASDAQ:MRNA',
  'AMGN':    'NASDAQ:AMGN',
  'BMY':     'NYSE:BMY',
  'GILD':    'NASDAQ:GILD',
  'ISRG':    'NASDAQ:ISRG',
  // ── Consommation (NYSE / NASDAQ) ────────────────────────────────────
  'MCD':     'NYSE:MCD',
  'SBUX':    'NASDAQ:SBUX',
  'NKE':     'NYSE:NKE',
  'TGT':     'NYSE:TGT',
  'WMT':     'NYSE:WMT',
  'COST':    'NASDAQ:COST',
  'HD':      'NYSE:HD',
  'LOW':     'NYSE:LOW',
  'PG':      'NYSE:PG',
  'KO':      'NYSE:KO',
  'PEP':     'NASDAQ:PEP',
  'MDLZ':    'NASDAQ:MDLZ',
  // ── Énergie (NYSE) ──────────────────────────────────────────────────
  'XOM':     'NYSE:XOM',
  'CVX':     'NYSE:CVX',
  'COP':     'NYSE:COP',
  'SLB':     'NYSE:SLB',
  'BP':      'NYSE:BP',
  'SHEL':    'NYSE:SHEL',
  'NEE':     'NYSE:NEE',
  'ENPH':    'NASDAQ:ENPH',
  // ── Métaux & Matières premières ─────────────────────────────────────
  'GC=F':    'TVC:GOLD',
  'SI=F':    'TVC:SILVER',
  'HG=F':    'TVC:COPPER',
  'PL=F':    'TVC:PLATINUM',
  'CL=F':    'TVC:USOIL',
  'NG=F':    'TVC:NATURALGAS',
  'NEM':     'NYSE:NEM',
  'GOLD':    'NYSE:GOLD',
  'FCX':     'NYSE:FCX',
  'AA':      'NYSE:AA',
  // ── ETF US ──────────────────────────────────────────────────────────
  'SPY':     'AMEX:SPY',
  'QQQ':     'NASDAQ:QQQ',
  'IWM':     'AMEX:IWM',
  'DIA':     'AMEX:DIA',
  'VOO':     'AMEX:VOO',
  'VTI':     'AMEX:VTI',
  'XLF':     'AMEX:XLF',
  'XLE':     'AMEX:XLE',
  'XLK':     'AMEX:XLK',
  'XLV':     'AMEX:XLV',
  'ARKK':    'AMEX:ARKK',
  'SOXX':    'NASDAQ:SOXX',
  // ── ETF Oblig & Macro ───────────────────────────────────────────────
  'TLT':     'NASDAQ:TLT',
  'IEF':     'NASDAQ:IEF',
  'BND':     'NASDAQ:BND',
  'HYG':     'AMEX:HYG',
  'LQD':     'AMEX:LQD',
  'GLD':     'AMEX:GLD',
  'SLV':     'AMEX:SLV',
  'VNQ':     'AMEX:VNQ',
  'DX=F':    'TVC:DXY',
  // ── ETF Europe ──────────────────────────────────────────────────────
  // Amsterdam (Euronext Amsterdam)
  'IWDA.AS':  'EURONEXT:IWDA',
  'VEUR.AS':  'EURONEXT:VEUR',
  'CSPX.AS':  'EURONEXT:CSPX',
  'EIMI.AS':  'EURONEXT:EIMI',
  'VAGF.AS':  'EURONEXT:VAGF',
  'VWRL.AS':  'EURONEXT:VWRL',
  'EMIM.AS':  'EURONEXT:EMIM',
  'IUSA.AS':  'EURONEXT:IUSA',
  'IEUR.AS':  'EURONEXT:IEUR',
  'IQQH.DE':  'XETR:IQQH',
  'SPPW.DE':  'XETR:SPPW',
  'VGWL.DE':  'XETR:VGWL',
  // German (XETRA)
  'EXW1.DE':  'XETR:EXW1',
  'XDWD.DE':  'XETR:XDWD',
  'DBXD.DE':  'XETR:DBXD',
  'EXS1.DE':  'XETR:EXS1',
  'EXXT.DE':  'XETR:EXXT',
  // US-listed European ETFs
  'EWG':      'AMEX:EWG',
  'EWQ':      'AMEX:EWQ',
  'EWU':      'AMEX:EWU',
  'VGK':      'AMEX:VGK',
  'EZU':      'AMEX:EZU',
  'HEDJ':     'NYSE:HEDJ',
  // ── CAC 40 (Euronext Paris) ─────────────────────────────────────────
  'MC.PA':   'EURONEXT:MC',
  'OR.PA':   'EURONEXT:OR',
  'TTE.PA':  'EURONEXT:TTE',
  'AIR.PA':  'EURONEXT:AIR',
  'RMS.PA':  'EURONEXT:RMS',
  'BNP.PA':  'EURONEXT:BNP',
  'SAN.PA':  'EURONEXT:SAN',
  'AI.PA':   'EURONEXT:AI',
  'SU.PA':   'EURONEXT:SU',
  'BN.PA':   'EURONEXT:BN',
  'CAP.PA':  'EURONEXT:CAP',
  'STM.PA':  'EURONEXT:STM',
  'VIE.PA':  'EURONEXT:VIE',
  'DG.PA':   'EURONEXT:DG',
  'SGO.PA':  'EURONEXT:SGO',
  // ── Crypto (Binance) ────────────────────────────────────────────────
  'BTC-USD':  'BINANCE:BTCUSDT',
  'ETH-USD':  'BINANCE:ETHUSDT',
  'SOL-USD':  'BINANCE:SOLUSDT',
  'BNB-USD':  'BINANCE:BNBUSDT',
  'ADA-USD':  'BINANCE:ADAUSDT',
  'XRP-USD':  'BINANCE:XRPUSDT',
  'DOGE-USD': 'BINANCE:DOGEUSDT',
  'AVAX-USD': 'BINANCE:AVAXUSDT',
  'DOT-USD':  'BINANCE:DOTUSDT',
  'LINK-USD': 'BINANCE:LINKUSDT',
  // ── Aéro, Défense & Industrie (NYSE) ────────────────────────────────
  'BA':      'NYSE:BA',
  'LMT':     'NYSE:LMT',
  'RTX':     'NYSE:RTX',
  'NOC':     'NYSE:NOC',
  'GE':      'NYSE:GE',
  'CAT':     'NYSE:CAT',
  'DE':      'NYSE:DE',
  'UPS':     'NYSE:UPS',
  'FDX':     'NYSE:FDX',
  'MMM':     'NYSE:MMM',
}

const INTERVALS = [
  { label: '1m',    interval: '1m',  period: '1d'  },
  { label: '5m',    interval: '5m',  period: '5d'  },
  { label: '1h',    interval: '1h',  period: '1mo' },
  { label: '1j',    interval: '1d',  period: '6mo' },
  { label: '1sem',  interval: '1wk', period: '2y'  },
  { label: '1mois', interval: '1mo', period: '5y'  },
]

/* ══════════════════════════════════════════
   TRADINGVIEW CHART (iframe)
   Utilise embed-widget/advanced-chart —
   nouveau format officiel TradingView qui
   supporte EURONEXT + XETR sans paywall.
══════════════════════════════════════════ */
function TradingViewChart({ ticker, onTvReady }) {
  const [tvError, setTvError] = useState(false)
  const iframeRef = useRef(null)

  useEffect(() => { setTvError(false) }, [ticker])

  const symbol = TV_SYMBOL[ticker] || (() => {
    if (ticker.endsWith('.PA')) return 'EURONEXT:' + ticker.replace('.PA','')
    if (ticker.endsWith('.AS')) return 'EURONEXT:' + ticker.replace('.AS','')
    if (ticker.endsWith('.DE')) return 'XETR:'     + ticker.replace('.DE','')
    if (ticker.endsWith('-USD')) return 'BINANCE:' + ticker.replace('-USD','') + 'USDT'
    if (ticker.endsWith('=F'))  return 'TVC:'      + ticker.replace('=F','')
    return 'NYSE:' + ticker
  })()

  // ── Nouveau format embed-widget/advanced-chart (hash JSON)
  // Supporte EURONEXT/XETR sans message "symbole disponible uniquement sur TradingView"
  const src = useMemo(() => {
    const cfg = JSON.stringify({
      autosize:          true,
      symbol:            symbol,
      interval:          'D',
      timezone:          'Europe/Paris',
      theme:             'dark',
      style:             '1',
      locale:            'fr',
      enable_publishing: false,
      hide_top_toolbar:  false,
      hide_legend:       false,
      save_image:        false,
      studies:           ['STD;RSI'],
      support_host:      'https://www.tradingview.com',
    })
    return `https://s.tradingview.com/embed-widget/advanced-chart/?locale=fr#${encodeURIComponent(cfg)}`
  }, [symbol])

  if (tvError) {
    return <YFinanceChart ticker={ticker} onIndicatorsUpdate={null} />
  }

  return (
    <iframe
      ref={iframeRef}
      key={`tv-${ticker}`}
      src={src}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12, display: 'block' }}
      allowTransparency="true"
      scrolling="no"
      allowFullScreen
      title={`Chart ${ticker}`}
      onError={() => setTvError(true)}
    />
  )
}

/* ══════════════════════════════════════════
   YFINANCE CHART — CAC40
══════════════════════════════════════════ */
function YFinanceChart({ ticker, onIndicatorsUpdate }) {
  const containerRef  = useRef(null)
  const chartRef      = useRef(null)
  const timerRef      = useRef(null)

  const [activeIdx,   setActiveIdx]   = useState(3)   // défaut : 1j
  const [data,        setData]        = useState([])
  const [bbData,      setBbData]      = useState([])
  const [indicators,  setIndicators]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [showBB,      setShowBB]      = useState(false)
  const [showSMA,     setShowSMA]     = useState(true)
  const [marketOpen,  setMarketOpen]  = useState(null)
  const [rtPrice,     setRtPrice]     = useState(null)

  const { interval, period } = INTERVALS[activeIdx]

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    try {
      const [ohlcRes, indRes] = await Promise.all([
        API.get(`/api/market/ohlc/${ticker}?interval=${interval}&period=${period}`),
        API.get(`/api/market/indicators/${ticker}?interval=${interval}`),
      ])
      setData(ohlcRes.data?.data || [])
      setBbData(indRes.data?.bb_series || [])
      setIndicators(indRes.data)
      setMarketOpen(indRes.data?.market_open ?? null)
      setRtPrice(indRes.data?.last_price_rt ?? null)
      onIndicatorsUpdate?.(indRes.data)
      setLastUpdate(new Date())
      setError(null)
    } catch {
      setError('Impossible de charger le graphique')
    }
    if (!isRefresh) setLoading(false)
  }, [ticker, interval, period, onIndicatorsUpdate])

  useEffect(() => {
    setData([])
    fetchData(false)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => fetchData(true), 60000)
    return () => clearInterval(timerRef.current)
  }, [fetchData])

  /* ── Render chart ── */
  useEffect(() => {
    if (!containerRef.current || !data.length) return
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

    const W = containerRef.current.clientWidth
    const H = containerRef.current.clientHeight || 400

    const chart = createChart(containerRef.current, {
      width: W, height: H,
      layout: { background: { color: 'transparent' }, textColor: '#64748B', fontFamily: 'DM Mono' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: {
        vertLine: { color: 'rgba(124,58,237,0.5)', width: 1, style: 1 },
        horzLine: { color: 'rgba(124,58,237,0.5)', width: 1, style: 1 },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: interval === '1m',
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 5,
        tickMarkFormatter: (time) => {
          if (typeof time !== 'number') return ''
          const d = new Date(time * 1000)
          if (interval === '1d' || interval === '1wk' || interval === '1mo') {
            return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short' })
          }
          return d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
        },
      },
    })
    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', downColor: '#EF4444',
      borderUpColor: '#10B981', borderDownColor: '#EF4444',
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    })
    candleSeries.setData(data)

    // ── Ligne de prix temps réel (fast_info.last_price) ──
    // Affiche le prix actuel même si la dernière bougie est fermée/décalée
    if (rtPrice && data.length > 0) {
      const lastCandle = data[data.length - 1]
      const priceDiff  = Math.abs(rtPrice - lastCandle.close) / lastCandle.close
      // N'afficher la ligne que si le prix RT diffère > 0.01% de la dernière clôture
      if (priceDiff > 0.0001) {
        const rtColor = rtPrice >= lastCandle.close ? '#10B981' : '#EF4444'
        const rtSeries = chart.addSeries(LineSeries, {
          color: rtColor, lineWidth: 1, lineStyle: 2,
          title: `RT ${rtPrice.toFixed(2)}`,
          lastValueVisible: true, priceLineVisible: true,
        })
        rtSeries.setData([
          { time: data[0].time,        value: rtPrice },
          { time: lastCandle.time + 1, value: rtPrice },
        ])
      }
    }

    if (showSMA && data.length >= 50) {
      const smaData = data.slice(49).map((d, i) => ({
        time: d.time,
        value: parseFloat((data.slice(i, i + 50).reduce((s, x) => s + x.close, 0) / 50).toFixed(4)),
      }))
      chart.addSeries(LineSeries, { color: '#F59E0B', lineWidth: 1, lineStyle: 1, title: 'SMA50' }).setData(smaData)
    }

    if (showBB && bbData.length && interval === '1d') {
      chart.addSeries(LineSeries, { color: 'rgba(96,165,250,0.8)', lineWidth: 1, title: 'BB Upper' })
           .setData(bbData.map(b => ({ time: b.time, value: b.upper })))
      chart.addSeries(LineSeries, { color: 'rgba(96,165,250,0.4)', lineWidth: 1, lineStyle: 2, title: 'BB Mid' })
           .setData(bbData.map(b => ({ time: b.time, value: b.mid })))
      chart.addSeries(LineSeries, { color: 'rgba(96,165,250,0.8)', lineWidth: 1, title: 'BB Lower' })
           .setData(bbData.map(b => ({ time: b.time, value: b.lower })))
    }

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        if (e.contentRect.width > 0 && chartRef.current)
          chartRef.current.applyOptions({ width: e.contentRect.width })
      }
    })
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [data, bbData, showBB, showSMA, interval, rtPrice])

  const btnStyle = (active, rgb) => ({
    padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
    fontFamily: 'DM Sans', fontSize: '0.72rem', fontWeight: 600,
    background: active ? `rgba(${rgb},0.15)` : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? `rgba(${rgb},0.4)` : 'rgba(255,255,255,0.1)'}`,
    color: active ? `rgb(${rgb})` : 'var(--muted)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: '8px 12px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Ligne 1 : ticker + indicateurs inline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{ticker}</span>
            <span style={{ fontSize: '0.68rem', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#9F6CF0', borderRadius: 6, padding: '1px 7px' }}>
              {ticker.endsWith('.PA') ? 'CAC 40' : ticker.endsWith('.AS') ? 'Euronext AMS' : ticker.endsWith('.DE') ? 'XETRA' : 'EU'}
            </span>
            {indicators && (
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                RSI <span style={{ color: indicators.rsi > 70 ? '#EF4444' : indicators.rsi < 30 ? '#10B981' : '#C4B5FD' }}>{indicators.rsi?.toFixed(1)}</span>
                {' · '}MACD <span style={{ color: indicators.macd > indicators.signal ? '#10B981' : '#EF4444' }}>{indicators.macd > indicators.signal ? '↑' : '↓'}</span>
                {' · '}SMA50 <span style={{ color: '#F59E0B' }}>{indicators.sma50?.toFixed(0)}</span>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {marketOpen !== null && (
              <span style={{
                fontSize: '0.65rem', padding: '1px 7px', borderRadius: 5,
                background: marketOpen ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${marketOpen ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                color: marketOpen ? '#10B981' : '#EF4444',
              }}>
                {marketOpen ? '● Ouvert' : '● Fermé'}
              </span>
            )}
            {lastUpdate && (
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                🔄 {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Ligne 2 : intervalles + toggles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {INTERVALS.map((iv, i) => (
              <button key={i} onClick={() => setActiveIdx(i)} style={{
                padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'DM Mono', fontSize: '0.72rem', fontWeight: 600,
                background: activeIdx === i ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${activeIdx === i ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: activeIdx === i ? '#C4B5FD' : 'var(--muted)',
                transition: 'all 0.15s',
              }}>
                {iv.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowSMA(v => !v)} style={btnStyle(showSMA, '245,158,11')}>
              {showSMA ? '✓ SMA50' : '+ SMA50'}
            </button>
            {interval === '1d' && (
              <button onClick={() => setShowBB(v => !v)} style={btnStyle(showBB, '96,165,250')}>
                {showBB ? '✓ Bollinger' : '+ Bollinger'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
          ⏳ Chargement...
        </div>
      ) : error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCA5A5', fontSize: '0.85rem' }}>
          ❌ {error}
        </div>
      ) : (
        <div ref={containerRef} style={{ flex: 1, width: '100%', minHeight: 0 }} />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   EXPORT
   - EU (.PA / .AS / .DE) → YFinanceChart
     TradingView bloque EURONEXT/XETR dans
     tous ses widgets gratuits.
   - US / crypto → TradingView ✓
     + background fetch indicators panneau.
══════════════════════════════════════════ */
const isEuropean = (t) => t.endsWith('.PA') || t.endsWith('.AS') || t.endsWith('.DE')

export default function Chart({ ticker, onIndicatorsUpdate }) {
  if (isEuropean(ticker)) {
    return <YFinanceChart ticker={ticker} onIndicatorsUpdate={onIndicatorsUpdate} />
  }
  return <TradingViewWithIndicators ticker={ticker} onIndicatorsUpdate={onIndicatorsUpdate} />
}

function TradingViewWithIndicators({ ticker, onIndicatorsUpdate }) {
  useEffect(() => {
    if (!onIndicatorsUpdate) return
    let cancelled = false
    API.get(`/api/market/indicators/${ticker}?interval=1d`)
      .then(r => { if (!cancelled) onIndicatorsUpdate(r.data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [ticker, onIndicatorsUpdate])
  return <TradingViewChart ticker={ticker} />
}
