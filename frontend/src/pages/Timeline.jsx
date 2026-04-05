import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../api/axios'

function getStatusColor(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go')) return '#34d399'
  if (s.includes('hold')) return '#ff9f43'
  if (s.includes('success')) return '#34d399'
  if (s.includes('fail')) return '#f87171'
  return '#00d4ff'
}

export default function Timeline() {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('upcoming') // upcoming or all

  useEffect(() => {
    setLoading(true)
    const endpoints = mode === 'upcoming'
      ? [api.get('/launches/upcoming/', { params: { source: 'all' } })]
      : [
          api.get('/launches/upcoming/', { params: { source: 'all' } }),
          api.get('/launches/past/', { params: { source: 'all' } }),
        ]

    Promise.all(endpoints.map(p => p.catch(() => ({ data: [] }))))
      .then(responses => {
        const all = responses.flatMap(r => {
          const d = r.data
          return Array.isArray(d) ? d : d?.results ?? []
        })
        setLaunches(all.filter(l => l.launch_date).sort((a, b) => new Date(a.launch_date) - new Date(b.launch_date)))
      })
      .finally(() => setLoading(false))
  }, [mode])

  // Timeline calculations
  const timelineData = useMemo(() => {
    if (launches.length === 0) return { nodes: [], minTime: 0, maxTime: 0, totalWidth: 0 }

    const dates = launches.map(l => new Date(l.launch_date).getTime())
    const minTime = Math.min(...dates)
    const maxTime = Math.max(...dates)
    const range = maxTime - minTime || 1

    const MIN_WIDTH = Math.max(1200, launches.length * 60)

    const nodes = launches.map(l => {
      const t = new Date(l.launch_date).getTime()
      const x = ((t - minTime) / range) * (MIN_WIDTH - 100) + 50
      return { ...l, x, time: t }
    })

    return { nodes, minTime, maxTime, totalWidth: MIN_WIDTH }
  }, [launches])

  // Position of "now" marker
  const nowX = useMemo(() => {
    if (timelineData.totalWidth === 0) return 0
    const now = Date.now()
    const range = timelineData.maxTime - timelineData.minTime || 1
    return ((now - timelineData.minTime) / range) * (timelineData.totalWidth - 100) + 50
  }, [timelineData])

  // Scroll to "now" on load
  useEffect(() => {
    if (containerRef.current && nowX > 0) {
      containerRef.current.scrollLeft = nowX - containerRef.current.clientWidth / 2
    }
  }, [nowX, loading])

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
              Launch <span style={{ color: 'var(--accent)' }}>Timeline</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              {launches.length} launches plotted chronologically
            </p>
          </div>
          <div className="tabs">
            <button className={`tab ${mode === 'upcoming' ? 'active' : ''}`} onClick={() => setMode('upcoming')}>Upcoming</button>
            <button className={`tab ${mode === 'all' ? 'active' : ''}`} onClick={() => setMode('all')}>Full History</button>
          </div>
        </div>
      </div>

      {launches.length === 0 ? (
        <div className="empty-state fade-up"><p>No launches with dates found.</p></div>
      ) : (
        <div className="glass fade-up" style={{ padding: '20px 0', overflow: 'hidden' }}>
          <div className="timeline-container" ref={containerRef}>
            <div className="timeline-track" style={{ width: timelineData.totalWidth, minHeight: 160 }}>
              {/* Axis line */}
              <div className="timeline-axis" />

              {/* Now marker */}
              <div className="timeline-now" style={{ left: nowX }}>
                <div style={{
                  position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent)',
                  whiteSpace: 'nowrap', fontWeight: 700,
                }}>
                  NOW
                </div>
              </div>

              {/* Launch nodes */}
              {timelineData.nodes.map((node, i) => (
                <div
                  key={node.api_id || i}
                  className="timeline-node"
                  style={{ left: node.x }}
                  onClick={() => navigate(`/launch/${node.api_id}`)}
                >
                  <div
                    className="timeline-dot"
                    style={{
                      borderColor: getStatusColor(node.status),
                      background: `${getStatusColor(node.status)}30`,
                      boxShadow: `0 0 8px ${getStatusColor(node.status)}40`,
                    }}
                  />
                  <div className="timeline-tooltip">
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 12 }}>{node.name?.slice(0, 40)}</p>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(node.launch_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="fade-up" style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }}>
        {[['Go', '#34d399'], ['Hold', '#ff9f43'], ['TBD', '#00d4ff'], ['Failure', '#f87171']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${color}`, background: `${color}30` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
