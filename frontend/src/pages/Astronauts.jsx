import { useState, useEffect } from 'react'
import { Users, Globe as GlobeIcon, Rocket, Calendar, Info, X } from 'lucide-react'

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
    return '🌍'
}

export default function Astronauts() {
    const [crew, setCrew] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [selectedPerson, setSelectedPerson] = useState(null)

    const fetchCrew = () => {
        setLoading(true)
        setError(false)
        fetch('/api/iss-crew/')
            .then(r => {
                if (!r.ok) throw new Error(r.status)
                return r.json()
            })
            .then(data => {
                const filteredCrew = (data.crew || []).filter(p => !p.name.toLowerCase().includes('starman'))
                if (filteredCrew.length > 0) {
                    setCrew(filteredCrew)
                } else {
                    throw new Error('Empty crew from backend')
                }
            })
            .catch(err => {
                console.warn('Backend crew fetch failed, trying LL2 direct:', err)
                // Direct fallback to LL2
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

    useEffect(() => {
        if (selectedPerson) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => { document.body.style.overflow = 'unset' }
    }, [selectedPerson])

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
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 16, fontWeight: 500 }}>
                    Currently tracking {crew.length} active personnel aboard orbital platforms
                </p>
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
                                        <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>{person.name}</h3>
                                        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            {person.agency?.abbrev || person.agency?.name || 'Astronaut'} • {person.nationality || 'Unknown'}
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

            {selectedPerson && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(5, 10, 24, 0.9)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px', overflowY: 'auto' }}
                    onClick={() => setSelectedPerson(null)}
                >
                    <div
                        className="glass fade-up"
                        style={{ maxWidth: 900, width: '100%', position: 'relative', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPerson(null)}
                            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, backdropFilter: 'blur(8px)' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{ display: 'flex', flexWrap: 'wrap-reverse', width: '100%' }}>
                            <div style={{ flex: '1 1 500px', padding: '48px', minWidth: 0 }}>
                                <div style={{ marginBottom: 40 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                                        <div style={{ padding: '4px 10px', background: 'var(--accent-soft)', borderRadius: 6, border: '1px solid var(--accent-glow)' }}>
                                            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', fontWeight: 800 }}>Astronaut Profile</span>
                                        </div>
                                        <span className="badge badge-go" style={{ padding: '4px 10px', fontSize: 11 }}>Active</span>
                                    </div>
                                    <h2 style={{ margin: '0 0 12px', fontSize: 48, fontWeight: 900, lineHeight: 1.05, background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{selectedPerson.name}</h2>
                                    <p style={{ margin: 0, fontSize: 20, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        {selectedPerson.agency?.name || 'Independent Astronaut'}
                                    </p>
                                </div>

                                <div style={{ marginBottom: 40 }}>
                                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
                                        <Info size={16} /> Biography
                                    </h3>
                                    <div style={{ fontSize: 17, lineHeight: 1.85, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', opacity: 0.95 }}>
                                        {selectedPerson.bio || 'No detailed biography available.'}
                                    </div>
                                </div>

                                {selectedPerson.wiki_url && (
                                    <a href={selectedPerson.wiki_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 12, textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>
                                        <GlobeIcon size={18} /> Official Wikipedia Page
                                    </a>
                                )}
                            </div>

                            <div style={{ flex: '0 0 320px', background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
                                {selectedPerson.profile_image ? (
                                    <div style={{ width: '100%', height: 380, position: 'relative', overflow: 'hidden' }}>
                                        <img src={selectedPerson.profile_image} alt={selectedPerson.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, rgba(5,10,24,1), transparent)' }} />
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: 320, background: 'rgba(0,212,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                        <Users size={80} strokeWidth={1} />
                                    </div>
                                )}
                                <div style={{ padding: '32px' }}>
                                    <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', fontWeight: 800, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>Personal Data</h4>
                                    {[
                                        { label: 'Nationality', value: selectedPerson.nationality, icon: getFlag(selectedPerson.nationality) },
                                        { label: 'Agency', value: selectedPerson.agency?.abbrev || selectedPerson.agency?.name, icon: '🏛️' },
                                        { label: 'Craft', value: selectedPerson.craft, icon: '🚀' },
                                        { label: 'Born', value: selectedPerson.date_of_birth, icon: <Calendar size={14} /> },
                                        { label: 'Flights', value: selectedPerson.flights_count, icon: <Rocket size={14} /> }
                                    ].map((item, idx) => item.value && (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 10 }}>{item.icon} {item.label}</span>
                                            <span style={{ fontWeight: 700, textAlign: 'right' }}>{item.value}</span>
                                        </div>
                                    ))}
                                    <div style={{ marginTop: 20, padding: '16px', background: 'rgba(0,212,255,0.03)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                        Data aggregated from Wikipedia & Launch Library 2 systems.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}