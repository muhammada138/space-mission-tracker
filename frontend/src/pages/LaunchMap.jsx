import { useState, useEffect, useMemo, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Rocket, X } from 'lucide-react'
import api from '../api/axios'
import Globe from '../components/Globe'

// Known launch pad coordinates (extracted from LL2 data when available)
const KNOWN_PADS = {
  'Cape Canaveral, FL, USA': { lat: 28.3922, lng: -80.6077 },
  'Kennedy Space Center, FL, USA': { lat: 28.5721, lng: -80.6480 },
  'Vandenberg SFB, CA, USA': { lat: 34.7420, lng: -120.5724 },
  'Baikonur Cosmodrome, Republic of Kazakhstan': { lat: 45.9650, lng: 63.3050 },
  'Guiana Space Centre, French Guiana': { lat: 5.2320, lng: -52.7690 },
  'Satish Dhawan Space Centre, India': { lat: 13.7200, lng: 80.2300 },
  'Jiuquan, People\'s Republic of China': { lat: 40.9580, lng: 100.2910 },
  'Xichang Satellite Launch Center, People\'s Republic of China': { lat: 28.2463, lng: 102.0269 },
  'Wenchang Space Launch Site, People\'s Republic of China': { lat: 19.6145, lng: 110.9510 },
  'Taiyuan, People\'s Republic of China': { lat: 38.8490, lng: 111.6080 },
  'Plesetsk Cosmodrome, Russian Federation': { lat: 62.9271, lng: 40.5777 },
  'Vostochny Cosmodrome, Russian Federation': { lat: 51.8840, lng: 128.3340 },
  'Tanegashima, Japan': { lat: 30.4010, lng: 131.0010 },
  'Mahia Peninsula, New Zealand': { lat: -39.2620, lng: 177.8646 },
  'Kodiak Launch Complex, Alaska, USA': { lat: 57.4358, lng: -152.3379 },
  'Wallops Island, Virginia, USA': { lat: 37.8402, lng: -75.4881 },
  'Pacific Spaceport Complex, Alaska, USA': { lat: 57.4358, lng: -152.3379 },
  'Semnan, Iran': { lat: 35.2347, lng: 53.9210 },
  'Palmachim Airbase, Israel': { lat: 31.8840, lng: 34.6900 },
}

function findPadCoords(location) {
  if (!location) return null
  // Try exact match first
  if (KNOWN_PADS[location]) return KNOWN_PADS[location]
  // Try partial match
  const lower = location.toLowerCase()
  for (const [key, val] of Object.entries(KNOWN_PADS)) {
    if (lower.includes(key.toLowerCase().split(',')[0])) return val
  }
  return null
}

export default function LaunchMap() {
  const navigate = useNavigate()
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPad, setSelectedPad] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
    ]).then(([upRes, pastRes]) => {
      const up = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const past = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      setLaunches([...up, ...past])
    }).finally(() => setLoading(false))
  }, [])

  // Group launches by pad and find coordinates
  const pads = useMemo(() => {
    const padMap = {}
    launches.forEach(l => {
      const loc = l.pad_location || l.pad_name
      if (!loc) return
      const coords = findPadCoords(loc)
      if (!coords) return

      const key = `${coords.lat},${coords.lng}`
      if (!padMap[key]) {
        padMap[key] = {
          name: loc,
          lat: coords.lat,
          lng: coords.lng,
          launches: [],
          count: 0,
        }
      }
      padMap[key].launches.push(l)
      padMap[key].count++
    })
    return Object.values(padMap)
  }, [launches])

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Launch <span style={{ color: 'var(--accent)' }}>Globe</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          {pads.length} launch sites worldwide. Click a dot to see launches from that pad.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPad ? '1fr 360px' : '1fr', gap: 20 }}>
        {/* Globe */}
        <div className="glass fade-up" style={{ height: 520, overflow: 'hidden', position: 'relative' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <Suspense fallback={<div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}>
              <Globe pads={pads} onPadClick={setSelectedPad} />
            </Suspense>
          )}
          {/* Pad count legend */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {pads.length} pads / {launches.length} launches
          </div>
        </div>

        {/* Selected pad panel */}
        {selectedPad && (
          <div className="glass fade-up" style={{ padding: '24px', alignSelf: 'start', position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <MapPin size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Launch Site</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedPad.name}</h3>
              </div>
              <button onClick={() => setSelectedPad(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)', flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{selectedPad.count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Launches</div>
              </div>
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)', flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{selectedPad.lat.toFixed(2)}, {selectedPad.lng.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coordinates</div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              Recent Launches
            </h4>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedPad.launches
                .sort((a, b) => new Date(b.launch_date || 0) - new Date(a.launch_date || 0))
                .slice(0, 20)
                .map((l, i) => (
                  <div
                    key={l.api_id || i}
                    onClick={() => navigate(`/launch/${l.api_id}`)}
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, cursor: 'pointer', transition: 'background 0.2s', fontSize: 12 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  >
                    <p style={{ margin: '0 0 2px', fontWeight: 600, color: 'var(--text-primary)' }}>{l.name?.slice(0, 40)}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {l.launch_date ? new Date(l.launch_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
