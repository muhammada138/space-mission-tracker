import { useState, useEffect, useMemo } from 'react'
import { Search, Plus, SlidersHorizontal, X, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

function RocketCompare({ allRockets, shownNames, setShownNames, selectedName, setSelectedName }) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const availableRockets = useMemo(() => {
    return allRockets.filter(r => findSpec(r.name) !== null);
  }, [allRockets]);

  useEffect(() => {
    if (availableRockets.length >= 2 && shownNames.length === 0) {
      setShownNames([availableRockets[0].name, availableRockets[1].name]);
      setSelectedName(availableRockets[0].name);
    }
  }, [availableRockets, shownNames.length, setShownNames, setSelectedName]);

  const shownRockets = useMemo(() => {
    return shownNames.map(name => availableRockets.find(r => r.name === name)).filter(Boolean);
  }, [shownNames, availableRockets]);

  const filteredUnshown = useMemo(() => {
    const unshown = availableRockets.filter(r => !shownNames.includes(r.name));
    if (!pickerSearch.trim()) return unshown;
    const q = pickerSearch.toLowerCase();
    return unshown.filter(r => r.name.toLowerCase().includes(q));
  }, [availableRockets, shownNames, pickerSearch]);

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
    setPickerSearch('');
  };

  const selectedRocket = shownRockets.find(r => r.name === selectedName);
  const selectedSpec = selectedRocket ? findSpec(selectedRocket.name) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="glass" 
      style={{ marginBottom: 32, overflow: 'hidden', border: '1px solid var(--glass-border)', borderRadius: 16 }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
            style={{ padding: '6px 12px', fontSize: 11, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}
            onClick={() => {
              setIsPickerOpen(!isPickerOpen);
              if (!isPickerOpen) setPickerSearch('');
            }}
            disabled={shownNames.length >= 6}
          >
            <Plus size={13} style={{ marginRight: 6 }} />
            Add Rocket
          </button>

          <AnimatePresence>
            {isPickerOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="glass" 
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  right: 0, 
                  marginTop: 8, 
                  width: 240, 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--glass-border)', 
                  borderRadius: 12, 
                  zIndex: 100, 
                  maxHeight: 400, 
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.6)' 
                }}
              >
                {/* Picker Search Bar */}
                <div style={{ padding: 10, borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search vehicles..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      style={{ 
                        width: '100%', 
                        background: 'rgba(0,0,0,0.4)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: 6, 
                        padding: '6px 10px 6px 28px', 
                        fontSize: 11, 
                        color: '#fff',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div className="custom-scrollbar" style={{ overflowY: 'auto' }}>
                  {filteredUnshown.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                      {pickerSearch ? 'No matches found' : 'No more rockets available'}
                    </div>
                  ) : (
                    filteredUnshown.map(r => (
                      <button
                        key={r.name}
                        onClick={() => toggleRocket(r.name)}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.2s' }}
                        className="hover-bg-soft"
                      >
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#fff' }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{findSpec(r.name)?.manufacturer}</div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedRocket ? '1fr 260px' : '1fr', transition: 'grid-template-columns 0.3s' }}>
        {/* SVG Canvas */}
        <div style={{ height: 400, position: 'relative', overflowX: 'auto', overflowY: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
          <svg width={Math.max(shownRockets.length * 120, 600)} height="400" style={{ display: 'block', minWidth: '100%' }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Ground line */}
            <line x1="0" y1="340" x2="100%" y2="340" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />

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
                      <circle r="10" fill="rgba(239, 68, 68, 0.2)" />
                      <path d="M-3,-3 L3,3 M-3,3 L3,-3" stroke="#ef4444" strokeWidth="1.5" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Spec panel for selected rocket */}
        {selectedRocket && selectedSpec && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ padding: '20px', borderLeft: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(255,255,255,0.02)' }}
          >
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
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(selectedSpec.height / 121) * 100}%`, background: 'var(--accent)', borderRadius: 2 }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                {Math.round((selectedSpec.height / 121) * 100)}% of Starship
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
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
  
  // Comparison state (Lifted to persist across view tabs)
  const [comparisonShownNames, setComparisonShownNames] = useState([])
  const [comparisonSelectedName, setComparisonSelectedName] = useState(null)
  
  // Filters
  const [showFilters, setShowFilters] = useState(false)
  const [missionFilter, setMissionFilter] = useState('all')
  const [orbitFilter, setOrbitFilter] = useState('all')

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

  // Options for filtering spacecraft
  const payloadFilterOptions = useMemo(() => {
    const missions = new Set()
    const orbits = new Set()
    payloads.forEach(p => {
      if (p.mission_type) missions.add(p.mission_type)
      if (p.orbit) orbits.add(p.orbit)
    })
    return {
      missions: Array.from(missions).sort(),
      orbits: Array.from(orbits).sort()
    }
  }, [payloads])

  const filteredRockets = useMemo(() => {
    if (!searchQuery.trim()) return rockets
    const q = searchQuery.toLowerCase()
    return rockets.filter(r => r.name.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q))
  }, [rockets, searchQuery])

  const filteredPayloads = useMemo(() => {
    let result = payloads
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.mission_type || '').toLowerCase().includes(q) ||
        (p.mission_description || '').toLowerCase().includes(q)
      )
    }

    if (missionFilter !== 'all') {
      result = result.filter(p => p.mission_type === missionFilter)
    }

    if (orbitFilter !== 'all') {
      result = result.filter(p => p.orbit === orbitFilter)
    }

    return result
  }, [payloads, searchQuery, missionFilter, orbitFilter])

  const items = view === 'vehicles' ? filteredRockets : filteredPayloads

  const clearFilters = () => {
    setSearchQuery('')
    setMissionFilter('all')
    setOrbitFilter('all')
  }

  if (loading) return (
    <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <header className="fade-up" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Hardware <span style={{ color: 'var(--accent)' }}>Encyclopedia</span>
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
            Technical specifications for {view === 'vehicles' ? `${rockets.length} rockets` : `${payloads.length} spacecraft`}
          </p>
        </div>
      </header>

      {/* Main Controls Section */}
      <div className="glass" style={{ padding: '12px', borderRadius: 16, marginBottom: 32, border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Top row: View Switcher */}
          <div className="tabs" style={{ borderBottom: 'none', padding: '4px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, display: 'inline-flex', alignSelf: 'flex-start' }}>
            <button 
              className={`tab ${view === 'vehicles' ? 'active' : ''}`} 
              onClick={() => { setView('vehicles'); setSelected(null); clearFilters(); }}
              style={{ borderRadius: 8, padding: '8px 16px', border: 'none', margin: 0 }}
            >
              Launch Vehicles
            </button>
            <button 
              className={`tab ${view === 'payloads' ? 'active' : ''}`} 
              onClick={() => { setView('payloads'); setSelected(null); clearFilters(); }}
              style={{ borderRadius: 8, padding: '8px 16px', border: 'none', margin: 0 }}
            >
              Spacecraft & Payloads
            </button>
          </div>

          {/* Bottom row: Search and Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: '1 1 350px' }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder={`Search ${view === 'vehicles' ? 'rockets' : 'spacecraft'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={16} />
                </button>
              )}
            </div>

            {view === 'payloads' && (
              <button 
                className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowFilters(!showFilters)}
                style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', fontSize: 14, borderRadius: 12 }}
              >
                <SlidersHorizontal size={18} />
                Advanced Filters
                {(missionFilter !== 'all' || orbitFilter !== 'all') && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: showFilters ? '#000' : 'var(--accent)', boxShadow: showFilters ? 'none' : '0 0 8px var(--accent)' }} />
                )}
              </button>
            )}
          </div>

          {/* Expanded Filters Panel (Spacecraft View Only) */}
          <AnimatePresence>
            {view === 'payloads' && showFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                  gap: 20, 
                  padding: '24px', 
                  background: 'rgba(255,255,255,0.02)', 
                  borderRadius: 16, 
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.2)',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">Mission Category</label>
                    <select 
                      value={missionFilter} 
                      onChange={(e) => setMissionFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Categories</option>
                      {payloadFilterOptions.missions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label className="filter-label">Target Orbit</label>
                    <select 
                      value={orbitFilter} 
                      onChange={(e) => setOrbitFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Orbits</option>
                      {payloadFilterOptions.orbits.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button 
                      onClick={clearFilters}
                      className="btn btn-ghost"
                      style={{ height: 42, width: '100%', fontSize: 13, borderRadius: 10 }}
                    >
                      Reset All Filters
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2D Size Comparison (Persists across tabs) */}
      {!searchQuery && (
        <RocketCompare 
          allRockets={rockets} 
          shownNames={comparisonShownNames}
          setShownNames={setComparisonShownNames}
          selectedName={comparisonSelectedName}
          setSelectedName={setComparisonSelectedName}
        />
      )}

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 32 }}>
        <div className="launches-grid">
          {items.length === 0 ? (
            <div className="empty-state fade-up" style={{ gridColumn: '1 / -1', padding: '100px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 20 }}>🛸</div>
              <h3>No hardware found</h3>
              <p style={{ color: 'var(--text-muted)' }}>Try adjusting your search or reset filters</p>
              <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={clearFilters}>Reset All</button>
            </div>
          ) : (
            items.map((item, i) => (
              <motion.div
                key={item.api_id || item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: (i % 6) * 0.05 }}
                className={`glass rocket-card ${selected?.name === item.name || selected?.api_id === item.api_id ? 'selected' : ''}`}
                style={{ 
                  borderColor: (selected?.name === item.name || selected?.api_id === item.api_id) ? 'var(--accent)' : undefined,
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  const isSelected = selected?.api_id === item.api_id || selected?.name === item.name
                  setSelected(isSelected ? null : item)
                }}
              >
                {item.image || item.image_url ? (
                  <img src={item.image || item.image_url} alt={item.name} className="rocket-img" loading="lazy" />
                ) : (
                  <div className="rocket-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, background: 'rgba(255,255,255,0.02)' }}>
                    {view === 'vehicles' ? '🚀' : '🛰️'}
                  </div>
                )}
                <div style={{ padding: '16px' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#fff' }}>{item.name}</h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {view === 'vehicles' ? item.provider : (item.launch_provider || item.mission_type || 'Satellite')}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {view === 'vehicles' ? `${item.launches.length} Missions` : (item.orbit || 'In Orbit')}
                    </span>
                    {view === 'vehicles' && item.successCount > 0 && (
                      <span style={{ color: 'var(--success)' }}>
                        {Math.round((item.successCount / (item.successCount + item.failCount || 1)) * 100)}% Success
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Detail sticky panel */}
        <AnimatePresence>
          {selected && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass" 
              style={{ padding: '24px', position: 'sticky', top: 80, alignSelf: 'start', borderRadius: 20, border: '1px solid var(--accent)', boxShadow: '0 0 40px rgba(100, 100, 255, 0.1)' }}
            >
              <button
                onClick={() => setSelected(null)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              ><X size={14} /></button>
              
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase' }}>
                    {view === 'vehicles' ? 'Launch Vehicle' : 'Spacecraft Unit'}
                  </span>
                </div>
                <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{selected.name}</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                  {view === 'vehicles' ? selected.provider : (selected.launch_provider || selected.mission_type)}
                </p>
              </div>

              {view === 'vehicles' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
                    <MiniStat label="Total Flights" value={selected.launches.length} />
                    <MiniStat label="Success Rate" value={
                      selected.successCount + selected.failCount > 0
                        ? `${Math.round((selected.successCount / (selected.successCount + selected.failCount)) * 100)}%`
                        : 'N/A'
                    } />
                    <MiniStat label="Successful" value={selected.successCount} color="var(--success)" />
                    <MiniStat label="Failed" value={selected.failCount} color="var(--danger)" />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <SlidersHorizontal size={14} style={{ color: 'var(--text-muted)' }} />
                    <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Flight History
                    </h4>
                  </div>
                  
                  <div className="custom-scrollbar" style={{ maxHeight: 350, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selected.launches
                      .sort((a, b) => new Date(b.launch_date) - new Date(a.launch_date))
                      .map((l, i) => (
                        <a key={l.api_id || i} href={`/launch/${l.api_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid transparent', fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.borderColor='transparent'}>
                          <span style={{ color: '#fff', fontWeight: 500 }}>{l.name?.split('|').pop()?.trim().slice(0, 24)}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6 }}>
                            {l.launch_date ? new Date(l.launch_date).getFullYear() : ''}
                          </span>
                        </a>
                      ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 12 }}>
                    <Info size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
                      {selected.mission_description || 'Operational satellite currently in orbital service. No detailed technical abstract provided.'}
                    </p>
                  </div>
                  
                  <div style={{ display: grid, gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <MiniStat label="Orbit Path" value={selected.orbit || 'LEO'} />
                    <MiniStat label="Mission Type" value={selected.mission_type?.split(' ')[0] || 'Unknown'} />
                    <MiniStat label="Deployed" value={selected.launch_date ? new Date(selected.launch_date).getFullYear() : 'Unknown'} />
                    <MiniStat label="Carrier" value={selected.rocket?.split(' ')[0] || 'Unknown'} />
                  </div>
                  
                  <a href={`/launch/${selected.api_id}`} className="btn btn-primary" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, borderRadius: 10 }}>
                    View Full Tracking Data
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color = 'var(--accent)' }) {
  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: color, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.02em' }}>{label}</div>
    </div>
  )
}

function SpecRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
