import { useState, useEffect, useMemo } from 'react'
import { Search, Plus } from 'lucide-react'
import api from '../api/axios'

// ── 2D Rocket Comparison Data ───────────────────────────────────────────────

const ROCKET_SPECS = {
  'saturn v': { height: 110.6, diameter: 10.1, color: '#f8fafc', payload: '130,000 kg', manufacturer: 'NASA/Boeing' },
  'starship': { height: 121, diameter: 9.0, color: '#94a3b8', payload: '150,000 kg', manufacturer: 'SpaceX' },
  'falcon 9': { height: 70, diameter: 3.7, color: '#e2e8f0', payload: '22,800 kg', manufacturer: 'SpaceX' },
  'falcon heavy': { height: 70, diameter: 3.7, boosters: 2, color: '#cbd5e1', payload: '63,800 kg', manufacturer: 'SpaceX' },
  'sls': { height: 98, diameter: 8.4, boosters: 2, color: '#ffedd5', payload: '95,000 kg', manufacturer: 'NASA/Boeing' },
  'atlas v': { height: 72, diameter: 5.1, boosters: 2, color: '#fed7aa', payload: '28,370 kg', manufacturer: 'ULA' },
  'delta iv': { height: 72, diameter: 5.1, boosters: 2, color: '#fdba74', payload: '28,370 kg', manufacturer: 'ULA' },
  'ariane 5': { height: 54.8, diameter: 5.4, boosters: 2, color: '#e0f2fe', payload: '21,000 kg', manufacturer: 'Arianespace' },
  'ariane 6': { height: 63, diameter: 5.4, boosters: 2, color: '#bae6fd', payload: '21,650 kg', manufacturer: 'Arianespace' },
  'soyuz': { height: 46.1, diameter: 2.95, boosters: 4, color: '#d1fae5', payload: '8,200 kg', manufacturer: 'Roscosmos' },
  'proton': { height: 53, diameter: 7.4, color: '#ccfbf1', payload: '23,000 kg', manufacturer: 'Roscosmos' },
  'electron': { height: 18, diameter: 1.2, color: '#334155', payload: '300 kg', manufacturer: 'Rocket Lab' },
  'antares': { height: 42.5, diameter: 3.9, color: '#1e293b', payload: '8,000 kg', manufacturer: 'Northrop Grumman' },
  'vulcan': { height: 61.6, diameter: 5.4, boosters: 2, color: '#cbd5e1', payload: '27,200 kg', manufacturer: 'ULA' },
  'new glenn': { height: 98, diameter: 7.0, color: '#93c5fd', payload: '45,000 kg', manufacturer: 'Blue Origin' },
  'long march 5': { height: 57, diameter: 5.0, boosters: 4, color: '#fecaca', payload: '25,000 kg', manufacturer: 'CASC' },
  'gslv': { height: 43.4, diameter: 2.8, boosters: 4, color: '#fef08a', payload: '10,000 kg', manufacturer: 'ISRO' },
  'pslv': { height: 44, diameter: 2.8, boosters: 4, color: '#fde047', payload: '3,800 kg', manufacturer: 'ISRO' }
}

function findSpec(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  const match = Object.keys(ROCKET_SPECS).find(k => lower.includes(k));
  return match ? ROCKET_SPECS[match] : null;
}

function RocketSilhouette({ rocket, spec, isSelected, onClick }) {
  const scale = 2.5; // 1m = 2.5px
  const h = spec.height * scale;
  const w = Math.max(12, spec.diameter * scale * 1.5);

  const boosterW = spec.boosters ? w * 0.5 : 0;
  const fill = isSelected ? spec.color : `${spec.color}40`;
  const stroke = isSelected ? '#fff' : spec.color;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer', transition: 'all 0.3s' }}>
      {/* Invisible hitbox */}
      <rect x={-40} y={-h - 20} width={80} height={h + 50} fill="transparent" />

      {/* Boosters */}
      {spec.boosters > 0 && (
        <>
          <path d={`M ${-w / 2 - boosterW + 2} 0 L ${-w / 2 - boosterW + 2} ${-h * 0.55} L ${-w / 2 + 2} ${-h * 0.65} L ${-w / 2 + 2} 0 Z`} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d={`M ${w / 2 - 2} 0 L ${w / 2 - 2} ${-h * 0.65} L ${w / 2 + boosterW - 2} ${-h * 0.55} L ${w / 2 + boosterW - 2} 0 Z`} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )}

      {/* Core Body */}
      <path d={`M ${-w / 2} 0 L ${-w / 2} ${-h * 0.85} L 0 ${-h} L ${w / 2} ${-h * 0.85} L ${w / 2} 0 Z`} fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Engine suggestion */}
      <path d={`M ${-w / 3} 0 L ${-w / 2} 6 L ${w / 2} 6 L ${w / 3} 0 Z`} fill="#334155" />

      {/* Label Text */}
      <text y={-h - 12} textAnchor="middle" fill={isSelected ? '#fff' : 'var(--text-secondary)'} fontSize="11" fontWeight="bold" fontFamily="var(--font-mono)">
        {spec.height}m
      </text>
      <text y={24} textAnchor="middle" fill={isSelected ? '#fff' : 'var(--text-secondary)'} fontSize="11" fontWeight="500">
        {rocket.name.length > 14 ? rocket.name.substring(0, 12) + '...' : rocket.name}
      </text>
    </g>
  );
}

function RocketCompare({ allRockets }) {
  const availableRockets = useMemo(() => {
    return allRockets.filter(r => findSpec(r.name) !== null);
  }, [allRockets]);

  const [shownNames, setShownNames] = useState([]);
  const [selectedName, setSelectedName] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    if (availableRockets.length >= 2 && shownNames.length === 0) {
      setShownNames([availableRockets[0].name, availableRockets[1].name]);
      setSelectedName(availableRockets[0].name);
    }
  }, [availableRockets, shownNames.length]);

  const shownRockets = useMemo(() => {
    return shownNames.map(name => availableRockets.find(r => r.name === name)).filter(Boolean);
  }, [shownNames, availableRockets]);

  const unshownRockets = useMemo(() => {
    return availableRockets.filter(r => !shownNames.includes(r.name));
  }, [availableRockets, shownNames]);

  const toggleRocket = (name) => {
    if (shownNames.includes(name)) {
      setShownNames(prev => prev.filter(n => n !== name));
      if (selectedName === name) setSelectedName(null);
    } else {
      if (shownNames.length < 6) {
        setShownNames(prev => [...prev, name]);
        setSelectedName(name);
      }
    }
    setIsPickerOpen(false);
  };

  const selectedRocket = shownRockets.find(r => r.name === selectedName);
  const selectedSpec = selectedRocket ? findSpec(selectedRocket.name) : null;

  return (
    <div className="glass" style={{ marginBottom: 32, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800 }}>
            Size <span style={{ color: 'var(--accent)' }}>Comparison</span>
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            Actual proportions based on rocket specifications
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: 11 }}
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            disabled={shownNames.length >= 6}
          >
            <Plus size={13} />
            Add Rocket
          </button>

          {isPickerOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 220, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, maxHeight: 300, overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
              {unshownRockets.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>No more rockets available.</div>
              ) : (
                unshownRockets.map(r => (
                  <button
                    key={r.name}
                    onClick={() => toggleRocket(r.name)}
                    style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)' }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{findSpec(r.name)?.manufacturer}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRocket ? '1fr 240px' : '1fr', transition: 'grid-template-columns 0.3s' }}>
        {/* SVG Canvas */}
        <div style={{ height: 400, position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
          <svg width={Math.max(shownRockets.length * 120, 600)} height="400" style={{ display: 'block', minWidth: '100%' }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Ground line */}
            <line x1="0" y1="340" x2="100%" y2="340" stroke="var(--border)" strokeWidth="2" />

            {/* Height markers */}
            <g fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-mono)">
              <text x="10" y={340 - (50 * 2.5) + 4}>50m</text>
              <line x1="35" y1={340 - (50 * 2.5)} x2="100%" y2={340 - (50 * 2.5)} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

              <text x="10" y={340 - (100 * 2.5) + 4}>100m</text>
              <line x1="40" y1={340 - (100 * 2.5)} x2="100%" y2={340 - (100 * 2.5)} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
            </g>

            {shownRockets.map((r, i) => {
              const spec = findSpec(r.name);
              const isSelected = selectedName === r.name;
              const xPos = 80 + (i * 120);

              return (
                <g key={r.name} transform={`translate(${xPos}, 340)`}>
                  <RocketSilhouette
                    rocket={r}
                    spec={spec}
                    isSelected={isSelected}
                    onClick={() => setSelectedName(isSelected ? null : r.name)}
                  />
                  {/* Remove button (X) below the name */}
                  {isSelected && (
                    <g onClick={(e) => { e.stopPropagation(); toggleRocket(r.name); }} style={{ cursor: 'pointer' }} transform="translate(0, 40)">
                      <circle r="10" fill="var(--danger-soft)" />
                      <path d="M-3,-3 L3,3 M-3,3 L3,-3" stroke="var(--danger)" strokeWidth="1.5" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Spec panel for selected rocket */}
        {selectedRocket && selectedSpec && (
          <div style={{ padding: '20px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-surface)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: selectedSpec.color }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedRocket.name}</h3>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)' }}>{selectedSpec.manufacturer}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <SpecRow label="Height" value={`${selectedSpec.height} m`} />
              <SpecRow label="Diameter" value={`${selectedSpec.diameter} m`} />
              <SpecRow label="Payload to LEO" value={selectedSpec.payload} />
              <SpecRow label="Total Launches" value={selectedRocket.launches?.length || 0} />
              {selectedSpec.boosters && <SpecRow label="Side Boosters" value={selectedSpec.boosters} />}
            </div>

            {/* Height comparison bar vs Starship */}
            <div style={{ marginTop: 'auto' }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>vs Tallest (Starship 121m)</p>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(selectedSpec.height / 121) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {Math.round((selectedSpec.height / 121) * 100)}% of Starship
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Rockets() {
  const [view, setView] = useState('vehicles') // 'vehicles' or 'payloads'
  const [rockets, setRockets] = useState([])
  const [payloads, setPayloads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setLoading(true)
    const fetchVehicles = Promise.all([
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
    })

    const fetchPayloads = api.get('/launches/payloads/').then(({ data }) => {
      const list = Array.isArray(data) ? data : data.results ?? []
      setPayloads(list)
    }).catch(() => setPayloads([]))

    Promise.all([fetchVehicles, fetchPayloads]).finally(() => setLoading(false))
  }, [])

  const filteredRockets = useMemo(() => {
    if (!searchQuery.trim()) return rockets
    const q = searchQuery.toLowerCase()
    return rockets.filter(r => r.name.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q))
  }, [rockets, searchQuery])

  const filteredPayloads = useMemo(() => {
    if (!searchQuery.trim()) return payloads
    const q = searchQuery.toLowerCase()
    return payloads.filter(p => p.name.toLowerCase().includes(q) || (p.mission_type || '').toLowerCase().includes(q))
  }, [payloads, searchQuery])

  const items = view === 'vehicles' ? filteredRockets : filteredPayloads

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
              Hardware <span style={{ color: 'var(--accent)' }}>Encyclopedia</span>
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              Technical specifications for {view === 'vehicles' ? `${rockets.length} rockets` : `${payloads.length} spacecraft`}
            </p>
          </div>
          <div className="search-bar">
            <Search size={14} className="search-icon" />
            <input placeholder={`Search ${view}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <button className={`tab ${view === 'vehicles' ? 'active' : ''}`} onClick={() => { setView('vehicles'); setSelected(null); }}>
          Launch Vehicles
        </button>
        <button className={`tab ${view === 'payloads' ? 'active' : ''}`} onClick={() => { setView('payloads'); setSelected(null); }}>
          Spacecraft & Payloads
        </button>
      </div>

      {/* 2D Size Comparison (Rockets Only) */}
      {view === 'vehicles' && <RocketCompare allRockets={filteredRockets} />}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 24 }}>
        <div className="launches-grid">
          {items.map((item, i) => (
            <div
              key={item.api_id || item.name}
              className={`glass rocket-card fade-up ${selected?.name === item.name ? 'selected' : ''}`}
              style={{ animationDelay: `${i * 30}ms`, borderColor: selected?.name === item.name ? 'var(--accent)' : undefined }}
              onClick={() => setSelected(selected?.name === item.name ? null : item)}
            >
              {item.image || item.image_url ? (
                <img src={item.image || item.image_url} alt={item.name} className="rocket-img" loading="lazy" />
              ) : (
                <div className="rocket-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                  {view === 'vehicles' ? '🚀' : '🛰️'}
                </div>
              )}
              <div style={{ padding: '14px 16px 16px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{item.name}</h3>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {view === 'vehicles' ? item.provider : (item.launch_provider || item.mission_type || 'Satellite')}
                </p>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                    {view === 'vehicles' ? `${item.launches.length} launches` : (item.orbit || 'In Orbit')}
                  </span>
                  {view === 'vehicles' && item.successCount > 0 && (
                    <span style={{ color: 'var(--success)' }}>
                      {Math.round((item.successCount / (item.successCount + item.failCount || 1)) * 100)}% success
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
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
              {view === 'vehicles' ? selected.provider : (selected.launch_provider || selected.mission_type)}
            </p>

            {view === 'vehicles' ? (
              <>
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
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="glass" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {selected.mission_description || 'No detailed mission description available for this spacecraft.'}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <MiniStat label="Orbit" value={selected.orbit || 'LEO'} />
                  <MiniStat label="Type" value={selected.mission_type || 'Unknown'} />
                  <MiniStat label="Launch Date" value={selected.launch_date ? new Date(selected.launch_date).toLocaleDateString() : 'Unknown'} />
                  <MiniStat label="Rocket" value={selected.rocket?.split(' ')[0] || 'Unknown'} />
                </div>
                <a href={`/launch/${selected.api_id}`} className="btn btn-primary" style={{ marginTop: 8, textAlign: 'center' }}>
                  View Full Launch Details
                </a>
              </div>
            )}
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
