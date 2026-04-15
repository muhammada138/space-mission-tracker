import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react'
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
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [missionFilter, setMissionFilter] = useState('all')
  const [orbitFilter, setOrbitFilter] = useState('all')

  const setTab = (t) => {
    const routes = { upcoming: '/launches/upcoming', active: '/launches/active', past: '/launches/past', payloads: '/launches/payloads' }
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

  // Get unique mission types and orbits for filter dropdowns
  const filterOptions = useMemo(() => {
    const missions = new Set()
    const orbits = new Set()
    launches.forEach(l => {
      if (l.mission_type) missions.add(l.mission_type)
      if (l.orbit) orbits.add(l.orbit)
    })
    return {
      missions: Array.from(missions).sort(),
      orbits: Array.from(orbits).sort()
    }
  }, [launches])

  const filteredLaunches = useMemo(() => {
    let result = launches

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.rocket || '').toLowerCase().includes(q) ||
        (l.launch_provider || '').toLowerCase().includes(q) ||
        (l.mission_description || '').toLowerCase().includes(q)
      )
    }

    // 2. Mission Type Filter
    if (missionFilter !== 'all') {
      result = result.filter(l => l.mission_type === missionFilter)
    }

    // 3. Orbit Filter
    if (orbitFilter !== 'all') {
      result = result.filter(l => l.orbit === orbitFilter)
    }

    return result
  }, [launches, searchQuery, missionFilter, orbitFilter])

  const clearFilters = () => {
    setSearchQuery('')
    setMissionFilter('all')
    setOrbitFilter('all')
  }

  // Separate hero launch (first upcoming) from grid
  const heroLaunch = tab === 'upcoming' && !searchQuery && missionFilter === 'all' && orbitFilter === 'all' && filteredLaunches.length > 0 
    ? filteredLaunches.find(l => {
        const s = (l.status || '').toLowerCase()
        return !s.includes('success') && !s.includes('fail')
      }) || filteredLaunches[0] 
    : null
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
              Live launch data and orbital payload tracking
            </p>
          </div>
        </div>
      </div>

      {/* Space weather widget */}
      <div style={{ marginBottom: 32 }}>
        <SpaceWeather />
      </div>

      {/* Main Controls Section */}
      <div className="glass" style={{ padding: '12px', borderRadius: 16, marginBottom: 32, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Top row: Tab Navigation */}
          <div className="tabs" style={{ borderBottom: 'none', padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, display: 'inline-flex', alignSelf: 'flex-start' }}>
            {['upcoming', 'active', 'past', 'payloads'].map(t => (
              <button 
                key={t}
                className={`tab ${tab === t ? 'active' : ''}`} 
                onClick={() => setTab(t)}
                style={{ borderRadius: 8, padding: '8px 16px', border: 'none', margin: 0 }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1).replace('payloads', 'In Orbit')}
                {!loading && tab === t && <span className="tab-count" style={{ marginLeft: 8 }}>{launches.length}</span>}
              </button>
            ))}
          </div>

          {/* Bottom row: Search and Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: '1 1 300px', margin: 0, height: 42 }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder={`Search ${tab} missions...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: 14 }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 8, cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            <button 
              className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowFilters(!showFilters)}
              style={{ height: 42, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', fontSize: 14 }}
            >
              <SlidersHorizontal size={16} />
              Filters
              {(missionFilter !== 'all' || orbitFilter !== 'all') && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              )}
            </button>

            {tab !== 'active' && tab !== 'payloads' && (
              <div className="tabs" style={{ borderBottom: 'none', height: 42, padding: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: 8 }}>
                {['all', 'll2', 'spacex'].map(s => (
                  <button 
                    key={s}
                    className={`tab ${source === s ? 'active' : ''}`} 
                    onClick={() => setSource(s)}
                    style={{ borderRadius: 6, padding: '0 12px', fontSize: 12, height: '100%' }}
                  >
                    {s === 'all' ? 'All' : s === 'll2' ? 'LL2' : 'SpaceX'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expanded Filters Panel */}
          {showFilters && (
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mission Type</label>
                <select 
                  value={missionFilter} 
                  onChange={(e) => setMissionFilter(e.target.value)}
                  className="glass"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--glass-border)' }}
                >
                  <option value="all">All Types</option>
                  {filterOptions.missions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Orbit</label>
                <select 
                  value={orbitFilter} 
                  onChange={(e) => setOrbitFilter(e.target.value)}
                  className="glass"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--glass-border)' }}
                >
                  <option value="all">All Orbits</option>
                  {filterOptions.orbits.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button 
                  onClick={clearFilters}
                  className="btn btn-ghost"
                  style={{ height: 38, width: '100%', fontSize: 13 }}
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
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
        <div className="empty-state fade-up" style={{ padding: '80px 0' }}>
          <div className="icon" style={{ fontSize: 48, marginBottom: 20 }}>🛸</div>
          <h3 style={{ margin: '0 0 8px' }}>No matches found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Try adjusting your search or filters</p>
          <button className="btn btn-primary" onClick={clearFilters}>Reset Filters</button>
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
                <LaunchCard 
                  launch={launch} 
                  showCountdown={tab === 'upcoming'} 
                  isPayload={tab === 'payloads'}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
