import { useQuery } from '@tanstack/react-query'
import API from '../../api/client'
import { useT } from '../../context/LangContext'

export default function NewsTab() {
  const t = useT()
  const { data: news } = useQuery({
    queryKey: ['news-feed'],
    queryFn: () => API.get('/api/news/feed').then(r => r.data),
    refetchInterval: 5 * 60_000,   // les news macro bougent lentement
  })
  return (
    <div>
      <div style={{ fontFamily: 'Syne', fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{t('News Macro','Macro News')}</div>
      <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: 20 }}>{t('Actualités géopolitiques et macroéconomiques filtrées','Filtered geopolitical and macroeconomic news')}</div>
      {news ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 16px', borderRadius: 10,
              background: news.risk === 'HIGH' ? 'rgba(239,68,68,0.1)' : news.risk === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${news.risk === 'HIGH' ? 'rgba(239,68,68,0.3)' : news.risk === 'MEDIUM' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              color: news.risk === 'HIGH' ? '#FCA5A5' : news.risk === 'MEDIUM' ? '#FCD34D' : '#6EE7B7',
              fontSize: '0.85rem', fontWeight: 600 }}>
              {t('Risque macro','Macro risk')} : {news.risk} ({news.risk_score}/100)
            </div>
            {news.risk_explanation && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {news.risk_explanation}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {news.articles?.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                <div className="glass-panel card-hover" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem', lineHeight: 1.4 }}>{a.title}</div>
                    {a.trusted && <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>✅ Trusted</span>}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 6 }}>{a.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>{a.source}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      ) : <div style={{ color: 'var(--muted)' }}>{t('Chargement des news…','Loading news…')}</div>}
    </div>
  )
}
