import { useState, useEffect, useMemo } from 'react'
import Globe from '../components/Globe'
import api from '../api/axios'
import { MapPin, CloudRain, Wind } from 'lucide-react'

export default function Spaceports() {
    const [launches, setLaunches] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedPad, setSelectedPad] = useState(null)
    const [padWeather, setPadWeather] = useState(null)
    const [loadingWeather, setLoadingWeather] = useState(false)

    useEffect(() => {
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

    useEffect(() => {
        if (selectedPad) {
            const upcoming = selectedPad.launches.find(l => new Date(l.launch_date) > new Date() && l.api_id)
            if (upcoming) {
                setLoadingWeather(true)
                api.get(`/launches/${upcoming.api_id}/pad-weather/`)
                    .then(res => setPadWeather(res.data))
                    .catch(() => setPadWeather(null))
                    .finally(() => setLoadingWeather(false))
            } else {
                setPadWeather(null)
            }
        } else {
            setPadWeather(null)
        }
    }, [selectedPad])

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
                        lat: l.pad_latitude,
                        lng: l.pad_longitude,
                        count: 0,
                        launches: []
                    }
                }
                padMap[key].count++
                padMap[key].launches.push(l)
            }
        })
        return Object.values(padMap)
    }, [launches])

    if (loading) return (
        <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" />
        </div>
    )

    return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
            <div className="fade-up" style={{ marginBottom: 24, flexShrink: 0 }}>
                <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
                    Global <span style={{ color: 'var(--accent)' }}>Spaceports</span>
                </h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
                    Interactive 3D launch pad map visualizing {pads.length} locations globally
                </p>
            </div>

            <div style={{ flex: 1, position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }} className="fade-up">
                <Globe pads={pads} onPadClick={(pad) => setSelectedPad(pad)} spin={!selectedPad} />

                {selectedPad && (
                    <div className="glass fade-in" style={{ position: 'absolute', top: 24, right: 24, width: 320, padding: 24, zIndex: 10 }}>
                        <button onClick={() => setSelectedPad(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: 'var(--accent)' }}>
                            <MapPin size={20} />
                            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.2 }}>{selectedPad.name}</h3>
                        </div>
                        <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>{selectedPad.location}</p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recorded Launches</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{selectedPad.count}</span>
                        </div>

                        {padWeather && padWeather.available && (
                            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(0, 212, 255, 0.05)', borderRadius: 8, border: '1px solid rgba(0, 212, 255, 0.2)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current Weather</div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{padWeather.temp_c}°C</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><CloudRain size={12} /> {padWeather.description}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: padWeather.overall === 'GO' ? 'var(--success)' : 'var(--warning)' }}>{padWeather.overall}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><Wind size={12} /> {padWeather.wind_knots} kts</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 20 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming & Recent Activity</h4>
                            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                                {selectedPad.launches.sort((a, b) => new Date(b.launch_date) - new Date(a.launch_date)).slice(0, 10).map((l, i) => (
                                    <a href={`/launch/${l.api_id}`} key={i} style={{ display: 'block', padding: 10, borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, textDecoration: 'none' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{l.name}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                                            <span>{l.launch_provider}</span>
                                            <span>{new Date(l.launch_date).toLocaleDateString()}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}