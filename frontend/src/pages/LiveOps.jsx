import { useState, useEffect } from 'react'
import api from '../api/axios'
import SkeletonCard from '../components/SkeletonCard'
import { Timer, Users, Activity, ExternalLink } from 'lucide-react'

export default function LiveOps() {
  const [stations, setStations] = useState([])
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/launches/live-ops/'),
      api.get('/launches/news/')
    ]).then(([opsRes, newsRes]) => {
      setStations(opsRes.data)
      setNews(newsRes.data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="page-container" style={{ paddingTop: 100 }}><SkeletonCard count={3} /></div>

  return (
    <div className="page-container" style={{ paddingTop: 100, paddingBottom: 100 }}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: 8 }}>
          Live <span style={{ color: 'var(--accent)' }}>Operations</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 600 }}>
          Real-time tracking of orbital stations, active crew, and mission milestones.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 60 }}>
        {stations.map(s => (
          <div key={s.id} className="glass card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.name}</h3>
                <span className="badge badge-success" style={{ marginTop: 8 }}>{s.status}</span>
              </div>
              <Activity size={24} color="var(--accent)" />
            </div>
            
            {s.image && (
              <img src={s.image} alt={s.name} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12 }} />
            )}

            <div style={{ display: 'flex', gap: 24, marginTop: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--text-secondary)" />
                <span style={{ fontWeight: 600 }}>{s.crew_count} Crew</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Timer size={16} color="var(--text-secondary)" />
                <span style={{ fontWeight: 600 }}>Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={24} color="var(--accent)" /> Latest Mission News
        </h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {news.map(n => (
            <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="glass card news-item" style={{ 
              padding: 20, 
              display: 'flex', 
              gap: 20, 
              textDecoration: 'none',
              transition: 'transform 0.2s'
            }}>
              {n.image_url && (
                <img src={n.image_url} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>{n.news_site}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(n.published_at).toLocaleDateString()}</span>
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{n.title}</h4>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineBreak: 'anywhere' }}>{n.summary.substring(0, 150)}...</p>
              </div>
              <ExternalLink size={16} style={{ flexShrink: 0, marginTop: 4 }} />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
