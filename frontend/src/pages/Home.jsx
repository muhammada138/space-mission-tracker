import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Users } from 'lucide-react'
import api from '../api/axios'
import LaunchCard from '../components/LaunchCard'
import HeroLaunch from '../components/HeroLaunch'
import SkeletonCard from '../components/SkeletonCard'
import SpaceWeather from '../components/SpaceWeather'

export default function Home({ tab = 'upcoming' }) {
  const navigate = useNavigate()
  const [source, setSource] = useState('all')
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const setTab = (t) => {
    const routes = { upcoming: '/launches/upcoming', active: '/launches/active', past: '/launches/past' }
    navigate(routes[t] || '/')
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    setLaunches([])
    api.get(`/launches/${tab}/`, { params: { source } })
      .then(({ data }) => setLaunches(Array.isArray(data) ? data : data.results ?? []))
      .catch(() => setError('Failed to fetch launches. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [tab, source])

  const filteredLaunches = useMemo(() => {
    if (!searchQuery.trim()) return launches
    const q = searchQuery.toLowerCase()
    return launches.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.rocket || '').toLowerCase().includes(q) ||
      (l.launch_provider || '').toLowerCase().includes(q)
    )
  }, [launches, searchQuery])

  // Separate hero launch (first upcoming) from grid
  const heroLaunch = tab === 'upcoming' && !searchQuery && filteredLaunches.length > 0 ? filteredLaunches[0] : null
  const gridLaunches = heroLaunch ? filteredLaunches.slice(1) : filteredLaunches

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      {/* Page header */}
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Mission <span style={{ color: 'var(--accent)' }}>Control</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              Live launch data from Launch Library 2 and SpaceX
            </p>
          </div>

          <div className="search-bar">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search launches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Space weather widget */}
      <div style={{ marginBottom: 24 }}>
        <SpaceWeather />
      </div>

      {/* Controls row: Tabs */}
      <div style={{ marginBottom: 24 }}>
        <div className="tabs">
          <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
            Upcoming
            {!loading && tab === 'upcoming' && <span className="tab-count">{launches.length}</span>}
          </button>
          <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
            Currently Active
          </button>
          <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
            Past
            {!loading && tab === 'past' && <span className="tab-count">{launches.length}</span>}
          </button>
        </div>

        {tab !== 'active' && (
          <div className="tabs" style={{ marginTop: 12, borderBottom: 'none' }}>
            <button className={`tab ${source === 'all' ? 'active' : ''}`} onClick={() => setSource('all')}>All Providers</button>
            <button className={`tab ${source === 'll2' ? 'active' : ''}`} onClick={() => setSource('ll2')}>Launch Library</button>
            <button className={`tab ${source === 'spacex' ? 'active' : ''}`} onClick={() => setSource('spacex')}>SpaceX API</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="launches-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <SkeletonCard />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="empty-state fade-up">
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>{error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && filteredLaunches.length === 0 && (
        <div className="empty-state fade-up">
          <div className="icon">🚀</div>
          {searchQuery ? (
            <p>No launches matching "{searchQuery}"</p>
          ) : (
            <p>No launches found for this filter.</p>
          )}
        </div>
      )}

      {!loading && !error && filteredLaunches.length > 0 && (
        <>
          {/* Hero launch banner */}
          {heroLaunch && <HeroLaunch launch={heroLaunch} />}

          {/* Launch grid */}
          <div className="launches-grid">
            {gridLaunches.map((launch, i) => (
              <div key={launch.api_id || launch.id} className="fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                <LaunchCard launch={launch} showCountdown={tab === 'upcoming'} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
