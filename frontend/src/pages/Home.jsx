import { useState, useEffect } from 'react'
import { Rocket } from 'lucide-react'
import api from '../api/axios'
import LaunchCard from '../components/LaunchCard'

export default function Home() {
  const [tab, setTab] = useState('upcoming')
  const [source, setSource] = useState('all')
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/launches/${tab}/`, { params: { source } })
      .then(({ data }) => setLaunches(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setError('Failed to fetch launches. Try refreshing the page.'))
      .finally(() => setLoading(false))
  }, [tab, source])

  return (
    <div className="page-container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ marginBottom: 48 }} className="fade-up">
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', margin: '0 0 12px', lineHeight: 1.15, fontWeight: 800 }}>
          Rocket Launch Tracker
        </h1>
        <p style={{ margin: 0, maxWidth: 480, color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.6 }}>
          Browse upcoming and past launches from Launch Library 2 and SpaceX.
          Save missions to your watchlist and write personal logs.
        </p>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Timeline tabs */}
        <div className="tabs">
          <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Upcoming
          </button>
          <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
            Past
          </button>
        </div>

        {/* Source filter */}
        <div className="tabs">
          <button className={`tab ${source === 'all' ? 'active' : ''}`} onClick={() => setSource('all')}>
            All Sources
          </button>
          <button className={`tab ${source === 'll2' ? 'active' : ''}`} onClick={() => setSource('ll2')}>
            Launch Library
          </button>
          <button className={`tab ${source === 'spacex' ? 'active' : ''}`} onClick={() => setSource('spacex')}>
            SpaceX
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div className="empty-state">
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        launches.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Rocket size={40} /></div>
            <p>No launches found for this filter.</p>
          </div>
        ) : (
          <div className="launches-grid">
            {launches.map((launch, i) => (
              <div key={launch.api_id || launch.id} style={{ animationDelay: `${i * 30}ms` }}>
                <LaunchCard launch={launch} showCountdown={tab === 'upcoming'} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
