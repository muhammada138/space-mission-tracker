import { useState, useEffect, useMemo } from 'react'
import { Search, ArrowUpDown, Rocket } from 'lucide-react'
import api from '../api/axios'

export default function Rockets() {
  const [rockets, setRockets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    // Fetch all launches and extract unique rockets from them
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
    ]).then(([upRes, pastRes]) => {
      const upData = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const pastData = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      const allLaunches = [...upData, ...pastData]

      // Group by rocket name
      const rocketMap = {}
      allLaunches.forEach(l => {
        const name = l.rocket || 'Unknown'
        if (!rocketMap[name]) {
          rocketMap[name] = {
            name,
            provider: l.launch_provider || 'Unknown',
            image: l.image_url,
            launches: [],
            successCount: 0,
            failCount: 0,
          }
        }
        rocketMap[name].launches.push(l)
        const s = (l.status || '').toLowerCase()
        if (s.includes('success')) rocketMap[name].successCount++
        else if (s.includes('fail')) rocketMap[name].failCount++
        // Use the best image available
        if (l.image_url && !rocketMap[name].image) rocketMap[name].image = l.image_url
      })

      const sorted = Object.values(rocketMap).sort((a, b) => b.launches.length - a.launches.length)
      setRockets(sorted)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rockets
    const q = searchQuery.toLowerCase()
    return rockets.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q)
    )
  }, [rockets, searchQuery])

  if (loading) return (
    <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Rocket <span style={{ color: 'var(--accent)' }}>Encyclopedia</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              {rockets.length} unique rockets tracked across all providers
            </p>
          </div>
          <div className="search-bar">
            <Search size={14} className="search-icon" />
            <input placeholder="Search rockets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 24 }}>
        {/* Rocket grid */}
        <div className="launches-grid">
          {filtered.map((rocket, i) => (
            <div
              key={rocket.name}
              className={`glass rocket-card fade-up ${selected?.name === rocket.name ? 'selected' : ''}`}
              style={{
                animationDelay: `${i * 30}ms`,
                borderColor: selected?.name === rocket.name ? 'var(--accent)' : undefined,
              }}
              onClick={() => setSelected(selected?.name === rocket.name ? null : rocket)}
            >
              {rocket.image ? (
                <img src={rocket.image} alt={rocket.name} className="rocket-img" loading="lazy" />
              ) : (
                <div className="rocket-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  🚀
                </div>
              )}
              <div style={{ padding: '14px 16px 16px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{rocket.name}</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{rocket.provider}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    {rocket.launches.length} launches
                  </span>
                  {rocket.successCount > 0 && (
                    <span style={{ color: 'var(--success)' }}>
                      {Math.round((rocket.successCount / (rocket.successCount + rocket.failCount || 1)) * 100)}% success
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="glass fade-up" style={{ padding: '24px', position: 'sticky', top: 80, alignSelf: 'start' }}>
            <button
              onClick={() => setSelected(null)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
            >
              x
            </button>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>{selected.name}</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>{selected.provider}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <MiniStat label="Total Launches" value={selected.launches.length} />
              <MiniStat label="Successes" value={selected.successCount} />
              <MiniStat label="Failures" value={selected.failCount} />
              <MiniStat label="Success Rate" value={
                selected.successCount + selected.failCount > 0
                  ? `${Math.round((selected.successCount / (selected.successCount + selected.failCount)) * 100)}%`
                  : 'N/A'
              } />
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              Launch History
            </h4>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.launches
                .sort((a, b) => new Date(b.launch_date) - new Date(a.launch_date))
                .slice(0, 15)
                .map((l, i) => (
                  <a key={l.api_id || i} href={`/launch/${l.api_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.name?.slice(0, 35)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {l.launch_date ? new Date(l.launch_date).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : ''}
                    </span>
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}
