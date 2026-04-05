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
    if (launches.length === 0) return { nodes: [], totalWidth: 0 }

    // Constants for scaling
    const MAX_SPACING = 250; // Cap for massive multi-year gaps
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const PIXELS_PER_DAY = 15; // Natural spacing scalar

    let currentX = 60; // Starting indent
    const nodes = launches.map((l, i) => {
      const t = new Date(l.launch_date).getTime()
      let yOffset = 0;

      if (i > 0) {
        const prevT = new Date(launches[i-1].launch_date).getTime()
        const diffDays = Math.max(0, t - prevT) / MS_PER_DAY;
        
        // Base organic spacing
        let spacing = diffDays * PIXELS_PER_DAY;
        
        // If clustered densely (e.g., same day or consecutive days), stagger vertically
        if (spacing < 14) {
          // Alternating up/down pattern for tight swarms
          yOffset = (i % 2 === 0) ? -14 : 14;
          // Enforce tiny horizontal jitter so identical timestamps don't hide each other entirely
          spacing = Math.max(6, spacing);
        }

        spacing = Math.min(MAX_SPACING, spacing);
        currentX += spacing;
      }
      
      return { ...l, x: currentX, yOffset, time: t }
    })

    const spanDays = nodes.length > 0
      ? (nodes[nodes.length - 1].time - nodes[0].time) / MS_PER_DAY
      : 0
    const useYearOnly = spanDays > 365

    const dateMarkers = []
    let lastMarkerKey = null
    nodes.forEach(node => {
      const d = new Date(node.launch_date)
      const key = useYearOnly ? `${d.getFullYear()}` : `${d.getFullYear()}-${d.getMonth()}`
      if (key !== lastMarkerKey) {
        dateMarkers.push({ label: useYearOnly ? `${d.getFullYear()}` : format(d, 'MMM yyyy'), x: node.x })
        lastMarkerKey = key
      }
    })

    return { nodes, totalWidth: currentX + 100, dateMarkers }
  }, [launches])

  // Position of "now" marker using interpolation between nodes
  const nowX = useMemo(() => {
    if (timelineData.nodes.length === 0) return 0
    const now = Date.now()
    const { nodes } = timelineData
    
    // If before first launch
    if (now <= nodes[0].time) return nodes[0].x - 50 
    // If after last launch
    if (now >= nodes[nodes.length - 1].time) return nodes[nodes.length - 1].x + 50
    
    // Interpolate between the bounding launches
    for (let i = 0; i < nodes.length - 1; i++) {
        if (now >= nodes[i].time && now <= nodes[i+1].time) {
            const timeRange = nodes[i+1].time - nodes[i].time
            if (timeRange === 0) return nodes[i].x
            const fraction = (now - nodes[i].time) / timeRange
            return nodes[i].x + fraction * (nodes[i+1].x - nodes[i].x)
        }
    }
    return 0
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
        <div className="glass fade-up" style={{ padding: '20px 0', overflow: 'visible' }}>
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

              {/* Date markers below axis */}
              {timelineData.dateMarkers?.map(({ label, x }) => (
                <div
                  key={label}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: 'calc(50% + 18px)',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  {label}
                </div>
              ))}

              {/* Launch nodes */}
              {timelineData.nodes.map((node, i) => (
                <div
                  key={node.api_id || i}
                  className="timeline-node"
                  style={{ left: node.x, top: `calc(50% + ${node.yOffset || 0}px)` }}
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
