import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Thermometer } from 'lucide-react'
import api from '../api/axios'
import CountdownTimer from '../components/CountdownTimer'

export default function LiveMission() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [launch, setLaunch] = useState(null)
    const [weather, setWeather] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMission = () => {
            api.get(`/launches/${id}/`)
                .then(res => {
                    setLaunch(res.data)
                    return api.get(`/launches/${id}/pad-weather/`)
                })
                .then(res => setWeather(res.data))
                .catch(() => { })
                .finally(() => setLoading(false))
        }

        setLoading(true)
        fetchMission()

        // Poll every 30 seconds for live updates
        const interval = setInterval(fetchMission, 30000)
        return () => clearInterval(interval)
    }, [id])

    if (loading && !launch) return <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
    if (!launch) return <div className="page-container" style={{ paddingTop: 100 }}><h2>Launch not found</h2></div>

    let ytId = null
    if (launch.webcast_url) {
        if (launch.webcast_url.includes('v=')) ytId = launch.webcast_url.split('v=')[1]?.split('&')[0]
        else if (launch.webcast_url.includes('youtu.be/')) ytId = launch.webcast_url.split('youtu.be/')[1]?.split('?')[0]
    }

    const isSuccess = launch.status?.toLowerCase().includes('success') || launch.status?.toLowerCase().includes('go')
    const isUpcoming = launch.launch_date && new Date(launch.launch_date) > new Date()

    return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
            <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
                <ArrowLeft size={16} /> Back
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800 }}>{launch.name}</h1>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className={`badge badge-${isSuccess ? 'go' : 'hold'}`}>
                            {launch.status || 'Unknown Status'}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>{launch.launch_provider}</span>
                    </div>
                </div>

                {isUpcoming && (
                    <div className="glass" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>T-Minus</p>
                        <CountdownTimer targetDate={launch.launch_date} />
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
                {/* Main Column - Video */}
                <div className="glass" style={{ overflow: 'hidden', padding: 0 }}>
                    {ytId ? (
                        <iframe
                            width="100%"
                            height="500"
                            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1`}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ display: 'block', border: 'none' }}
                        ></iframe>
                    ) : (
                        <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--text-muted)' }}>
                            No Webcast Available
                        </div>
                    )}
                    <div style={{ padding: 24 }}>
                        <h3 style={{ margin: '0 0 8px' }}>Mission Briefing</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                            {launch.mission_description || 'No detailed mission description available.'}
                        </p>
                    </div>
                </div>

                {/* Right Column - Weather & Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div className="glass" style={{ padding: 24 }}>
                        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Thermometer size={18} color="var(--accent)" /> Pad Weather
                        </h3>
                        {weather?.available ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <div>
                                        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{weather.temp_c}°C</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{weather.description}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: weather.overall === 'GO' ? 'var(--success)' : 'var(--warning)' }}>
                                            {weather.overall}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{weather.go_count} / {weather.total_rules} Rules Go</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {weather.rules?.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.value}</span>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.go ? 'var(--success)' : 'var(--danger)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Weather data currently unavailable.</div>
                        )}
                    </div>

                    <div className="glass" style={{ padding: 24 }}>
                        <h3 style={{ margin: '0 0 16px' }}>Target Orbit</h3>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                            {launch.orbit || 'Unknown'}
                        </div>
                        {launch.pad_location && (
                            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Launch Pad</div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{launch.pad_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{launch.pad_location}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}