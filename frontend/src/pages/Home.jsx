import { useState, useEffect } from 'react'
import { Telescope, Rocket } from 'lucide-react'
import api from '../api/axios'
import LaunchCard from '../components/LaunchCard'

const TABS = ['upcoming', 'past']

export default function Home() {
  const [tab, setTab] = useState('upcoming')
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/launches/${tab}/`)
      .then(({ data }) => setLaunches(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setError('Could not load launches. The API may be rate-limited — try again in a moment.'))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="page-container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 56 }} className="fade-up">
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 999, padding: '6px 16px', marginBottom: 20, fontSize: 13,
          color: 'var(--accent)',
        }}>
          <Telescope size={14} />
          Live data from Launch Library 2 API
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 60px)', margin: '0 0 16px', lineHeight: 1.1 }}>
          Track Every<br />
          <span style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Rocket Launch
          </span>
        </h1>
        <p style={{ margin: '0 auto', maxWidth: 500, color: 'var(--text-secondary)', fontSize: 17, lineHeight: 1.7 }}>
          Upcoming missions, live countdowns, and a personal watchlist — all in one place.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'center' }}>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'upcoming' ? '🚀 Upcoming' : '📡 Past'}
            </button>
          ))}
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
          <div className="icon">⚠️</div>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        launches.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Rocket size={48} /></div>
            <p>No launches found.</p>
          </div>
        ) : (
          <div className="launches-grid">
            {launches.map((launch, i) => (
              <div key={launch.api_id || launch.id} style={{ animationDelay: `${i * 40}ms` }}>
                <LaunchCard launch={launch} showCountdown={tab === 'upcoming'} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
