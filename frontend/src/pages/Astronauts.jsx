import { useState, useEffect } from 'react'
import { Users, Globe, Rocket, Calendar, Info } from 'lucide-react'
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
                    style={{ position: 'fixed', inset: 0, background: 'rgba(5, 10, 24, 0.85)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={() => setSelectedPerson(null)}
                >
                    <div
                        className="glass fade-up"
                        style={{ maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto', position: 'relative', padding: 0 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPerson(null)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 24, width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                        >
                            &times;
                        </button>

                        {selectedPerson.profile_image ? (
                            <img src={selectedPerson.profile_image} alt={selectedPerson.name} style={{ width: '100%', height: 300, objectFit: 'cover', objectPosition: 'center 20%', borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                        ) : (
                            <div style={{ width: '100%', height: 200, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                                <Users size={64} />
                            </div>
                        )}

                        <div style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>{selectedPerson.name}</h2>
                                    <p style={{ margin: 0, fontSize: 16, color: 'var(--text-secondary)' }}>
                                        {getFlag(selectedPerson.nationality)} {selectedPerson.nationality || 'Unknown'} • {selectedPerson.agency?.name || 'Astronaut'}
                                    </p>
                                </div>
                                {selectedPerson.status && (
                                    <span className="badge badge-go">{selectedPerson.status.name}</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 14 }}>
                                    <Globe size={16} style={{ color: 'var(--accent)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Craft:</span>
                                    <span style={{ fontWeight: 600 }}>{selectedPerson.craft || 'ISS'}</span>
                                </div>
                                {selectedPerson.flights_count !== undefined && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 14 }}>
                                        <Rocket size={16} style={{ color: 'var(--warning)' }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>Flights:</span>
                                        <span style={{ fontWeight: 600 }}>{selectedPerson.flights_count}</span>
                                    </div>
                                )}
                                {selectedPerson.date_of_birth && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 14 }}>
                                        <Calendar size={16} style={{ color: 'var(--success)' }} />
                                        <span style={{ color: 'var(--text-secondary)' }}>Born:</span>
                                        <span style={{ fontWeight: 600 }}>{selectedPerson.date_of_birth}</span>
                                    </div>
                                )}
                            </div>

                            <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Info size={16} /> Biography
                            </h3>
                            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                                {selectedPerson.bio || 'No biography available for this astronaut.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}