import { useState, useEffect } from 'react'
import { Users, Globe, Rocket } from 'lucide-react'
import api from '../api/axios'

export default function Astronauts() {
    const [crew, setCrew] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Fetch detailed astronaut data from Launch Library 2
        fetch('https://ll.thespacedevs.com/2.2.0/astronaut/?in_space=true&mode=detailed')
            .then(res => res.json())
            .then(data => {
                if (data.results) {
                    setCrew(data.results)
                } else {
                    api.get('/iss-crew/').then(r => setCrew(r.data.crew || []))
                }
            })
            .catch(err => {
                console.error(err)
                api.get('/iss-crew/').then(r => setCrew(r.data.crew || []))
            })
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {crew.map((person, i) => (
                    <div key={i} className="glass hover-card fade-up" style={{ animationDelay: `${i * 40}ms`, overflow: 'hidden' }}>
                        {person.profile_image ? (
                            <img src={person.profile_image} alt={person.name} style={{ width: '100%', height: 200, objectFit: 'cover', objectPosition: 'top' }} />
                        ) : (
                            <div style={{ width: '100%', height: 200, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                <Users size={48} />
                            </div>
                        )}
                        <div style={{ padding: '20px' }}>
                            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{person.name}</h3>
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                                {person.agency?.name || 'Astronaut'} • {person.nationality || 'Unknown'}
                            </p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: 'var(--text-primary)' }}>
                                    <Globe size={14} style={{ color: 'var(--accent)' }} />
                                    Stationed on: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{person.craft || 'ISS'}</span>
                                </div>
                                {person.flights_count !== undefined && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: 'var(--text-primary)' }}>
                                        <Rocket size={14} style={{ color: 'var(--warning)' }} />
                                        Flights: {person.flights_count}
                                    </div>
                                )}
                            </div>

                            {person.bio && (
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {person.bio}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}