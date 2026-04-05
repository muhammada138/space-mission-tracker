import { useState, useEffect, Suspense } from 'react'
import Globe from '../components/Globe'

export default function ISS() {
  const [position, setPosition] = useState(null)
  const [crew, setCrew] = useState([])
  const [crewError, setCrewError] = useState(false)
  const [track, setTrack] = useState([])
  const [speed] = useState('27,576 km/h')
  const [altitude] = useState('~408 km')
  const [lockOn, setLockOn] = useState(false)

  useEffect(() => {
    const fetchPos = () => {
      fetch('https://api.wheretheiss.at/v1/satellites/25544')
        .then(r => r.json())
        .then(data => {
          const lat = parseFloat(data.latitude)
          const lng = parseFloat(data.longitude)
          if (!isNaN(lat) && !isNaN(lng)) {
             setPosition([lat, lng])
             setTrack(prev => {
               const next = [...prev, [lat, lng]]
               return next.length > 100 ? next.slice(-100) : next
             })
          }
        })
        .catch(() => {})
    }

    fetchPos()
    const id = setInterval(fetchPos, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // open-notify only serves HTTP; on HTTPS (production) this is blocked as mixed
    // content — the catch shows a proper error state instead of a fake crew entry
    fetch('http://api.open-notify.org/astros.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => {
        if (data.people) setCrew(data.people.filter(p => p.craft === 'ISS'))
      })
      .catch(() => setCrewError(true))
  }, [])

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          ISS <span style={{ color: 'var(--accent)' }}>Live Tracker</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Real-time position of the International Space Station
        </p>
      </div>

      {/* Info panel */}
      <div className="iss-info-panel fade-up">
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              {position ? `${position[0].toFixed(4)}` : '...'}
            </div>
            <div className="stat-card-label">Latitude</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: 'var(--accent)' }}>
              {position ? `${position[1].toFixed(4)}` : '...'}
            </div>
            <div className="stat-card-label">Longitude</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: 'var(--accent)' }}>{speed}</div>
            <div className="stat-card-label">Speed</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: 'var(--accent)' }}>{altitude}</div>
            <div className="stat-card-label">Altitude</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="glass fade-up" style={{ overflow: 'hidden', marginBottom: 24, padding: 0 }}>
        {position ? (
          <div style={{ height: 450, width: '100%', position: 'relative' }}>
            <button 
              onClick={() => setLockOn(!lockOn)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 10,
                background: lockOn ? 'var(--accent)' : 'rgba(5, 10, 24, 0.7)',
                color: lockOn ? '#050a18' : '#fff',
                border: `1px solid ${lockOn ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: lockOn ? '#050a18' : 'var(--accent)', boxShadow: `0 0 8px ${lockOn ? '#050a18' : 'var(--accent)'}` }} />
              {lockOn ? 'UNLOCK CAMERA' : 'LOCK ON ISS'}
            </button>

            <Suspense fallback={
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            }>
              <Globe issPosition={position} issTrack={track} spin={!lockOn} lockOnIss={lockOn} />
            </Suspense>
            {/* Overlay hint */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', pointerEvents: 'none', background: 'rgba(5, 10, 24, 0.7)', padding: '4px 8px', borderRadius: 4 }}>
              Interactive 3D View (Scroll to zoom)
            </div>
          </div>
        ) : (
          <div style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      {/* Crew manifest */}
      <div className="glass fade-up" style={{ padding: '22px 26px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          Current Crew {!crewError && `(${crew.length})`}
        </h3>
        {crewError ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Crew data unavailable — the open-notify API is HTTP-only and is blocked on secure connections.
          </p>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {crew.map((person, i) => (
            <a 
              key={i} 
              href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.name)}`}
              target="_blank"
              rel="noreferrer"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                padding: '8px 12px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: 8,
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                👨‍🚀
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{person.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{person.craft}</p>
              </div>
              <div style={{ opacity: 0.4, fontSize: 12, transform: 'translateY(-2px)' }}>
                ↗
              </div>
            </a>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
