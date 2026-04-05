import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Rocket, Search, Radio, Globe } from 'lucide-react'
import api from '../api/axios'
import LaunchCard from '../components/LaunchCard'
import SkeletonCard from '../components/SkeletonCard'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'upcoming'
  const source = searchParams.get('source') || 'all'

  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const setTab = (t) => setSearchParams({ tab: t, source }, { replace: false })
  const setSource = (s) => setSearchParams({ tab, source: s }, { replace: false })

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get(`/launches/${tab}/`, { params: { source } })
      .then(({ data }) => setLaunches(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setError('Failed to fetch launches. Try refreshing the page.'))
      .finally(() => setLoading(false))
  }, [tab, source])

  // Client-side search filter
  const filteredLaunches = useMemo(() => {
    if (!searchQuery.trim()) return launches
    const q = searchQuery.toLowerCase()
    return launches.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.rocket || '').toLowerCase().includes(q) ||
      (l.launch_provider || '').toLowerCase().includes(q)
    )
  }, [launches, searchQuery])

  return (
    <div className="page-container" style={{ paddingBottom: 80 }}>
      {/* Hero Section */}
      <div className="hero-section fade-up">
        <h1 className="hero-title">
          Track Every <span className="gradient-text">Mission</span> to the Stars
        </h1>
        <p className="hero-desc">
          Real-time launch data from Launch Library 2 and SpaceX.
          Save missions, write logs, never miss a launch.
        </p>

        {/* Search bar */}
        <div className="search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search launches by name, rocket, or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Stats strip */}
        {!loading && (
          <div className="stats-strip fade-in">
            <div className="stat-item">
              <Rocket size={14} />
              <span><span className="stat-num">{launches.length}</span> {tab} launches</span>
            </div>
            <div className="stat-item">
              <Globe size={14} />
              <span><span className="stat-num">2</span> data sources</span>
            </div>
            <div className="stat-item">
              <Radio size={14} />
              <span>Live countdown</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Timeline tabs */}
        <div className="tabs">
          <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Upcoming
          </button>
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            In Flight
          </button>
          <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
            Past
          </button>
        </div>

        {/* Source filter - only for upcoming/past, not active */}
        {tab !== 'active' && (
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
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="launches-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ animationDelay: `${i * 60}ms` }}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="empty-state fade-up">
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        filteredLaunches.length === 0 ? (
          <div className="empty-state fade-up">
            <div className="icon"><Rocket size={44} /></div>
            {searchQuery ? (
              <p>No launches matching "{searchQuery}"</p>
            ) : tab === 'active' ? (
              <>
                <p>No launches currently in flight.</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 380, margin: '8px auto 0' }}>
                  This tab shows launches during their active flight window. Check back during a launch for live tracking.
                </p>
              </>
            ) : (
              <p>No launches found for this filter.</p>
            )}
          </div>
        ) : (
          <div className="launches-grid">
            {filteredLaunches.map((launch, i) => (
              <div key={launch.api_id || launch.id} className="fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                <LaunchCard launch={launch} showCountdown={tab === 'upcoming'} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
