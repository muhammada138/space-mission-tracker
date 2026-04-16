import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import api from '../api/axios'
import { MapPin, Info, CloudRain, Wind, Navigation } from 'lucide-react'

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom fly-to component
function ChangeView({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1.5 })
  }, [center, zoom, map])
  return null
}

export default function LaunchMap() {
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPad, setSelectedPad] = useState(null)
  const [padWeather, setPadWeather] = useState(null)
  const [mapConfig, setMapConfig] = useState({ center: [20, 0], zoom: 2 })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] }))
    ]).then(([upRes, pastRes]) => {
      const upData = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const pastData = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      setLaunches([...upData, ...pastData])
      setLoading(false)
    })
  }, [])

  const pads = useMemo(() => {
    const padMap = {}
    launches.forEach(l => {
      if (l.pad_latitude && l.pad_longitude) {
        const key = `${l.pad_latitude},${l.pad_longitude}`
        if (!padMap[key]) {
          padMap[key] = {
            id: key,
            name: l.pad_name,
            location: l.pad_location,
            lat: parseFloat(l.pad_latitude),
            lng: parseFloat(l.pad_longitude),
            launches: []
          }
        }
        padMap[key].launches.push(l)
      }
    })
    return Object.values(padMap)
  }, [launches])

  const handlePadClick = (pad) => {
    setSelectedPad(pad)
    setMapConfig({ center: [pad.lat, pad.lng], zoom: 8 })
    
    // Fetch weather for the next upcoming launch at this pad
    const nextLaunch = pad.launches
      .filter(l => new Date(l.launch_date) > new Date())
      .sort((a, b) => new Date(a.launch_date) - new Date(b.launch_date))[0]
    
    if (nextLaunch) {
      api.get(`/launches/${nextLaunch.api_id}/pad-weather/`)
        .then(res => setPadWeather(res.data))
        .catch(() => setPadWeather(null))
    } else {
      setPadWeather(null)
    }
  }

  if (loading) return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 40, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="fade-up" style={{ marginBottom: 20, flexShrink: 0 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Launch <span style={{ color: 'var(--accent)' }}>Network Map</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Live orbital infrastructure and weather telemetry for global spaceports
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
        {/* Map Sidebar */}
        <div className="glass fade-up" style={{ width: 350, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Active Spaceports</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{pads.length} locations identified</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pads.map(pad => (
              <div
                key={pad.id}
                onClick={() => handlePadClick(pad)}
                style={{
                  padding: '12px 16px',
                  background: selectedPad?.id === pad.id ? 'rgba(0, 212, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${selectedPad?.id === pad.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: selectedPad?.id === pad.id ? 'var(--accent)' : 'var(--text-primary)' }}>{pad.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pad.location}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span className="badge" style={{ fontSize: 10 }}>{pad.launches.length} Missions</span>
                  <Navigation size={12} style={{ opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Map Container */}
        <div className="glass fade-up" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
          <MapContainer 
            center={mapConfig.center} 
            zoom={mapConfig.zoom} 
            minZoom={2}
            maxZoom={12}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%', background: '#050a18' }}
            zoomControl={false}
          >
            <ChangeView center={mapConfig.center} zoom={mapConfig.zoom} />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/only_labels/{z}/{x}/{y}{r}.png"
              pane="shadowPane" // Ensure labels are on top
            />
            {pads.map(pad => (
              <Marker 
                key={pad.id} 
                position={[pad.lat, pad.lng]}
                eventHandlers={{ click: () => handlePadClick(pad) }}
              >
                <Popup className="custom-popup">
                  <div style={{ padding: 4 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{pad.name}</strong>
                    <span style={{ fontSize: 11 }}>{pad.location}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlays */}
          {selectedPad && (
            <div className="glass fade-in" style={{ position: 'absolute', bottom: 24, left: 24, right: 24, zIndex: 1000, padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <MapPin className="text-accent" size={20} />
                  <h3 style={{ margin: 0, fontSize: 18 }}>{selectedPad.name}</h3>
                </div>
                <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>{selectedPad.location}</p>
                
                <h4 style={{ margin: '0 0 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Latest Missions</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedPad.launches.slice(0, 3).map((l, i) => (
                    <div key={i} className="badge" style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)' }}>
                      {l.name}
                    </div>
                  ))}
                </div>
              </div>

              {padWeather ? (
                <div style={{ background: 'rgba(0, 212, 255, 0.05)', borderRadius: 12, padding: 20, border: '1px solid rgba(0, 212, 255, 0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Surface telemetry</span>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{padWeather.temp_c}°C</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${padWeather.overall === 'GO' ? 'badge-go' : 'badge-no-go'}`}>{padWeather.overall}</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Wind size={14} className="text-accent" /> {padWeather.wind_knots} kts
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <CloudRain size={14} className="text-accent" /> {padWeather.description}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <Info size={16} style={{ marginRight: 8 }} /> No live weather data for this location
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
