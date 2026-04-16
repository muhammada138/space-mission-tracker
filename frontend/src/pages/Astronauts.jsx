import { useState, useEffect } from 'react'
import { Users, Globe as GlobeIcon, Info, RotateCcw } from 'lucide-react'
import { getFlag } from '../utils/getFlag'
import CrewModal from '../components/CrewModal'
import toast from 'react-hot-toast'

export default function Astronauts() {
    const [crew, setCrew] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [selectedPerson, setSelectedPerson] = useState(null)
    const [refreshing, setRefreshing] = useState(false)

    const fetchCrew = (force = false) => {
        if (force) setRefreshing(true)
        else setLoading(true)
        
        setError(false)
        const url = force ? '/api/iss-crew/?force_refresh=true' : '/api/iss-crew/'
        
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(r.status)
                return r.json()
            })
            .then(data => {
                const filteredCrew = (data.crew || []).filter(p => !p.name.toLowerCase().includes('starman'))
                if (filteredCrew.length > 0) {
                    setCrew(filteredCrew)
                    if (force) toast.success('Personnel data updated')
                } else {
                    throw new Error('Empty crew from backend')
                }
            })
            .catch(err => {
                if (force) {
                    toast.error('Refresh failed')
                    setRefreshing(false)
                    return
                }
                console.warn('Backend crew fetch failed, trying LL2 direct:', err)
                fetch('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&mode=detailed&limit=30')
                    .then(r => r.json())
                    .then(data => {
                        const results = data.results || []
                        const mapped = results.map(a => ({
                            name: a.name || '',
                            nationality: a.nationality || '',
                            bio: a.bio || '',
                            profile_image: a.profile_image || a.profile_image_thumbnail || '',
                            date_of_birth: a.date_of_birth || '',
                            flights_count: a.flights_count || 0,
                            agency: {
                                name: (a.agency || {}).name || '',
                                abbrev: (a.agency || {}).abbrev || '',
                            },
                            craft: (a.last_flight || '').toLowerCase().includes('shenzhou') ? 'Tiangong' : 'ISS',
                            wiki_url: a.wiki || '',
                            status: { name: 'Active' },
                        }))
                        if (mapped.length > 0) {
                            setCrew(mapped.filter(p => !p.name.toLowerCase().includes('starman')))
                        } else {
                            setError(true)
                        }
                    })
                    .catch(() => setError(true))
            })
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchCrew() }, [])

    if (loading) return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
            <div style={{ marginBottom: 48 }}>
                <div className="skeleton" style={{ width: 200, height: 16, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: 300, height: 36, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: 400, height: 16 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="skeleton skeleton-img" />
                        <div className="skeleton-body">
                            <div className="skeleton skeleton-line" />
                            <div className="skeleton skeleton-line-sm" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    if (error) return (
        <div className="page-container" style={{ paddingTop: 100 }}>
            <div className="empty-state fade-up">
                <div className="icon">🛸</div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Unable to reach crew data APIs. They may be rate-limited.</p>
                <button className="btn btn-primary" onClick={fetchCrew}>Retry</button>
            </div>
        </div>
    )

    return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
            <div className="fade-up" style={{ marginBottom: 48 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-glow)' }}>
                        <Users size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>Personnel Manifest</span>
                </div>
                <h1 style={{ margin: '0 0 10px', fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em' }}>
                    Humans in <span style={{ color: 'var(--accent)' }}>Orbit</span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 16, fontWeight: 500 }}>
                        Currently tracking {crew.length} active personnel aboard orbital platforms
                    </p>
                    <button 
                        className={`btn ${refreshing ? 'btn-disabled' : 'btn-ghost'}`} 
                        onClick={() => fetchCrew(true)}
                        disabled={refreshing}
                        style={{ padding: '8px 16px', fontSize: 13, gap: 8 }}
                    >
                        <RotateCcw size={14} className={refreshing ? 'spin' : ''} />
                        {refreshing ? 'Updating...' : 'Force Refresh'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 60 }}>
                {Object.entries(
                    (crew || []).reduce((acc, p) => {
                        const craft = p.craft || 'ISS'
                        if (!acc[craft]) acc[craft] = []
                        acc[craft].push(p)
                        return acc
                    }, {})
                ).map(([craft, members]) => (
                    <div key={craft} className="fade-up">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: craft === 'ISS' ? 'var(--accent)' : 'var(--warning)', boxShadow: `0 0 10px ${craft === 'ISS' ? 'var(--accent-glow)' : 'var(--warning-soft)'}` }} />
                            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                                {craft} Station Crew <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>({members.length})</span>
                            </h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                            {members.map((person, i) => (
                                <div
                                    key={i}
                                    className="glass hover-card"
                                    style={{ animationDelay: `${i * 40}ms`, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}
                                    onClick={() => setSelectedPerson(person)}
                                >
                                    <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                                        {person.profile_image ? (
                                            <img src={person.profile_image} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', background: 'rgba(0,212,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                                <Users size={56} strokeWidth={1} />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(5,10,24,0.9), transparent)' }} />
                                        <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{getFlag(person.nationality)}</span>
                                    </div>
                                    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <h3 className="text-glow" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                                            {person.name}
                                        </h3>
                                        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {person.agency?.name && person.agency.name !== 'Unknown' ? person.agency.name : 'Independent Astronaut'} 
                                            {person.nationality && person.nationality !== 'Unknown' ? ` • ${person.nationality}` : ''}
                                        </p>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', fontSize: 12, border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <GlobeIcon size={14} style={{ color: 'var(--accent)' }} />
                                                <span style={{ color: 'var(--text-secondary)' }}>Duty:</span> 
                                                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{person.craft || 'ISS'}</span>
                                            </div>
                                        </div>

                                        {person.bio && (
                                            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                                {person.bio}
                                            </p>
                                        )}
                                        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12, color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            Access Mission File <Info size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {selectedPerson && <CrewModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
        </div>
    )
}
