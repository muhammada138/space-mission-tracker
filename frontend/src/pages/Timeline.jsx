import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import api from '../api/axios'
import { FiClock, FiMapPin, FiCalendar, FiArrowRight } from 'react-icons/fi'

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
        
        // Remove exact duplicates by api_id
        const unique = []
        const seen = new Set()
        for (const l of all) {
            if (!seen.has(l.api_id)) {
                seen.add(l.api_id)
                unique.push(l)
            }
        }

        setLaunches(unique.filter(l => l.launch_date).sort((a, b) => new Date(a.launch_date) - new Date(b.launch_date)))
      })
      .finally(() => setLoading(false))
  }, [mode])

  // Timeline nodes compilation
  const timelineNodes = useMemo(() => {
    if (launches.length === 0) return []
    
    const nodes = []
    let lastMonth = null
    let nowInserted = false
    const nowTime = Date.now()
    let launchCount = 0

    launches.forEach((l) => {
      const d = new Date(l.launch_date)
      const t = d.getTime()
      
      // Before adding this launch, do we need to insert the "NOW" divider?
      if (!nowInserted && t > nowTime) {
          nodes.push({ type: 'now', id: 'now-marker' })
          nowInserted = true
          // Reset month marker after NOW divider for aesthetic freshness
          lastMonth = null 
      }

      // Check for month header
      const monthStr = format(d, 'MMMM yyyy')
      if (monthStr !== lastMonth) {
          nodes.push({ type: 'month', id: `month-${btoa(monthStr)}`, label: monthStr })
          lastMonth = monthStr
      }
      
      nodes.push({ 
          type: 'launch', 
          ...l, 
          // alternate logic
          side: launchCount % 2 === 0 ? 'left' : 'right' 
      })
      launchCount++
    })

    // If we finished processing all launches and all were in the past
    if (!nowInserted && launches.length > 0) {
        if (new Date(launches[launches.length - 1].launch_date).getTime() < nowTime) {
            nodes.push({ type: 'now', id: 'now-marker' })
        }
    }

    return nodes
  }, [launches])

  if (loading) return (
    <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 120 }}>
      {/* Header Area */}
      <div className="fade-up" style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Launch <span style={{ color: 'var(--accent)' }}>Timeline</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
              {launches.length} launches plotted chronologically
            </p>
          </div>
          <div className="tabs" style={{ display: 'flex', gap: 8 }}>
            <button className={`tab ${mode === 'upcoming' ? 'active' : ''}`} onClick={() => setMode('upcoming')}>Upcoming</button>
            <button className={`tab ${mode === 'all' ? 'active' : ''}`} onClick={() => setMode('all')}>Full History</button>
          </div>
        </div>
      </div>

      {launches.length === 0 ? (
        <div className="empty-state fade-up glass" style={{ padding: '60px', textAlign: 'center', borderRadius: 24 }}>
          <FiCalendar size={48} style={{ color: 'var(--border-color)', margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px' }}>No launches found</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>We couldn't track down any launches matching this criteria.</p>
        </div>
      ) : (
        <div className="vertical-timeline fade-up">
          <div className="vt-axis"></div>
          
          {timelineNodes.map((node, i) => {
            if (node.type === 'now') {
              return (
                <div key={node.id} className="vt-now-marker">
                  <div className="vt-now-line left"></div>
                  <div className="vt-now-pill glass">CURRENT TIME</div>
                  <div className="vt-now-line right"></div>
                </div>
              )
            }

            if (node.type === 'month') {
              return (
                <div key={node.id} className="vt-month-marker">
                  <span className="glass">{node.label}</span>
                </div>
              )
            }

            // Launch Node
            const statusColor = getStatusColor(node.status)
            return (
              <div key={node.api_id || i} className={`vt-item ${node.side}`} onClick={() => navigate(`/launch/${node.api_id}`)}>
                {/* Central Dot */}
                <div className="vt-dot-container">
                    <div className="vt-dot pulse-animation" style={{ 
                        borderColor: statusColor, 
                        background: `${statusColor}20`,
                        boxShadow: `0 0 12px ${statusColor}50` 
                    }}></div>
                </div>

                {/* Card Payload */}
                <div className="vt-card glass hover-card">
                  <div className="vt-card-header">
                    <span className="vt-badge" style={{ color: statusColor, background: `${statusColor}15` }}>
                      {node.status || 'TBA'}
                    </span>
                    <span className="vt-date">
                        <FiClock size={12} /> {format(new Date(node.launch_date), 'MMM d, yyyy \u2022 HH:mm z')}
                    </span>
                  </div>
                  
                  <div className="vt-card-body">
                    <h3 className="vt-title">{node.name?.split('|')[0]?.trim() || node.name}</h3>
                    {node.name?.includes('|') && (
                        <h4 className="vt-subtitle">{node.name.split('|').slice(1).join('|').trim()}</h4>
                    )}
                    
                    <div className="vt-provider">
                        <FiMapPin size={12} /> {node.launch_provider || 'Unknown Provider'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      {launches.length > 0 && (
        <div className="fade-up" style={{ marginTop: 40, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', justifyContent: 'center' }}>
          {[['Go / Success', '#34d399'], ['Hold', '#ff9f43'], ['TBD', '#00d4ff'], ['Failure', '#f87171']].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${color}`, background: `${color}30` }} />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
