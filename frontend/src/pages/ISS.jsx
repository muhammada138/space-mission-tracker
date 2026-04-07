import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react'
import Globe from '../components/Globe'
import { Bell, BellOff, MapPin, Navigation, AlertCircle, Users, Globe as GlobeIcon, Rocket, Calendar, Info, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js'

// ── Flag emoji mapper ─────────────────────────────────────────────────────────

function getFlag(nationality) {
  if (!nationality) return '🌍'
  const n = nationality.toLowerCase()
  if (n.includes('american')) return '🇺🇸'
  if (n.includes('russian')) return '🇷🇺'
  if (n.includes('chinese')) return '🇨🇳'
  if (n.includes('japanese')) return '🇯🇵'
  if (n.includes('canadian')) return '🇨🇦'
  if (n.includes('italian')) return '🇮🇹'
  if (n.includes('french')) return '🇫🇷'
  if (n.includes('german')) return '🇩🇪'
  if (n.includes('british') || n.includes('uk')) return '🇬🇧'
  if (n.includes('dutch')) return '🇳🇱'
  if (n.includes('swedish')) return '🇸🇪'
  if (n.includes('emirati') || n.includes('uae')) return '🇦🇪'
  if (n.includes('saudi')) return '🇸🇦'
  if (n.includes('indian')) return '🇮🇳'
  if (n.includes('belgian')) return '🇧🇪'
  if (n.includes('danish')) return '🇩🇰'
  if (n.includes('korean')) return '🇰🇷'
  if (n.includes('brazilian')) return '🇧🇷'
  if (n.includes('australian')) return '🇦🇺'
  if (n.includes('belarusian')) return '🇧🇾'
  return '🌍'
}

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

const VISIBILITY_KM = 2200
const ALERT_KM = 1200

const STATIONS = [
  { id: 'iss', name: 'International Space Station', shortName: 'ISS', noradId: 25544, color: '#00d4ff' },
  { id: 'tiangong', name: 'Tiangong Space Station', shortName: 'Tiangong', noradId: 48274, color: '#f87171' }
]

// ── Astronaut Mission File Modal ─────────────────────────────────────────────

function CrewModal({ person, onClose }) {
  if (!person) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(5, 10, 24, 0.9)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        className="glass fade-up"
        style={{ maxWidth: 850, width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(4px)' }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', width: '100%' }} className="crew-modal-grid">
          {/* Main Content Area */}
          <div style={{ padding: '40px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Astronaut Profile</span>
                {person.status && (
                  <span className="badge badge-go" style={{ padding: '2px 8px', fontSize: 10 }}>{person.status.name || 'Active'}</span>
                )}
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 42, fontWeight: 850, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{person.name}</h2>
              <p style={{ margin: 0, fontSize: 18, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {person.agency?.name || 'Independent Astronaut'}
              </p>
            </div>

            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Info size={16} /> Biography
              </h3>
              <div 
                style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'Inter, system-ui, sans-serif' }}
              >
                {person.bio || 'No detailed biography available.'}
              </div>
            </div>

            {person.wiki_url && (
              <a 
                href={person.wiki_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
              >
                <GlobeIcon size={16} /> 
                View on Wikipedia
              </a>
            )}
          </div>

          {/* Sidebar / Infobox */}
          <div style={{ background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column' }}>
            {person.profile_image ? (
              <div style={{ width: '100%', height: 300, position: 'relative' }}>
                <img 
                  src={person.profile_image} 
                  alt={person.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} 
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(5,10,24,0.8), transparent)' }}></div>
              </div>
            ) : (
              <div style={{ width: '100%', height: 300, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                <Users size={64} />
              </div>
            )}

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>Details</h4>
                
                {[
                  { label: 'Nationality', value: person.nationality, icon: getFlag(person.nationality) },
                  { label: 'Agency', value: person.agency?.abbrev || person.agency?.name },
                  { label: 'Craft', value: person.craft, icon: '🚀' },
                  { label: 'Born', value: person.date_of_birth, icon: <Calendar size={14} /> },
                  { label: 'Flights', value: person.flights_count, icon: <Rocket size={14} /> },
                ].map((item, idx) => item.value && (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {typeof item.icon === 'string' ? item.icon : item.icon} {item.label}
                    </span>
                    <span style={{ fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                Source: Wikipedia & Launch Library 2
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pass Alert Widget ────────────────────────────────────────────────────────

function PassAlertWidget({ station, position }) {
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const [distance, setDistance] = useState(null)
  const [phase, setPhase] = useState('idle')
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
      () => setLocationError('Location access denied. Enable it to track passes.'),
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
    toast.success(`${station.shortName} pass alerts enabled!`)
  }, [requestLocation, station.shortName])

  const disableAlerts = useCallback(() => {
    setAlertsEnabled(false)
    setPhase('idle')
    notifiedRef.current = { approaching: false, overhead: false }
    toast(`${station.shortName} alerts disabled`, { icon: '🔕' })
  }, [station.shortName])

  useEffect(() => {
    if (!userLocation || !position) return

    const dist = haversineKm(userLocation.lat, userLocation.lon, position[0], position[1])
    setDistance(Math.round(dist))

    const newPhase = dist < 800 ? 'overhead' : dist < ALERT_KM ? 'approaching' : 'idle'
    setPhase(newPhase)

    if (!alertsEnabled) return

    if (newPhase === 'approaching' && prevPhaseRef.current === 'idle' && !notifiedRef.current.approaching) {
      notifiedRef.current.approaching = true
      new Notification(`${station.shortName} approaching your location!`, {
        body: `The ${station.shortName} is ${Math.round(dist)} km away and heading your way. Look up soon!`,
        icon: '/rocket.svg',
        tag: `${station.id}-approaching`,
      })
      toast(`${station.shortName} approaching! Look up soon 🛸`, { icon: '🛸', duration: 6000 })
    }

    if (newPhase === 'overhead' && prevPhaseRef.current !== 'overhead' && !notifiedRef.current.overhead) {
      notifiedRef.current.overhead = true
      new Notification(`${station.shortName} is overhead!`, {
        body: `The ${station.shortName} is only ${Math.round(dist)} km away — it may be visible now!`,
        icon: '/rocket.svg',
        tag: `${station.id}-overhead`,
      })
      toast.success(`${station.shortName} is overhead right now! 🌍`, { duration: 8000 })
    }

    if (dist > VISIBILITY_KM && prevPhaseRef.current !== 'idle') {
      notifiedRef.current = { approaching: false, overhead: false }
    }

    prevPhaseRef.current = newPhase
  }, [position, userLocation, alertsEnabled, station])

  const phaseColor = phase === 'overhead' ? 'var(--success)' : phase === 'approaching' ? 'var(--amber)' : 'var(--text-muted)'
  const phaseLabel = phase === 'overhead' ? 'Overhead!' : phase === 'approaching' ? 'Approaching' : 'Out of range'

  return (
    <div className="glass fade-up" style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            {station.shortName} Pass Alerts
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Get notified when {station.name} passes over your location
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
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--accent)', fontSize: 12 }}>
              <MapPin size={12} /> Your Location
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
              {userLocation.lat.toFixed(2)}°, {userLocation.lon.toFixed(2)}°
            </p>
          </div>

          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${distance !== null && distance < ALERT_KM ? phaseColor : 'var(--border)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: phaseColor, fontSize: 12 }}>
              <Navigation size={12} /> Distance
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: phaseColor }}>
              {distance !== null ? `${distance.toLocaleString()} km` : '...'}
            </p>
          </div>

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
          Click "Enable Alerts" to share your location and track when it passes overhead.
        </p>
      )}
    </div>
  )
}

// ── Main ISS Page ─────────────────────────────────────────────────────────────

export default function ISS() {
  const [stationsData, setStationsData] = useState({})
  const [activeStationId, setActiveStationId] = useState('iss')
  const [crew, setCrew] = useState([])
  const [crewLoading, setCrewLoading] = useState(true)
  const [crewError, setCrewError] = useState(false)
  const [lockOn, setLockOn] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)

  const activeStation = STATIONS.find(s => s.id === activeStationId)
  const activeData = stationsData[activeStationId]

  // Orbital tracking via TLE propagation
  useEffect(() => {
    let active = true
    const satrecs = {}
    let tickCount = 0

    Promise.all(STATIONS.map(s =>
      fetch(`https://tle.ivanstanojevic.me/api/tle/${s.noradId}`)
        .then(r => r.json())
        .then(data => {
          satrecs[s.id] = twoline2satrec(data.line1, data.line2)
        })
        .catch(e => console.error('Failed TLE for', s.name, e))
    )).then(() => {
      if (!active) return

      const interval = setInterval(() => {
        tickCount++
        const now = new Date()
        const gmst = gstime(now)

        setStationsData(prev => {
          const next = { ...prev }
          STATIONS.forEach(s => {
            const satrec = satrecs[s.id]
            if (!satrec) return

            try {
              const pv = propagate(satrec, now)
              if (pv.position && typeof pv.position.x === 'number') {
                const geo = eciToGeodetic(pv.position, gmst)
                const lat = geo.latitude * 180 / Math.PI
                const lng = geo.longitude * 180 / Math.PI
                const alt = geo.height
                const vel = Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2) * 3600

                const oldTrack = prev[s.id]?.track || []
                let newTrack = oldTrack

                if (tickCount % 5 === 0) {
                  newTrack = [...oldTrack, [lat, lng]]
                  if (newTrack.length > 100) newTrack.shift()
                }

                next[s.id] = { lat, lng, alt, vel, track: newTrack }
              }
            } catch (e) { }
          })
          return next
        })
      }, 1000)

      return () => clearInterval(interval)
    })

    return () => { active = false }
  }, [])

  // Fetch crew from backend (cached LL2 + Wikipedia enrichment)
  useEffect(() => {
    setCrewLoading(true)
    fetch('/api/iss-crew/')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(data => {
        const filteredCrew = (data.crew || []).filter(p => !p.name.toLowerCase().includes('starman'))
        setCrew(filteredCrew)
        setCrewError(false)
      })
      .catch(() => {
        setCrewError(true)
      })
      .finally(() => setCrewLoading(false))
  }, [])

  // Group crew by craft
  const groupedCrew = useMemo(() => {
    const groups = {}
    crew.forEach(p => {
      const craft = p.craft || 'ISS'
      if (!groups[craft]) groups[craft] = []
      groups[craft].push(p)
    })
    return groups
  }, [crew])

  const lockTarget = lockOn && activeData ? [activeData.lat, activeData.lng] : null
  const mapStations = STATIONS.map(s => ({
    id: s.id,
    name: s.shortName,
    color: s.color,
    lat: stationsData[s.id]?.lat,
    lng: stationsData[s.id]?.lng,
    track: stationsData[s.id]?.track
  }))

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Space Stations <span style={{ color: 'var(--accent)' }}>Live Tracker</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Real-time orbital tracking & crew manifests
        </p>
      </div>

      {/* Station Selector Tabs */}
      <div className="tabs fade-up" style={{ marginBottom: 20, display: 'inline-flex' }}>
        {STATIONS.map(s => (
          <button
            key={s.id}
            className={`tab ${activeStationId === s.id ? 'active' : ''}`}
            onClick={() => { setActiveStationId(s.id); setLockOn(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: activeStationId === s.id ? `0 0 8px ${s.color}` : 'none' }} />
            {s.shortName}
          </button>
        ))}
      </div>

      {/* Live telemetry */}
      <div className="iss-info-panel fade-up">
        <div className="glass stat-card" style={{ gridColumn: '1 / -1', padding: '12px 20px', background: `color-mix(in srgb, ${activeStation.color} 10%, transparent)` }}>
          <h3 style={{ margin: 0, fontSize: 14, color: activeStation.color }}>{activeStation.name} Telemetry</h3>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: activeStation.color }}>
              {activeData?.lat ? activeData.lat.toFixed(4) : '...'}
            </div>
            <div className="stat-card-label">Latitude</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: activeStation.color }}>
              {activeData?.lng ? activeData.lng.toFixed(4) : '...'}
            </div>
            <div className="stat-card-label">Longitude</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: activeStation.color }}>
              {activeData?.vel ? `${Math.round(activeData.vel).toLocaleString()} km/h` : '...'}
            </div>
            <div className="stat-card-label">Speed</div>
          </div>
        </div>
        <div className="glass stat-card">
          <div>
            <div className="stat-card-value" style={{ fontSize: 18, color: activeStation.color }}>
              {activeData?.alt ? `~${Math.round(activeData.alt)} km` : '...'}
            </div>
            <div className="stat-card-label">Altitude</div>
          </div>
        </div>
      </div>

      {/* Pass alert widget */}
      <PassAlertWidget station={activeStation} position={activeData ? [activeData.lat, activeData.lng] : null} />

      {/* 3D Globe */}
      <div className="glass fade-up" style={{ overflow: 'hidden', marginBottom: 24, padding: 0 }}>
        {Object.keys(stationsData).length > 0 ? (
          <div style={{ height: 450, width: '100%', position: 'relative' }}>
            <button
              onClick={() => setLockOn(!lockOn)}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 10,
                background: lockOn ? activeStation.color : 'rgba(5, 10, 24, 0.7)',
                color: lockOn ? '#050a18' : '#fff',
                border: `1px solid ${lockOn ? activeStation.color : 'rgba(255,255,255,0.1)'}`,
                padding: '6px 12px', borderRadius: 4, fontSize: 12,
                fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: lockOn ? '#050a18' : activeStation.color, boxShadow: `0 0 8px ${lockOn ? '#050a18' : activeStation.color}` }} />
              {lockOn ? 'UNLOCK CAMERA' : `LOCK ON ${activeStation.shortName.toUpperCase()}`}
            </button>

            <Suspense fallback={
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            }>
              <Globe stations={mapStations} spin={!lockOn} lockTarget={lockTarget} />
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

      {/* Crew manifest — in-page bio cards */}
      <div className="glass fade-up" style={{ padding: '22px 26px' }}>
        {crewLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" />
          </div>
        ) : crewError ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Crew data temporarily unavailable.</p>
        ) : (
          <div>
            {Object.entries(groupedCrew).map(([craft, members]) => (
              <div key={craft} style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                  {craft} Crew ({members.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {members.map((person, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedPerson(person)}
                      className="hover-card"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                        borderRadius: 8, border: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      {person.profile_image ? (
                        <img
                          src={person.profile_image}
                          alt={person.name}
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                          👨‍🚀
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                          {getFlag(person.nationality)} {person.agency?.abbrev || 'Astronaut'}
                        </p>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                        BIO →
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-page astronaut bio modal */}
      {selectedPerson && (
        <CrewModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  )
}
