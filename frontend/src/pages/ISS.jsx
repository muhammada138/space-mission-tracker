import { useState, useEffect, useRef, Suspense, useCallback, useMemo, memo } from 'react'
import Globe from '../components/Globe'
import { Bell, BellOff, MapPin, Navigation, AlertCircle, Users, Globe as GlobeIcon, Rocket, Calendar, Info, X, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { twoline2satrec, propagate, gstime, eciToGeodetic } from 'satellite.js'
import CrewModal from '../components/CrewModal'
import { getFlag } from '../utils/getFlag'

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

// ── Memoized Astronaut Card for performance ──────────────────────────────────

const AstronautCard = memo(({ person, onClick }) => (
  <div
    onClick={() => onClick(person)}
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
))

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
      setLocationError('Geolocation not supported.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocationError(null)
      },
      () => setLocationError('Location access denied.'),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [])

  const enableAlerts = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    requestLocation()
    setAlertsEnabled(true)
    toast.success(`${station.shortName} alerts enabled!`)
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

    if (alertsEnabled) {
      if (newPhase === 'approaching' && prevPhaseRef.current === 'idle' && !notifiedRef.current.approaching) {
        notifiedRef.current.approaching = true
        new Notification(`${station.shortName} approaching!`)
        toast(`${station.shortName} approaching! Look up 🛸`)
      }
      if (newPhase === 'overhead' && prevPhaseRef.current !== 'overhead' && !notifiedRef.current.overhead) {
        notifiedRef.current.overhead = true
        toast.success(`${station.shortName} is overhead right now! 🌍`)
      }
    }
    prevPhaseRef.current = newPhase
  }, [position, userLocation, alertsEnabled, station])

  const phaseColor = phase === 'overhead' ? 'var(--success)' : phase === 'approaching' ? 'var(--amber)' : 'var(--text-muted)'
  const phaseLabel = phase === 'overhead' ? 'Overhead!' : phase === 'approaching' ? 'Approaching' : 'Out of range'

  return (
    <div className="glass fade-up" style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            {station.shortName} Pass Alerts
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Track when {station.name} passes over you</p>
        </div>
        <button className={alertsEnabled ? "btn btn-accent" : "btn btn-ghost"} onClick={alertsEnabled ? disableAlerts : enableAlerts}>
          {alertsEnabled ? <BellOff size={13} /> : <Bell size={13} />}
          {alertsEnabled ? ' Alerts On' : ' Enable Alerts'}
        </button>
      </div>

      {userLocation && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent)', fontSize: 12, marginBottom: 4 }}><MapPin size={12} /> Distance</div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: phaseColor }}>{distance !== null ? `${distance.toLocaleString()} km` : '...'}</p>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${phaseColor}` }}>
            <div style={{ color: phaseColor, fontSize: 12, marginBottom: 4 }}><Navigation size={12} /> Status</div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: phaseColor }}>{phaseLabel}</p>
          </div>
        </div>
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

  // Orbital tracking tick (1s)
  useEffect(() => {
    let active = true
    const satrecs = {}
    let tickCount = 0

    STATIONS.forEach(s => {
      fetch(`https://tle.ivanstanojevic.me/api/tle/${s.noradId}`)
        .then(r => r.json())
        .then(data => {
          if (active) satrecs[s.id] = twoline2satrec(data.line1, data.line2)
        })
    })

    const interval = setInterval(() => {
      if (!active) return
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
                newTrack = [...oldTrack, [lat, lng]].slice(-100)
              }
              next[s.id] = { lat, lng, alt, vel, track: newTrack }
            }
          } catch (e) { }
        })
        return next
      })
    }, 1000)

    return () => { active = false; clearInterval(interval) }
  }, [])

  // Fetch crew data with robust fallback
  const fetchCrew = useCallback((force = false) => {
    setCrewLoading(true)
    setCrewError(false)
    const url = force ? '/api/iss-crew/?force_refresh=true' : '/api/iss-crew/'
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then(data => {
        const filtered = (data.crew || []).filter(p => !p.name.toLowerCase().includes('starman'))
        if (filtered.length > 0) {
          setCrew(filtered)
          if (force) toast.success('Crew data refreshed')
        } else {
          throw new Error('Empty crew')
        }
      })
      .catch(() => {
        if (force) {
          toast.error('Failed to force refresh crew')
          setCrewLoading(false)
          return
        }
        // Direct fallback to LL2
        fetch('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&mode=detailed&limit=30')
          .then(r => r.json())
          .then(data => {
            const results = (data.results || []).map(a => ({
              name: a.name || '', nationality: a.nationality || '', bio: a.bio || '',
              profile_image: a.profile_image || '', date_of_birth: a.date_of_birth || '',
              flights_count: a.flights_count || 0,
              agency: { name: (a.agency || {}).name || '', abbrev: (a.agency || {}).abbrev || '' },
              craft: (a.last_flight || '').toLowerCase().includes('shenzhou') ? 'Tiangong' : 'ISS',
              wiki_url: a.wiki || '', status: { name: 'Active' },
            })).filter(p => !p.name.toLowerCase().includes('starman'))
            if (results.length > 0) setCrew(results)
            else setCrewError(true)
          })
          .catch(() => setCrewError(true))
      })
      .finally(() => setCrewLoading(false))
  }, [])

  useEffect(() => { fetchCrew() }, [fetchCrew])

  const groupedCrew = useMemo(() => {
    const groups = {}
    crew.forEach(p => {
      const craft = p.craft || 'ISS'
      if (!groups[craft]) groups[craft] = []
      groups[craft].push(p)
    })
    return groups
  }, [crew])

  const mapStations = useMemo(() => STATIONS.map(s => ({
    id: s.id,
    name: s.shortName,
    color: s.color,
    lat: stationsData[s.id]?.lat,
    lng: stationsData[s.id]?.lng,
    track: stationsData[s.id]?.track
  })), [stationsData])

  const lockTarget = lockOn && activeData ? [activeData.lat, activeData.lng] : null

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }}>
          Space Stations <span style={{ color: 'var(--accent)' }}>Live Tracker</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Real-time orbital tracking & manifestations</p>
      </div>

      <div className="tabs fade-up" style={{ marginBottom: 20, display: 'inline-flex', gap: 10 }}>
        {STATIONS.map(s => (
          <button key={s.id} className={`tab ${activeStationId === s.id ? 'active' : ''}`} onClick={() => { setActiveStationId(s.id); setLockOn(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 16 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color }} />
            {s.shortName}
          </button>
        ))}
      </div>

      <div className="iss-info-panel fade-up">
        {['Latitude', 'Longitude', 'Speed', 'Altitude'].map((label, i) => {
          const val = label === 'Latitude' ? activeData?.lat?.toFixed(4) : label === 'Longitude' ? activeData?.lng?.toFixed(4) : label === 'Speed' ? `${Math.round(activeData?.vel || 0).toLocaleString()} km/h` : `~${Math.round(activeData?.alt || 0)} km`;
          return (
            <div key={label} className="glass stat-card">
              <div className="stat-card-value" style={{ fontSize: 18, color: activeStation.color }}>{activeData ? val : '...'}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          )
        })}
      </div>

      <PassAlertWidget station={activeStation} position={activeData ? [activeData.lat, activeData.lng] : null} />

      <div className="glass fade-up" style={{ overflow: 'hidden', marginBottom: 24, padding: 0 }}>
        {Object.keys(stationsData).length > 0 ? (
          <div style={{ height: 450, width: '100%', position: 'relative' }}>
            <button
              onClick={() => setLockOn(!lockOn)}
              style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, background: lockOn ? activeStation.color : 'rgba(5, 10, 24, 0.7)', color: lockOn ? '#050a18' : '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}
            >
              {lockOn ? 'UNLOCK CAMERA' : `LOCK ON ${activeStation.shortName.toUpperCase()}`}
            </button>
            <Suspense fallback={<div className="spinner" />}>
              <Globe stations={mapStations} spin={!lockOn} lockTarget={lockTarget} />
            </Suspense>
          </div>
        ) : <div style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}
      </div>

      <div className="glass fade-up" style={{ padding: '22px 26px' }}>
        {crewLoading ? <div className="spinner" /> : crewError ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>Crew data temporarily unavailable</p>
            <button className="btn btn-ghost" onClick={fetchCrew}>Retry</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>Current Personnel</h3>
              <button 
                className="btn btn-ghost" 
                onClick={() => fetchCrew(true)}
                disabled={crewLoading}
                style={{ padding: '6px 12px', fontSize: 12, gap: 6 }}
              >
                <RotateCcw size={12} className={crewLoading ? 'spin' : ''} />
                Refresh
              </button>
            </div>
            {Object.entries(groupedCrew).map(([craft, members]) => (
              <div key={craft} style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                  {craft} Crew ({members.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {members.map((person, i) => (
                    <AstronautCard key={person.name} person={person} onClick={setSelectedPerson} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPerson && <CrewModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  )
}
