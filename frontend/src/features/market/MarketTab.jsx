import { useState, useEffect, useRef, useCallback } from 'react'
import API from '../../api/client'
import Chart from '../../components/Chart'
import { useT, useLang } from '../../context/LangContext'
import useIsMobile from '../../lib/useIsMobile'

// Tickers CAC40 — même set que dans Chart.jsx
const CAC40_SET = new Set(['MC.PA','OR.PA','TTE.PA','AIR.PA','RMS.PA','BNP.PA','SAN.PA','AI.PA','SU.PA','BN.PA','CAP.PA','STM.PA','VIE.PA','DG.PA','SGO.PA'])

const SELECT_STYLE = {
  width: '100%', background: '#1A1530',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
  color: '#F1F5F9', padding: '9px 12px', fontFamily: 'DM Sans',
  cursor: 'pointer', outline: 'none',
}

export default function MarketTab({ showToast }) {
  const t    = useT()
  const lang = useLang()
  const isMobile = useIsMobile()

  const SECTORS = {
    // ── Tech & IA US ─────────────────────────────────────────────────────
    [t('Tech & IA','Tech & AI')]: {
      NVDA:'NVIDIA', AAPL:'Apple', MSFT:'Microsoft', GOOGL:'Google',
      META:'Meta', AMZN:'Amazon', TSLA:'Tesla', AMD:'AMD',
      ORCL:'Oracle', NFLX:'Netflix', ADBE:'Adobe', CRM:'Salesforce',
      INTC:'Intel', QCOM:'Qualcomm', AVGO:'Broadcom',
    },
    // ── Finance US ───────────────────────────────────────────────────────
    [t('Finance','Finance')]: {
      JPM:'JPMorgan', BAC:'Bank of America', GS:'Goldman Sachs',
      MS:'Morgan Stanley', BLK:'BlackRock', V:'Visa', MA:'Mastercard',
      AXP:'American Express', WFC:'Wells Fargo', C:'Citigroup',
      'BRK-B':'Berkshire B', SPGI:'S&P Global',
    },
    // ── Santé & Pharma ───────────────────────────────────────────────────
    [t('Santé','Health')]: {
      LLY:'Eli Lilly', NVO:'Novo Nordisk', ABBV:'AbbVie',
      JNJ:'J&J', MRK:'Merck', PFE:'Pfizer',
      MRNA:'Moderna', AMGN:'Amgen', BMY:'Bristol-Myers',
      GILD:'Gilead', ISRG:'Intuitive Surgical',
    },
    // ── Consommation & Retail ────────────────────────────────────────────
    [t('Conso & Retail','Consumer')]: {
      MCD:"McDonald's", SBUX:'Starbucks', NKE:'Nike',
      TGT:'Target', WMT:'Walmart', COST:'Costco',
      HD:'Home Depot', PG:'Procter & Gamble',
      KO:'Coca-Cola', PEP:'PepsiCo', MDLZ:'Mondelez',
    },
    // ── Énergie ──────────────────────────────────────────────────────────
    [t('Énergie','Energy')]: {
      XOM:'ExxonMobil', CVX:'Chevron', COP:'ConocoPhillips',
      SLB:'Schlumberger', BP:'BP', SHEL:'Shell',
      'CL=F':t('WTI Pétrole','WTI Oil'),
      'NG=F':t('Gaz Naturel','Natural Gas'),
      NEE:'NextEra Energy', ENPH:'Enphase (Solaire)',
    },
    // ── Métaux & Matières premières ───────────────────────────────────────
    [t('Métaux & MP','Metals')]: {
      'GC=F':t('Or','Gold'), 'SI=F':t('Argent','Silver'),
      'HG=F':t('Cuivre','Copper'), 'PL=F':t('Platine','Platinum'),
      NEM:'Newmont (Or)', GOLD:'Barrick Gold',
      FCX:'Freeport (Cuivre)', AA:'Alcoa (Alu)',
    },
    // ── ETF US ───────────────────────────────────────────────────────────
    [t('ETF US','US ETFs')]: {
      SPY:'S&P 500 (SPY)', QQQ:'Nasdaq 100 (QQQ)',
      IWM:'Russell 2000 (IWM)', DIA:'Dow Jones (DIA)',
      VOO:'Vanguard S&P 500 (VOO)', VTI:'Vanguard Total Market',
      XLF:'ETF Finance (XLF)', XLE:'ETF Énergie (XLE)',
      XLK:'ETF Tech (XLK)', XLV:'ETF Santé (XLV)',
      ARKK:'ARK Innovation', SOXX:'Semi-conducteurs',
    },
    // ── ETF Obligations & Macro ───────────────────────────────────────────
    [t('ETF Oblig & Macro','Bond ETFs')]: {
      TLT:'Treasury 20Y (TLT)', IEF:'Treasury 10Y (IEF)',
      BND:'Vanguard Bonds (BND)', HYG:'High Yield (HYG)',
      LQD:'Corp Bonds (LQD)', GLD:'Gold ETF (GLD)',
      SLV:'Silver ETF (SLV)', VNQ:'REIT Immo (VNQ)',
    },
    // ── CAC 40 ───────────────────────────────────────────────────────────
    [t('🇫🇷 CAC 40','🇫🇷 CAC 40')]: {
      'MC.PA':'LVMH', 'OR.PA':"L'Oréal", 'TTE.PA':'TotalEnergies',
      'AIR.PA':'Airbus', 'RMS.PA':'Hermès', 'BNP.PA':'BNP Paribas',
      'SAN.PA':'Sanofi', 'AI.PA':'Air Liquide', 'SU.PA':'Schneider',
      'BN.PA':'Danone', 'CAP.PA':'Capgemini', 'STM.PA':'STMicro',
      'VIE.PA':'Veolia', 'DG.PA':'Vinci', 'SGO.PA':'Saint-Gobain',
    },
    // ── ETF Europe ───────────────────────────────────────────────────────
    [t('🇪🇺 ETF Europe','🇪🇺 Europe ETFs')]: {
      'IWDA.AS':'World MSCI (IWDA)', 'VEUR.AS':'Europe Vanguard',
      'CSPX.AS':'S&P 500 iShares', EWG:'Allemagne (EWG)',
      EWQ:'France (EWQ)', EWU:'UK (EWU)',
      'EXW1.DE':'MSCI World iShares DE', 'XDWD.DE':'World Xtrackers',
    },
    // ── Crypto ───────────────────────────────────────────────────────────
    [t('₿ Crypto','₿ Crypto')]: {
      'BTC-USD':'Bitcoin', 'ETH-USD':'Ethereum', 'SOL-USD':'Solana',
      'BNB-USD':'BNB', 'ADA-USD':'Cardano', 'XRP-USD':'XRP',
      'DOGE-USD':'Dogecoin', 'AVAX-USD':'Avalanche',
      'DOT-USD':'Polkadot', 'LINK-USD':'Chainlink',
    },
    // ── Aéro, Défense & Industrie ─────────────────────────────────────────
    [t('Aéro & Industrie','Aero & Industry')]: {
      BA:'Boeing', LMT:'Lockheed Martin', RTX:'RTX Corp',
      NOC:'Northrop Grumman', GE:'GE Aerospace',
      CAT:'Caterpillar', DE:'John Deere',
      UPS:'UPS', FDX:'FedEx', MMM:'3M',
    },
  }
  const sectorKeys = Object.keys(SECTORS)

  const [sector, setSector]             = useState(sectorKeys[0])
  const [ticker, setTicker]             = useState('NVDA')
  const [ind, setInd]                   = useState(null)
  const [indInterval, setIndInterval]   = useState('1d')
  const [mode, setMode]                 = useState('qty')
  const [val, setVal]                   = useState(1)
  const [msg, setMsg]                   = useState('')
  const [msgOk, setMsgOk]              = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [positions, setPositions]       = useState([])

  // Fetch portfolio positions pour afficher P&L si actif détenu
  useEffect(() => {
    API.get('/api/portfolio/summary?portfolio=USER')
      .then(r => setPositions(r.data.positions || []))
      .catch(() => {})
  }, [])

  // Refresh positions après un ordre
  const refreshPositions = () => {
    API.get('/api/portfolio/summary?portfolio=USER')
      .then(r => setPositions(r.data.positions || []))
      .catch(() => {})
  }

  // Position courante sur le ticker sélectionné
  const currentPosition = positions.find(p => p.ticker === ticker)

  // Recherche cross-secteur
  const allTickersList = Object.entries(SECTORS).flatMap(([sec, tickers]) =>
    Object.entries(tickers).map(([k, v]) => ({ sector: sec, ticker: k, name: v }))
  )
  const searchResults = searchQuery.length >= 1
    ? allTickersList.filter(({ ticker: t, name }) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()) ||
        name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  // ── Statut marché pour le ticker sélectionné ─────────────────────────────
  const getTickerMarketStatus = (t) => {
    const isCrypto    = t.includes('-USD')
    const isCommodity = t.endsWith('=F')
    const isEU        = t.endsWith('.PA') || t.endsWith('.AS') || t.endsWith('.DE')
    if (isCrypto || isCommodity) return { open: true, label: '24/7 — Toujours ouvert', color: '#10b981' }

    const now = new Date()
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    if (isWeekend) {
      if (isEU) return { open: false, label: 'Euronext fermé — Weekend', color: '#ef4444' }
      return { open: false, label: 'NYSE/NASDAQ fermé — Weekend', color: '#ef4444' }
    }
    if (isEU) {
      const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
      const h = paris.getHours(), m = paris.getMinutes()
      const afterOpen  = h > 9 || (h === 9 && m >= 0)
      const beforeClose = h < 17 || (h === 17 && m <= 30)
      if (afterOpen && beforeClose) return { open: true,  label: `Euronext ouvert — ${h}h${String(m).padStart(2,'0')} Paris`, color: '#10b981' }
      if (!afterOpen)               return { open: false, label: 'Euronext fermé — ouvre à 09h00 Paris', color: '#ef4444' }
      return { open: false, label: 'Euronext fermé — clôture à 17h30 Paris', color: '#ef4444' }
    }
    // Actions US + ETFs US
    const ny    = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const h = ny.getHours(), m = ny.getMinutes()
    const ph = paris.getHours(), pm = paris.getMinutes()
    const afterOpen  = h > 9 || (h === 9 && m >= 30)
    const beforeClose = h < 16
    if (afterOpen && beforeClose) return { open: true,  label: `NYSE/NASDAQ ouvert — ${h}h${String(m).padStart(2,'0')} ET (${ph}h${String(pm).padStart(2,'0')} Paris)`, color: '#10b981' }
    if (!afterOpen)               return { open: false, label: `NYSE/NASDAQ fermé — ouvre à 09h30 ET`, color: '#ef4444' }
    return { open: false, label: `NYSE/NASDAQ fermé — clôture à 16h00 ET`, color: '#ef4444' }
  }
  const mktStatus = getTickerMarketStatus(ticker)
  const [question, setQuestion]         = useState('')
  const [coachLoading, setCoachLoading] = useState(false)
  const [msgs, setMsgs]                 = useState([])
  const coachEndRef                     = useRef(null)

  // ── Fetch indicateurs pour les tickers NON-CAC40 (TradingView)
  // Pour le CAC40, les indicateurs arrivent via onIndicatorsUpdate depuis Chart.jsx
  useEffect(() => {
    if (CAC40_SET.has(ticker)) {
      setInd(null)       // sera rempli par onIndicatorsUpdate
      setIndInterval('1d')
      return
    }
    const fetchData = () => {
      API.get(`/api/market/indicators/${ticker}`).then(r => {
        setInd(r.data)
        setIndInterval('1d')
      }).catch(() => {})
    }
    setInd(null)
    fetchData()
    const isCrypto = ticker.includes('-USD')
    const interval = setInterval(fetchData, isCrypto ? 30000 : 60000)
    return () => clearInterval(interval)
  }, [ticker])

  // ── Callback appelé par YFinanceChart quand les indicateurs changent d'intervalle
  const handleIndicatorsUpdate = useCallback((data) => {
    setInd(data)
    setIndInterval(data?.interval || '1d')
  }, [])

  const order = async (side) => {
    try {
      const r = await API.post('/api/portfolio/order', { ticker, side, mode, value: parseFloat(val), portfolio: 'USER' })
      setMsg(r.data.message); setMsgOk(true)
      showToast?.(r.data.message)
      refreshPositions()
    } catch (e) {
      setMsg(e.response?.data?.detail || t('Erreur','Error')); setMsgOk(false)
    }
    setTimeout(() => setMsg(''), 4000)
  }

  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, coachLoading])

  const askCoach = async () => {
    if (!question.trim() || !ind) return
    const q = question.trim()
    setCoachLoading(true)
    setMsgs(m => [...m, { role: 'user', text: q }])
    setQuestion('')
    try {
      const r = await API.post('/api/coach/ask', {
        question: q,
        ticker,
        price: ind.price,
        rsi: ind.rsi,
        macd: ind.macd > ind.signal ? 'BULL' : 'BEAR',
        sma50: ind.sma50,
        conversation_history: msgs.slice(-6).map(m => ({ role: m.role, text: m.text })),
      })
      setMsgs(m => [...m, { role: 'coach', text: r.data.response, qtype: r.data.question_type }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'coach', text: `❌ ${t('Coach indisponible.','Coach unavailable.')}` }])
    }
    setCoachLoading(false)
  }

  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>
        {t('Marché & Trading','Market & Trading')}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginBottom: 18 }}>
        {t('Analyse, passe des ordres et interroge le coach IA','Analyze, place orders and ask the AI coach')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '290px 1fr', gap: 14 }}>
        {/* Panneau gauche */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 16, marginBottom: isMobile ? 80 : 0 }}>
          {/* Barre de recherche cross-secteur */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Rechercher un actif…', 'Search asset…')}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#F1F5F9',
                padding: '9px 12px 9px 34px',
                fontFamily: 'DM Sans', fontSize: '0.85rem', outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', pointerEvents: 'none' }}>
              &#128269;
            </span>
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: '#1A1530', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, marginTop: 4, overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {searchResults.map(({ sector: sec, ticker: t2, name }) => (
                  <div
                    key={t2}
                    onClick={() => {
                      setTicker(t2)
                      setSector(sec)
                      setSearchQuery('')
                    }}
                    style={{
                      padding: '9px 12px', cursor: 'pointer', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 700, color: '#C4B5FD', fontSize: '0.82rem' }}>{t2}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem', marginLeft: 8 }}>{name}</span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{sec.replace(/[^\w\s&]/g, '').trim()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.0 }}>{t('Secteur','Sector')}</label>
          <select value={sector} onChange={e => { setSector(e.target.value); setTicker(Object.keys(SECTORS[e.target.value])[0]) }} style={{ ...SELECT_STYLE, marginTop: 5, marginBottom: 12 }}>
            {sectorKeys.map(s => <option key={s} value={s} style={{ background: '#1A1530' }}>{s}</option>)}
          </select>

          <label style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.0 }}>{t('Actif','Asset')}</label>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={{ ...SELECT_STYLE, marginTop: 5, marginBottom: 8 }}>
            {Object.entries(SECTORS[sector] || {}).map(([k, v]) => (
              <option key={k} value={k} style={{ background: '#1A1530' }}>{v} ({k})</option>
            ))}
          </select>

          {/* Badge statut marché */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8, marginBottom: 14,
            background: mktStatus.open ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${mktStatus.open ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: mktStatus.color,
              boxShadow: mktStatus.open ? `0 0 6px ${mktStatus.color}` : 'none',
            }} />
            <span style={{ fontSize: '0.72rem', color: mktStatus.color, fontFamily: 'DM Mono' }}>
              {mktStatus.label}
            </span>
          </div>

          {/* Panel positions ouvertes — toutes les positions avec P&L inline */}
          {positions.filter(p => p.quantity > 0).length > 0 && (
            <div style={{
              marginBottom: 12, borderRadius: 10,
              border: '1px solid rgba(124,58,237,0.2)',
              background: 'rgba(124,58,237,0.04)',
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: '0.64rem', color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: 1.0,
                padding: '6px 12px 4px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                {t('Positions ouvertes', 'Open positions')}
              </div>
              {positions.filter(p => p.quantity > 0).map(p => {
                const found = allTickersList.find(x => x.ticker === p.ticker)
                const isActive = ticker === p.ticker
                return (
                  <div
                    key={p.ticker}
                    onClick={() => {
                      if (found) { setSector(found.sector); setTicker(p.ticker) }
                      else setTicker(p.ticker)
                    }}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: 700, color: isActive ? '#C4B5FD' : '#fff' }}>
                      {p.ticker}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'DM Mono', fontSize: '0.78rem', fontWeight: 700, color: p.pnl >= 0 ? '#10B981' : '#EF4444' }}>
                        {p.pnl >= 0 ? '+' : ''}${p.pnl?.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: p.pnl_pct >= 0 ? '#6EE7B7' : '#FCA5A5', marginLeft: 5 }}>
                        ({p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct?.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Banner position — visible si actif détenu */}
          {currentPosition && currentPosition.quantity > 0 && (
            <div style={{
              padding: '9px 12px', borderRadius: 10, marginBottom: 10,
              background: currentPosition.pnl >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${currentPosition.pnl >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              <div style={{ fontSize: '0.69rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 }}>
                {t('Ma position', 'My position')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'DM Mono', fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
                    {currentPosition.quantity.toFixed(4)}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginLeft: 5 }}>
                    {t('actions', 'shares')} @ ${currentPosition.avg_price?.toFixed(2)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono', fontSize: '0.85rem', fontWeight: 700, color: currentPosition.pnl >= 0 ? '#10B981' : '#EF4444' }}>
                    {currentPosition.pnl >= 0 ? '+' : ''}${currentPosition.pnl?.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: currentPosition.pnl_pct >= 0 ? '#6EE7B7' : '#FCA5A5' }}>
                    {currentPosition.pnl_pct >= 0 ? '+' : ''}{currentPosition.pnl_pct?.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {ind ? (
            <>
              {/* Price — big number */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0 6px' }}>
                <div style={{ fontFamily: 'Syne', fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>${ind.price?.toFixed(2)}</div>
                {CAC40_SET.has(ticker) && (
                  <span style={{ fontSize: '0.65rem', color: '#C4B5FD', background: 'rgba(124,58,237,0.12)', padding: '1px 6px', borderRadius: 4, fontFamily: 'DM Mono', fontWeight: 700 }}>{indInterval}</span>
                )}
              </div>

              {/* Indicators row */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                  { label: 'RSI', val: ind.rsi?.toFixed(0), color: ind.rsi > 70 ? '#EF4444' : ind.rsi < 30 ? '#10B981' : '#9F6CF0' },
                  { label: 'MACD', val: ind.macd > ind.signal ? '↑ Bull' : '↓ Bear', color: ind.macd > ind.signal ? '#10B981' : '#EF4444' },
                  { label: 'SMA50', val: `$${ind.sma50?.toFixed(0)}`, color: ind.price > ind.sma50 ? '#10B981' : '#EF4444' },
                ].map((x, i) => (
                  <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>{x.label}</div>
                    <div style={{ fontFamily: 'DM Mono', fontWeight: 700, color: x.color, fontSize: '0.82rem' }}>{x.val}</div>
                  </div>
                ))}
              </div>

              {/* ── Strike levels — clés techniques ── */}
              {ind.high52w && (
                <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>
                    {t('Niveaux clés (52 semaines)', 'Key levels (52 weeks)')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: t('Plus haut 52s', '52w High'), val: `$${ind.high52w?.toFixed(2)}`, pct: ind.pct_from_high, color: '#EF4444', icon: '▲' },
                      { label: t('Plus bas 52s', '52w Low'), val: `$${ind.low52w?.toFixed(2)}`, pct: ind.pct_from_low, color: '#10B981', icon: '▼' },
                      { label: 'SMA200', val: ind.sma200 ? `$${ind.sma200?.toFixed(0)}` : 'N/A', pct: null, color: ind.price > ind.sma200 ? '#10B981' : '#EF4444', icon: ind.price > ind.sma200 ? '↑' : '↓' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: s.color }}>{s.icon}</span> {s.label}
                        </span>
                        <span style={{ fontFamily: 'DM Mono', fontSize: '0.72rem', color: '#fff', fontWeight: 600 }}>
                          {s.val}
                          {s.pct != null && (
                            <span style={{ color: s.pct >= 0 ? '#10B981' : '#EF4444', marginLeft: 5, fontSize: '0.65rem' }}>
                              {s.pct >= 0 ? '+' : ''}{s.pct?.toFixed(1)}%
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Visual position bar */}
                  {ind.high52w && ind.low52w && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 2,
                          background: 'linear-gradient(90deg, #EF4444, #F59E0B, #10B981)',
                          width: `${Math.max(2, Math.min(98, ((ind.price - ind.low52w) / (ind.high52w - ind.low52w)) * 100))}%`,
                          transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
                        <span>Low</span><span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>•{((ind.price - ind.low52w) / (ind.high52w - ind.low52w) * 100).toFixed(0)}%</span><span>High</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.83rem', margin: '16px 0', textAlign: 'center' }}>{t('Chargement…','Loading…')}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {['qty', 'amount'].map(m => (
              <button key={m} onClick={() => { setMode(m); setVal(m === 'qty' ? 1 : 100) }} style={{ flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: '0.8rem', fontWeight: 600, background: mode === m ? 'rgba(124,58,237,0.2)' : 'transparent', border: `1px solid ${mode === m ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: mode === m ? '#9F6CF0' : 'var(--muted)' }}>
                {m === 'qty' ? t('# Actions','# Shares') : t('Montant $','Amount $')}
              </button>
            ))}
          </div>

          <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} min={mode === 'qty' ? 1 : 10} step={mode === 'qty' ? 1 : 50}
            placeholder={mode === 'qty' ? t("Nombre d'actions",'Number of shares') : t('Montant en $','Amount in $')}
            style={{ width: '100%', marginBottom: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '9px 12px', fontFamily: 'DM Sans', boxSizing: 'border-box' }}
          />

          {/* Quick amount presets */}
          {mode === 'amount' && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
              {[100, 250, 500, 1000].map(amt => (
                <button key={amt} onClick={() => setVal(amt)} style={{
                  padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                  fontFamily: 'DM Mono', fontWeight: 600,
                  background: val === amt ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${val === amt ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                  color: val === amt ? '#C4B5FD' : 'var(--muted)',
                }}>
                  ${amt}
                </button>
              ))}
            </div>
          )}

          {/* Estimation */}
          {ind?.price > 0 && val > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10, padding: '5px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, fontFamily: 'DM Mono' }}>
              {mode === 'amount'
                ? `≈ ${(val / ind.price).toFixed(4)} ${t('actions', 'shares')} @ $${ind.price?.toFixed(2)}`
                : `≈ $${(val * ind.price).toFixed(2)} ${t('total', 'total')}`
              }
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => order('BUY')}
              disabled={!mktStatus.open}
              title={!mktStatus.open ? mktStatus.label : ''}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                background: mktStatus.open ? 'linear-gradient(135deg, #059669, #10B981)' : 'rgba(255,255,255,0.06)',
                color: mktStatus.open ? '#fff' : 'var(--muted)',
                fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.9rem',
                cursor: mktStatus.open ? 'pointer' : 'not-allowed', opacity: mktStatus.open ? 1 : 0.5 }}>
              {t('Acheter','Buy')}
            </button>
            <button
              onClick={() => order('SELL')}
              disabled={!mktStatus.open}
              title={!mktStatus.open ? mktStatus.label : ''}
              style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none',
                background: mktStatus.open ? 'linear-gradient(135deg, #DC2626, #EF4444)' : 'rgba(255,255,255,0.06)',
                color: mktStatus.open ? '#fff' : 'var(--muted)',
                fontFamily: 'DM Sans', fontWeight: 700, fontSize: '0.9rem',
                cursor: mktStatus.open ? 'pointer' : 'not-allowed', opacity: mktStatus.open ? 1 : 0.5 }}>
              {t('Vendre','Sell')}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: msgOk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msgOk ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: '0.82rem', color: msgOk ? '#6EE7B7' : '#FCA5A5' }}>
              {msg}
            </div>
          )}
        </div>

        {/* Panneau droit — chart + coach */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 18,
            padding: 0,
            height: isMobile ? 360 : 540,
            overflow: 'hidden',
          }}>
            <Chart ticker={ticker} onIndicatorsUpdate={handleIndicatorsUpdate} />
          </div>

          {/* ── Coach IA panel — redesigned ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px 18px', marginBottom: isMobile ? 90 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>
                💬 {t('Coach IA','AI Coach')}
              </div>
              {msgs.length > 0 && (
                <button onClick={() => setMsgs([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'DM Sans' }}>
                  {t('Effacer','Clear')} ✕
                </button>
              )}
            </div>

            {/* Quick questions */}
            {msgs.length === 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('Questions rapides','Quick questions')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {[
                    t('Analyser ce graphique', 'Analyze this chart'),
                    t('Dois-je acheter ?', 'Should I buy?'),
                    t('Quel stop loss ?', 'What stop loss?'),
                    t('Risque du trade ?', 'Trade risk?'),
                  ].map((q, i) => (
                    <button key={i} onClick={() => setQuestion(q)} style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                      color: '#a78bfa', fontFamily: 'DM Sans', fontWeight: 500,
                    }}>{q}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversation */}
            <div style={{ maxHeight: msgs.length ? 200 : 0, overflowY: 'auto', marginBottom: msgs.length ? 12 : 0, display: 'flex', flexDirection: 'column', gap: 10, transition: 'max-height 0.3s' }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 12, fontSize: '0.83rem', lineHeight: 1.65,
                  background: m.role === 'user' ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${m.role === 'user' ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  color: m.role === 'user' ? '#C4B5FD' : 'rgba(255,255,255,0.85)',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '92%',
                }}>
                  {m.role === 'coach' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ color: '#9F6CF0', fontWeight: 700, fontSize: '0.75rem' }}>🎓 Coach</span>
                      {m.qtype && (
                        <span style={{ fontSize: '0.62rem', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '1px 6px', borderRadius: 4, fontFamily: 'DM Mono', textTransform: 'uppercase' }}>{m.qtype}</span>
                      )}
                    </div>
                  )}
                  {m.text}
                </div>
              ))}
              {coachLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, width: 'fit-content' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>⏳</span> {t('Le coach réfléchit...','Coach is thinking...')}
                </div>
              )}
              <div ref={coachEndRef} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !coachLoading && askCoach()}
                placeholder={t('Ta question au coach IA...','Ask the AI coach...')}
                disabled={!ind}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', padding: '9px 13px', fontFamily: 'DM Sans', fontSize: '0.86rem', outline: 'none', minWidth: 0, transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button onClick={askCoach} disabled={coachLoading || !ind || !question.trim()} style={{
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', border: 'none', color: '#fff',
                borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
                fontFamily: 'DM Sans', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.84rem',
                opacity: coachLoading || !ind || !question.trim() ? 0.5 : 1, transition: 'opacity 0.15s',
              }}>
                {coachLoading ? '...' : (isMobile ? '→' : t('Envoyer','Send'))}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
