import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { Search, Maximize2, Minimize2 } from 'lucide-react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import api from '../api/axios'

// ── 3D Rocket Comparison Data ───────────────────────────────────────────────

const COMPARISON_ROCKETS = [
  { name: 'Saturn V',    height: 110.6, diameter: 10.1, color: '#d4d4d4', payload: '130,000 kg (LEO)', firstFlight: 1967, manufacturer: 'Boeing/NASA' },
  { name: 'Starship',    height: 121,   diameter: 9.0,  color: '#94a3b8', payload: '100,000+ kg (LEO)', firstFlight: 2023, manufacturer: 'SpaceX' },
  { name: 'SLS Block 1', height: 98,    diameter: 8.4,  color: '#c7d2fe', payload: '95,000 kg (LEO)', firstFlight: 2022, manufacturer: 'Boeing/NASA' },
  { name: 'New Glenn',   height: 98,    diameter: 7.0,  color: '#93c5fd', payload: '45,000 kg (LEO)', firstFlight: 2025, manufacturer: 'Blue Origin' },
  { name: 'Falcon Heavy',height: 70,    diameter: 12.2, color: '#f8fafc', payload: '63,800 kg (LEO)', firstFlight: 2018, manufacturer: 'SpaceX' },
  { name: 'Ariane 6',   height: 63,    diameter: 5.4,  color: '#3b82f6', payload: '21,650 kg (LEO)', firstFlight: 2024, manufacturer: 'ArianeGroup' },
  { name: 'Vulcan',      height: 61.6,  diameter: 5.4,  color: '#6366f1', payload: '27,200 kg (LEO)', firstFlight: 2024, manufacturer: 'ULA' },
  { name: 'Falcon 9',   height: 70,    diameter: 3.7,  color: '#e2e8f0', payload: '22,800 kg (LEO)', firstFlight: 2010, manufacturer: 'SpaceX' },
]

const SCALE = 0.04   // 1 unit ≈ 25 m

function RocketMesh({ rocket, xPos, maxHeight, selected, onClick }) {
  const meshRef = useRef()
  const h = rocket.height * SCALE
  const r = (rocket.diameter / 2) * SCALE
  const noseConeH = r * 3.5
  const bodyH = h - noseConeH

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const target = selected ? 1.06 : 1
    meshRef.current.scale.x += (target - meshRef.current.scale.x) * delta * 8
    meshRef.current.scale.z += (target - meshRef.current.scale.z) * delta * 8
  })

  return (
    <group ref={meshRef} position={[xPos, 0, 0]} onClick={onClick}>
      {/* Body cylinder */}
      <mesh position={[0, bodyH / 2, 0]}>
        <cylinderGeometry args={[r, r * 1.05, bodyH, 20]} />
        <meshStandardMaterial color={rocket.color} metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Nose cone */}
      <mesh position={[0, bodyH + noseConeH / 2, 0]}>
        <coneGeometry args={[r, noseConeH, 20]} />
        <meshStandardMaterial color={rocket.color} metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Engine bell cluster at base */}
      {[-r * 0.3, r * 0.3].map((ox, i) => (
        <mesh key={i} position={[ox, -0.03, 0]}>
          <cylinderGeometry args={[r * 0.22, r * 0.32, 0.14, 10]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Height label */}
      <Text
        position={[0, h + 0.12, 0]}
        fontSize={0.11}
        color={selected ? rocket.color : '#94a3b8'}
        anchorX="center"
        anchorY="bottom"
      >
        {rocket.height}m
      </Text>

      {/* Name label at base */}
      <Text
        position={[0, -0.22, 0]}
        fontSize={0.085}
        color={selected ? rocket.color : '#64748b'}
        anchorX="center"
        anchorY="top"
        maxWidth={0.8}
      >
        {rocket.name}
      </Text>
    </group>
  )
}

function Scene({ rockets, selected, onSelect }) {
  const spread = 1.1
  const total = rockets.length
  const startX = -((total - 1) * spread) / 2
  const maxH = Math.max(...rockets.map(r => r.height)) * SCALE

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} color="#7c3aed" />

      {/* Launch pad ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[total * spread + 2, 3]} />
        <meshStandardMaterial color="#0a1128" metalness={0.2} roughness={0.9} />
      </mesh>

      {/* Grid lines on ground */}
      {Array.from({ length: total + 1 }, (_, i) => (
        <mesh key={i} position={[startX + i * spread - spread / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.01, 3]} />
          <meshStandardMaterial color="#1e3a5f" />
        </mesh>
      ))}

      {rockets.map((r, i) => (
        <RocketMesh
          key={r.name}
          rocket={r}
          xPos={startX + i * spread}
          maxHeight={maxH}
          selected={selected === r.name}
          onClick={() => onSelect(selected === r.name ? null : r.name)}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={8}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  )
}

function RocketCompare() {
  const [selected3d, setSelected3d] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const selectedRocket = COMPARISON_ROCKETS.find(r => r.name === selected3d)

  return (
    <div className="glass" style={{ marginBottom: 32, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
            3D Size <span style={{ color: 'var(--accent)' }}>Comparison</span>
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            Drag to rotate · Scroll to zoom · Click a rocket to inspect
          </p>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 11 }}
          onClick={() => setIsFullscreen(p => !p)}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {isFullscreen ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRocket ? '1fr 240px' : '1fr', transition: 'grid-template-columns 0.3s' }}>
        {/* Canvas */}
        <div style={{ height: isFullscreen ? 600 : 400 }}>
          <Canvas
            camera={{ position: [0, 2, 5], fov: 50 }}
            style={{ background: 'transparent' }}
            shadows
          >
            <Suspense fallback={null}>
              <Scene
                rockets={COMPARISON_ROCKETS}
                selected={selected3d}
                onSelect={setSelected3d}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Spec panel for selected rocket */}
        {selectedRocket && (
          <div style={{ padding: '20px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 800 }}>{selectedRocket.name}</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{selectedRocket.manufacturer}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SpecRow label="Height" value={`${selectedRocket.height} m`} />
              <SpecRow label="Diameter" value={`${selectedRocket.diameter} m`} />
              <SpecRow label="Payload (LEO)" value={selectedRocket.payload} />
              <SpecRow label="First Flight" value={selectedRocket.firstFlight} />
            </div>

            {/* Height comparison bar */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>vs Tallest (Starship 121m)</p>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(selectedRocket.height / 121) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {Math.round((selectedRocket.height / 121) * 100)}% of Starship
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mini legend */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {COMPARISON_ROCKETS.map(r => (
          <button
            key={r.name}
            onClick={() => setSelected3d(selected3d === r.name ? null : r.name)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: selected3d === r.name ? r.color : 'var(--text-muted)',
              padding: '2px 0', fontFamily: 'var(--font-mono)',
              transition: 'color 0.2s',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
            {r.name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Rockets() {
  const [rockets, setRockets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
    ]).then(([upRes, pastRes]) => {
      const upData = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const pastData = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      const allLaunches = [...upData, ...pastData]

      const rocketMap = {}
      allLaunches.forEach(l => {
        const name = l.rocket || 'Unknown'
        if (!rocketMap[name]) {
          rocketMap[name] = { name, provider: l.launch_provider || 'Unknown', image: l.image_url, launches: [], successCount: 0, failCount: 0 }
        }
        rocketMap[name].launches.push(l)
        const s = (l.status || '').toLowerCase()
        if (s.includes('success')) rocketMap[name].successCount++
        else if (s.includes('fail')) rocketMap[name].failCount++
        if (l.image_url && !rocketMap[name].image) rocketMap[name].image = l.image_url
      })

      setRockets(Object.values(rocketMap).sort((a, b) => b.launches.length - a.launches.length))
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return rockets
    const q = searchQuery.toLowerCase()
    return rockets.filter(r => r.name.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q))
  }, [rockets, searchQuery])

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
              Rocket <span style={{ color: 'var(--accent)' }}>Encyclopedia</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              {rockets.length} unique rockets tracked across all providers
            </p>
          </div>
          <div className="search-bar">
            <Search size={14} className="search-icon" />
            <input placeholder="Search rockets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* 3D Comparison */}
      <RocketCompare />

      {/* Rocket grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 24 }}>
        <div className="launches-grid">
          {filtered.map((rocket, i) => (
            <div
              key={rocket.name}
              className={`glass rocket-card fade-up ${selected?.name === rocket.name ? 'selected' : ''}`}
              style={{ animationDelay: `${i * 30}ms`, borderColor: selected?.name === rocket.name ? 'var(--accent)' : undefined }}
              onClick={() => setSelected(selected?.name === rocket.name ? null : rocket)}
            >
              {rocket.image ? (
                <img src={rocket.image} alt={rocket.name} className="rocket-img" loading="lazy" />
              ) : (
                <div className="rocket-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🚀</div>
              )}
              <div style={{ padding: '14px 16px 16px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{rocket.name}</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>{rocket.provider}</p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{rocket.launches.length} launches</span>
                  {rocket.successCount > 0 && (
                    <span style={{ color: 'var(--success)' }}>
                      {Math.round((rocket.successCount / (rocket.successCount + rocket.failCount || 1)) * 100)}% success
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="glass fade-up" style={{ padding: '24px', position: 'sticky', top: 80, alignSelf: 'start' }}>
            <button
              onClick={() => setSelected(null)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
            >×</button>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>{selected.name}</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>{selected.provider}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <MiniStat label="Total Launches" value={selected.launches.length} />
              <MiniStat label="Successes" value={selected.successCount} />
              <MiniStat label="Failures" value={selected.failCount} />
              <MiniStat label="Success Rate" value={
                selected.successCount + selected.failCount > 0
                  ? `${Math.round((selected.successCount / (selected.successCount + selected.failCount)) * 100)}%`
                  : 'N/A'
              } />
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              Launch History
            </h4>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.launches
                .sort((a, b) => new Date(b.launch_date) - new Date(a.launch_date))
                .slice(0, 15)
                .map((l, i) => (
                  <a key={l.api_id || i} href={`/launch/${l.api_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.name?.slice(0, 35)}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {l.launch_date ? new Date(l.launch_date).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : ''}
                    </span>
                  </a>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function SpecRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
