import { useState, useEffect } from 'react'
import { Users, Globe as GlobeIcon, Rocket, Calendar, Info, X } from 'lucide-react'
import api from '../api/axios'

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
    return '🌍'
}

export default function Astronauts() {
    const [crew, setCrew] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedPerson, setSelectedPerson] = useState(null)

    useEffect(() => {
        api.get('/iss-crew/')
            .then(r => {
                const filteredCrew = (r.data.crew || []).filter(p => !p.name.toLowerCase().includes('starman'))
                setCrew(filteredCrew)
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return (
        <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" />
        </div>
    )

    return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
            <div className="fade-up" style={{ marginBottom: 32 }}>
                <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
                    Humans in <span style={{ color: 'var(--accent)' }}>Space</span>
                </h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                    Currently tracking {crew.length} astronauts in orbit
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                {Object.entries(
                    crew.reduce((acc, p) => {
                        const craft = p.craft || 'ISS'
                        if (!acc[craft]) acc[craft] = []
                        acc[craft].push(p)
                        return acc
                    }, {})
                ).map(([craft, members]) => (
                    <div key={craft} className="fade-up">
                        <h2 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: craft === 'ISS' ? 'var(--accent)' : 'var(--warning)' }} />
                            {craft} Station Crew ({members.length})
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                            {members.map((person, i) => (
                                <div
                                    key={i}
                                    className="glass hover-card"
                                    style={{ animationDelay: `${i * 30}ms`, overflow: 'hidden', cursor: 'pointer' }}
                                    onClick={() => setSelectedPerson(person)}
                                >
                                    {person.profile_image ? (
                                        <img src={person.profile_image} alt={person.name} style={{ width: '100%', height: 200, objectFit: 'cover', objectPosition: 'center 20%' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: 200, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                            <Users size={48} />
                                        </div>
                                    )}
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{person.name}</h3>
                                            <span style={{ fontSize: 20 }}>{getFlag(person.nationality)}</span>
                                        </div>
                                        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {person.agency?.abbrev || person.agency?.name || 'Astronaut'} • {person.nationality || 'Unknown'}
                                        </p>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontSize: 12 }}>
                                                <Globe size={14} style={{ color: 'var(--accent)' }} />
                                                On duty at: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{person.craft || 'ISS'}</span>
                                            </div>
                                        </div>

                                        {person.bio && (
                                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {person.bio}
                                            </p>
                                        )}
                                        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            View Mission File <Info size={12} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal (In-Website Wikipedia) */}
            {selectedPerson && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(5, 10, 24, 0.9)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={() => setSelectedPerson(null)}
                >
                    <div
                        className="glass fade-up"
                        style={{ maxWidth: 850, width: '100%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPerson(null)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(4px)' }}
                        >
                            <X size={18} />
                        </button>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', width: '100%' }} className="crew-modal-grid">
                            {/* Main Content Area */}
                            <div style={{ padding: '40px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ marginBottom: 32 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Astronaut Profile</span>
                                        {selectedPerson.status && (
                                            <span className="badge badge-go" style={{ padding: '2px 8px', fontSize: 10 }}>{selectedPerson.status.name || 'Active'}</span>
                                        )}
                                    </div>
                                    <h2 style={{ margin: '0 0 8px', fontSize: 42, fontWeight: 850, letterSpacing: '-0.04em', lineHeight: 1.1 }}>{selectedPerson.name}</h2>
                                    <p style={{ margin: 0, fontSize: 18, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        {selectedPerson.agency?.name || 'Independent Astronaut'}
                                    </p>
                                </div>

                                <div style={{ marginBottom: 32 }}>
                                    <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                                        <Info size={16} /> Biography
                                    </h3>
                                    <div 
                                        style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    >
                                        {selectedPerson.bio || 'No detailed biography available.'}
                                    </div>
                                </div>

                                {selectedPerson.wiki_url && (
                                    <a 
                                        href={selectedPerson.wiki_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
                                    >
                                        <GlobeIcon size={16} /> 
                                        View on Wikipedia
                                    </a>
                                )}
                            </div>

                            {/* Sidebar / Infobox */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column' }}>
                                {selectedPerson.profile_image ? (
                                    <div style={{ width: '100%', height: 300, position: 'relative' }}>
                                        <img 
                                            src={selectedPerson.profile_image} 
                                            alt={selectedPerson.name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} 
                                        />
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(5,10,24,0.8), transparent)' }}></div>
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', height: 300, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                        <Users size={64} />
                                    </div>
                                )}

                                <div style={{ padding: '24px' }}>
                                    <div style={{ marginBottom: 20 }}>
                                        <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}>Details</h4>
                                        
                                        {[
                                            { label: 'Nationality', value: selectedPerson.nationality, icon: getFlag(selectedPerson.nationality) },
                                            { label: 'Agency', value: selectedPerson.agency?.abbrev || selectedPerson.agency?.name },
                                            { label: 'Craft', value: selectedPerson.craft, icon: '🚀' },
                                            { label: 'Born', value: selectedPerson.date_of_birth, icon: <Calendar size={14} /> },
                                            { label: 'Flights', value: selectedPerson.flights_count, icon: <Rocket size={14} /> },
                                        ].map((item, idx) => item.value && (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {typeof item.icon === 'string' ? item.icon : item.icon} {item.label}
                                                </span>
                                                <span style={{ fontWeight: 600 }}>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                        Source: Wikipedia & Launch Library 2
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