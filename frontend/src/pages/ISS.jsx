import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import Globe from '../components/Globe'
import { Bell, BellOff, MapPin, Navigation, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Haversine distance (km) between two lat/lon points ──────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Approximate max visibility distance for ISS at ~408km alt (horizon ~2300km)
const VISIBILITY_KM = 2200
const ALERT_KM = 1200   // "approaching" threshold

// ── ISS Pass Alert Widget ────────────────────────────────────────────────────

function ISSPassAlert({ issPosition }) {
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [distance, setDistance] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | approaching | overhead | receding
  const prevPhaseRef = useRef('idle')
  const notifiedRef = useRef({ approaching: false, overhead: false })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocationError(null)
      },
      () => setLocationError('Location access denied. Enable it to track ISS passes.'),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [])

  const enableAlerts = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Browser notifications not supported')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      toast.error('Notification permission denied')
      return
    }
    requestLocation()
    setAlertsEnabled(true)
    toast.success('ISS pass alerts enabled!')
  }, [requestLocation])

  const disableAlerts = useCallback(() => {
    setAlertsEnabled(false)
    setPhase('idle')
    notifiedRef.current = { approaching: false, overhead: false }
    toast('ISS pass alerts disabled', { icon: '🔕' })
  }, [])

  // Update distance and phase whenever ISS position changes
  useEffect(() => {
    if (!userLocation || !issPosition) return

    const dist = haversineKm(userLocation.lat, userLocation.lon, issPosition[0], issPosition[1])
    setDistance(Math.round(dist))

    const newPhase = dist < 800 ? 'overhead' : dist < ALERT_KM ? 'approaching' : 'idle'
    setPhase(newPhase)

    if (!alertsEnabled) return

    // Notify when transitioning to approaching
    if (newPhase === 'approaching' && prevPhaseRef.current === 'idle' && !notifiedRef.current.approaching) {
      notifiedRef.current.approaching = true
      new Notification('ISS approaching your location!', {
        body: `The ISS is ${Math.round(dist)} km away and heading your way. Look up soon!`,
        icon: '/rocket.svg',
        tag: 'iss-approaching',
      })
      toast('ISS approaching! Look up soon 🛸', { icon: '🛸', duration: 6000 })
    }

    // Notify when overhead
    if (newPhase === 'overhead' && prevPhaseRef.current !== 'overhead' && !notifiedRef.current.overhead) {
      notifiedRef.current.overhead = true
      new Notification('ISS is overhead!', {
        body: `The ISS is only ${Math.round(dist)} km away — it may be visible now!`,
        icon: '/rocket.svg',
        tag: 'iss-overhead',
      })
      toast.success('ISS is overhead right now! 🌍', { duration: 8000 })
    }

    // Reset notification flags when ISS passes (receding and far)
    if (dist > VISIBILITY_KM && prevPhaseRef.current !== 'idle') {
      notifiedRef.current = { approaching: false, overhead: false }
    }

    prevPhaseRef.current = newPhase
  }, [issPosition, userLocation, alertsEnabled])

  const phaseColor = phase === 'overhead' ? 'var(--success)' : phase === 'approaching' ? 'var(--amber)' : 'var(--text-muted)'
  const phaseLabel = phase === 'overhead' ? 'Overhead!' : phase === 'approaching' ? 'Approaching' : 'Out of range'

  return (
    <div className="glass fade-up" style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            ISS Pass Alerts
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Get notified when the ISS passes over your location
          </p>
        </div>

        {alertsEnabled ? (
          <button className="btn btn-accent" onClick={disableAlerts} style={{ gap: 6 }}>
            <BellOff size={13} /> Alerts On
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={enableAlerts} style={{ gap: 6 }}>
            <Bell size={13} /> Enable Alerts
          </button>
        )}
      </div>

      {locationError && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-soft)', borderRadius: 8, border: '1px solid var(--danger)' }}>
          <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{locationError}</p>
        </div>
      )}

      {userLocation && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {/* Your location */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--accent)', fontSize: 12 }}>
              <MapPin size={12} /> Your Location
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {userLocation.lat.toFixed(2)}°, {userLocation.lon.toFixed(2)}°
            </p>
          </div>

          {/* Distance */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${distance !== null && distance < ALERT_KM ? phaseColor : 'var(--border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: phaseColor, fontSize: 12 }}>
              <Navigation size={12} /> Distance to ISS
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: phaseColor }}>
              {distance !== null ? `${distance.toLocaleString()} km` : '...'}
            </p>
          </div>

          {/* Status */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${phaseColor}` }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Visibility
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: phaseColor, boxShadow: `0 0 6px ${phaseColor}`, animation: phase !== 'idle' ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: phaseColor }}>{phaseLabel}</span>
            </div>
          </div>
        </div>
      )}

      {!userLocation && !locationError && (
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          Click "Enable Alerts" to share your location and track when the ISS passes overhead.
        </p>
      )}
    </div>
  )
}

// ── Main ISS Page ─────────────────────────────────────────────────────────────

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
    fetch('https://api.open-notify.org/astros.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => {
        const issCrew = (data.people || []).filter(p => p.craft === 'ISS')
        setCrew(issCrew)
      })
      .catch(() => {
        fetch('/api/iss-crew/')
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
          .then(data => setCrew(data.crew ?? []))
          .catch(() => setCrewError(true))
      })
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

      {/* Live telemetry */}
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

      {/* Pass alert widget */}
      <ISSPassAlert issPosition={position} />

      {/* 3D Globe */}
      <div className="glass fade-up" style={{ overflow: 'hidden', marginBottom: 24, padding: 0 }}>
        {position ? (
          <div style={{ height: 450, width: '100%', position: 'relative' }}>
            <button
              onClick={() => setLockOn(!lockOn)}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 10,
                background: lockOn ? 'var(--accent)' : 'rgba(5, 10, 24, 0.7)',
                color: lockOn ? '#050a18' : '#fff',
                border: `1px solid ${lockOn ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                padding: '6px 12px', borderRadius: 4, fontSize: 12,
                fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 8,
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
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Crew data temporarily unavailable.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {crew.map((person, i) => (
              <a
                key={i}
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.name)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, textDecoration: 'none', color: 'inherit', cursor: 'pointer', transition: 'background 0.2s ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                  👨‍🚀
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{person.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{person.craft}</p>
                </div>
                <div style={{ opacity: 0.4, fontSize: 12, transform: 'translateY(-2px)' }}>↗</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
