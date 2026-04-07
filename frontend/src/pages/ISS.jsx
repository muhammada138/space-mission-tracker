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
      style={{ position: 'fixed', inset: 0, background: 'rgba(5, 10, 24, 0.85)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        className="glass fade-up"
        style={{ maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto', position: 'relative', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
        >
          <X size={18} />
        </button>

        {person.profile_image ? (
          <img src={person.profile_image} alt={person.name} style={{ width: '100%', height: 280, objectFit: 'cover', objectPosition: 'top', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
        ) : (
          <div style={{ width: '100%', height: 200, background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(124,58,237,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Users size={64} />
          </div>
        )}

        <div style={{ padding: '28px 32px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{person.name}</h2>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>
                {getFlag(person.nationality)} {person.nationality || 'Unknown'} • {person.agency?.name || person.agency?.abbrev || 'Astronaut'}
              </p>
            </div>
            {person.status && (
              <span className="badge badge-go" style={{ flexShrink: 0 }}>{person.status.name || 'Active'}</span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 13 }}>
              <GlobeIcon size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Craft:</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{person.craft || 'ISS'}</span>
            </div>
            {person.flights_count != null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 13 }}>
                <Rocket size={15} style={{ color: 'var(--warning)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Flights:</span>
                <span style={{ fontWeight: 600 }}>{person.flights_count}</span>
              </div>
            )}
            {person.date_of_birth && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 13 }}>
                <Calendar size={15} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Born:</span>
                <span style={{ fontWeight: 600 }}>{person.date_of_birth}</span>
              </div>
            )}
          </div>

          {/* Biography */}
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            <Info size={15} /> Biography
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: 'var(--text-primary)' }}>
            {person.bio || 'No biography available for this astronaut.'}
          </p>
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
        setCrew(data.crew || [])
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
