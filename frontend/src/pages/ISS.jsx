import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom ISS marker icon
const issIcon = new L.DivIcon({
  html: `<div style="width:28px;height:28px;background:var(--accent);border-radius:50%;border:3px solid #fff;box-shadow:0 0 16px var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px">🛰</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
})

function MapUpdater({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.panTo(position, { animate: true, duration: 1 })
  }, [position, map])
  return null
}

export default function ISS() {
  const [position, setPosition] = useState(null)
  const [crew, setCrew] = useState([])
  const [track, setTrack] = useState([])
  const [speed] = useState('27,576 km/h')
  const [altitude] = useState('~408 km')

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
    fetch('http://api.open-notify.org/astros.json')
      .then(r => r.json())
      .then(data => {
        if (data.people) setCrew(data.people.filter(p => p.craft === 'ISS'))
      })
      .catch(() => {
        // CORS might block this, set sample data
        setCrew([
          { name: 'Crew data unavailable', craft: 'ISS' },
        ])
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
      <div className="glass fade-up" style={{ overflow: 'hidden', marginBottom: 24 }}>
        {position ? (
          <MapContainer
            center={position}
            zoom={3}
            style={{ height: 450, width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapUpdater position={position} />
            <Marker position={position} icon={issIcon}>
              <Popup>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  ISS Position<br />
                  Lat: {position[0].toFixed(4)}<br />
                  Lng: {position[1].toFixed(4)}
                </div>
              </Popup>
            </Marker>
            {track.length > 1 && (
              <Polyline
                positions={track}
                pathOptions={{ color: '#00d4ff', weight: 2, opacity: 0.5, dashArray: '6 4' }}
              />
            )}
          </MapContainer>
        ) : (
          <div style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      {/* Crew manifest */}
      <div className="glass fade-up" style={{ padding: '22px 26px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          Current Crew ({crew.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {crew.map((person, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                👨‍🚀
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{person.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{person.craft}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
