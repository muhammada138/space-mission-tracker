import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Thermometer, Radio, Rocket, MapPin, Globe, Gauge, Clock, ChevronRight, Activity } from 'lucide-react'
import api from '../api/axios'
import CountdownTimer from '../components/CountdownTimer'

// ── Falcon 9 Mission Phase Timeline (approximate T+ seconds) ─────────────────
const F9_PHASES = [
    { name: 'Pre-Launch', tPlus: -Infinity, icon: '🔧', desc: 'Vehicle on pad, systems checkout' },
    { name: 'Liftoff', tPlus: 0, icon: '🔥', desc: 'Main engine ignition and liftoff' },
    { name: 'Max-Q', tPlus: 72, icon: '💨', desc: 'Maximum dynamic pressure' },
    { name: 'MECO', tPlus: 153, icon: '⚡', desc: 'Main engine cutoff' },
    { name: 'Stage Sep', tPlus: 156, icon: '✂️', desc: 'First and second stage separation' },
    { name: 'SES-1', tPlus: 163, icon: '🔵', desc: 'Second engine start' },
    { name: 'Fairing Sep', tPlus: 210, icon: '🛡️', desc: 'Payload fairing jettison' },
    { name: 'Entry Burn', tPlus: 390, icon: '🔻', desc: 'Booster entry burn (3 engines)' },
    { name: 'SECO-1', tPlus: 510, icon: '⭐', desc: 'Second engine cutoff' },
    { name: 'Landing', tPlus: 520, icon: '🎯', desc: 'First stage landing burn & touchdown' },
    { name: 'Orbit Insert', tPlus: 1920, icon: '🌍', desc: 'Payload in target orbit' },
    { name: 'Mission Complete', tPlus: 3600, icon: '✅', desc: 'All objectives achieved' },
]

// Generic phases for non-SpaceX
const GENERIC_PHASES = [
    { name: 'Pre-Launch', tPlus: -Infinity, icon: '🔧', desc: 'Vehicle preparation' },
    { name: 'Liftoff', tPlus: 0, icon: '🔥', desc: 'Engine ignition and liftoff' },
    { name: 'Max-Q', tPlus: 80, icon: '💨', desc: 'Maximum dynamic pressure' },
    { name: 'Stage Sep', tPlus: 180, icon: '✂️', desc: 'Stage separation' },
    { name: 'Orbit Insert', tPlus: 600, icon: '🌍', desc: 'Orbit insertion' },
    { name: 'Mission Complete', tPlus: 3600, icon: '✅', desc: 'Mission complete' },
]

function getTelemetry(tPlusSeconds, isSpaceX) {
    if (tPlusSeconds < 0) return { speed: 0, altitude: 0, downrange: 0 }
    const t = tPlusSeconds
    // Simplified Falcon 9 flight profile approximation
    if (isSpaceX) {
        if (t <= 156) { // First stage burn
            const frac = t / 156
            return {
                speed: Math.round(frac * frac * 7200), // ~7200 km/h at Stage Sep
                altitude: Math.round(frac * 72), // ~72km at Stage Sep
                downrange: Math.round(frac * frac * 75), // ~75km downrange
            }
        } else if (t <= 510) { // Second stage burn
            // Use 1.4 power curve to simulate gradual acceleration peak
            const frac = (t - 156) / (510 - 156)
            return {
                speed: Math.round(7200 + Math.pow(frac, 1.4) * 20600), // ~27800 km/h orbital
                altitude: Math.round(72 + Math.pow(frac, 1.1) * 158), // ~230km primary orbit
                downrange: Math.round(75 + frac * 1100), // ~1175km
            }
        } else {
            return { speed: 27800, altitude: 300, downrange: 1170 }
        }
    } else {
        if (t <= 180) {
            const frac = t / 180
            return {
                speed: Math.round(frac * frac * 7000),
                altitude: Math.round(frac * 85),
                downrange: Math.round(frac * frac * 75),
            }
        } else if (t <= 600) {
            const frac = (t - 180) / (600 - 180)
            return {
                speed: Math.round(7000 + frac * 20800),
                altitude: Math.round(85 + frac * 215),
                downrange: Math.round(75 + frac * 1100),
            }
        } else {
            return { speed: 27800, altitude: 300, downrange: 1175 }
        }
    }
}

function getCurrentPhaseIndex(tPlusSeconds, phases) {
    let idx = 0
    for (let i = phases.length - 1; i >= 0; i--) {
        if (tPlusSeconds >= phases[i].tPlus) {
            idx = i
            break
        }
    }
    return idx
}

function formatTPlus(seconds) {
    if (seconds < 0) return `T-${formatDuration(-seconds)}`
    return `T+${formatDuration(seconds)}`
}

function formatDuration(s) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
}

// ── Mission Phase Timeline Component ─────────────────────────────────────────

function PhaseTimeline({ phases, currentIndex, tPlusSeconds }) {
    return (
        <div style={{ position: 'relative' }}>
            {/* Vertical line */}
            <div style={{
                position: 'absolute', left: 15, top: 0, bottom: 0, width: 2,
                background: 'var(--border)',
            }} />
            {/* Progress fill */}
            <div style={{
                position: 'absolute', left: 15, top: 0, width: 2,
                height: `${Math.min(100, ((currentIndex + 0.5) / (phases.length - 1)) * 100)}%`,
                background: 'var(--accent)',
                transition: 'height 1s ease',
                boxShadow: '0 0 8px var(--accent-glow)',
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {phases.map((phase, i) => {
                    const isActive = i === currentIndex
                    const isPast = i < currentIndex
                    const isFuture = i > currentIndex
                    return (
                        <div key={phase.name} style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '10px 0', position: 'relative',
                            opacity: isFuture ? 0.4 : 1,
                            transition: 'opacity 0.5s',
                        }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, position: 'relative', zIndex: 2, flexShrink: 0,
                                background: isActive ? 'var(--accent)' : isPast ? 'rgba(52, 211, 153, 0.15)' : 'var(--bg-surface)',
                                border: `2px solid ${isActive ? 'var(--accent)' : isPast ? 'var(--success)' : 'var(--border)'}`,
                                boxShadow: isActive ? '0 0 16px var(--accent-glow)' : 'none',
                                animation: isActive ? 'urgentPulse 2s ease-in-out infinite' : 'none',
                            }}>
                                {phase.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    margin: 0, fontSize: 13, fontWeight: isActive ? 800 : 600,
                                    color: isActive ? 'var(--accent)' : isPast ? 'var(--success)' : 'var(--text-secondary)',
                                }}>
                                    {phase.name}
                                    {isActive && <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>● LIVE</span>}
                                </p>
                                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{phase.desc}</p>
                            </div>
                            {phase.tPlus >= 0 && (
                                <span style={{
                                    fontSize: 10, fontFamily: 'var(--font-mono)',
                                    color: isPast || isActive ? 'var(--text-secondary)' : 'var(--text-muted)',
                                    flexShrink: 0,
                                }}>
                                    T+{formatDuration(phase.tPlus)}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Telemetry Display ────────────────────────────────────────────────────────

function TelemetryPanel({ telemetry, tPlusSeconds }) {
    const items = [
        { label: 'Speed', value: `${telemetry.speed.toLocaleString()} km/h`, icon: <Gauge size={14} />, color: 'var(--accent)' },
        { label: 'Altitude', value: `${telemetry.altitude} km`, icon: <Globe size={14} />, color: '#7c3aed' },
        { label: 'Downrange', value: `${telemetry.downrange} km`, icon: <MapPin size={14} />, color: '#34d399' },
        { label: 'Mission Clock', value: formatTPlus(tPlusSeconds), icon: <Clock size={14} />, color: tPlusSeconds >= 0 ? 'var(--success)' : 'var(--warning)' },
    ]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {items.map(item => (
                <div key={item.label} className="glass" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: item.color }}>
                        {item.icon}
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.color }}>
                        {item.value}
                    </p>
                </div>
            ))}
        </div>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function LiveMission() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [launch, setLaunch] = useState(null)
    const [weather, setWeather] = useState(null)
    const [loading, setLoading] = useState(true)
    const [now, setNow] = useState(Date.now())
    const [updates, setUpdates] = useState([])

    useEffect(() => {
        const fetchMission = () => {
            api.get(`/launches/${id}/`)
                .then(res => {
                    setLaunch(res.data)
                    return Promise.all([
                        api.get(`/launches/${id}/pad-weather/`).catch(() => ({ data: null })),
                        api.get(`/launches/${id}/updates/`).catch(() => ({ data: [] })),
                    ])
                })
                .then(([weatherRes, updatesRes]) => {
                    if (weatherRes?.data) setWeather(weatherRes.data)
                    setUpdates(Array.isArray(updatesRes?.data) ? updatesRes.data : [])
                })
                .catch(() => { })
                .finally(() => setLoading(false))
        }

        setLoading(true)
        fetchMission()

        // Poll every 15 seconds for live updates
        const dataInterval = setInterval(fetchMission, 15000)
        // Update clock every second for telemetry
        const clockInterval = setInterval(() => setNow(Date.now()), 1000)

        return () => { clearInterval(dataInterval); clearInterval(clockInterval) }
    }, [id])

    const isSpaceX = useMemo(() => {
        if (!launch) return false
        return (launch.launch_provider || '').toLowerCase().includes('spacex') ||
               (launch.rocket || '').toLowerCase().includes('falcon')
    }, [launch])

    const phases = isSpaceX ? F9_PHASES : GENERIC_PHASES

    const tPlusSeconds = useMemo(() => {
        if (!launch?.launch_date) return -Infinity
        return (now - new Date(launch.launch_date).getTime()) / 1000
    }, [launch, now])

    const currentPhaseIndex = useMemo(() => getCurrentPhaseIndex(tPlusSeconds, phases), [tPlusSeconds, phases])
    const telemetry = useMemo(() => getTelemetry(tPlusSeconds, isSpaceX), [tPlusSeconds, isSpaceX])

    const launchStatus = (launch?.status || '').toLowerCase()
    const isUpcoming = launch?.launch_date && new Date(launch.launch_date) > new Date()
    
    // Active if in flight, or if it's within 3 hours post-launch
    const isActive = (tPlusSeconds >= -300 && tPlusSeconds < 10800) || launchStatus.includes('in flight')
    
    // Only complete if it's been 3 hours AND it wasn't marked as upcoming/hold
    const isComplete = tPlusSeconds >= 10800 && !isUpcoming && !launchStatus.includes('hold') && !launchStatus.includes('tbd')

    if (loading && !launch) return <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
    if (!launch) return <div className="page-container" style={{ paddingTop: 100 }}><h2>Launch not found</h2></div>

    let ytId = null
    let isX = false
    if (launch.webcast_url) {
        const url = launch.webcast_url.toLowerCase()
        if (url.includes('v=')) ytId = launch.webcast_url.split('v=')[1]?.split('&')[0]
        else if (url.includes('youtu.be/')) ytId = launch.webcast_url.split('youtu.be/')[1]?.split('?')[0]
        else if (url.includes('twitter.com') || url.includes('x.com')) isX = true
    }

    return (
        <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
            <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
                <ArrowLeft size={16} /> Back
            </button>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }} className="fade-up">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        {isActive && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 800,
                                background: 'rgba(248, 113, 113, 0.15)', color: '#f87171',
                                border: '1px solid rgba(248, 113, 113, 0.3)',
                                fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                                animation: 'urgentPulse 2s ease-in-out infinite',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
                                LIVE
                            </span>
                        )}
                        <span className={`badge ${isComplete ? 'badge-success' : isActive ? 'badge-go' : 'badge-hold'}`}>
                            {launch.status || (isComplete ? 'Complete' : isActive ? 'In Flight' : 'Upcoming')}
                        </span>
                    </div>
                    <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>{launch.name}</h1>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>{launch.launch_provider}</span>
                        {launch.rocket && (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Rocket size={12} /> {launch.rocket}
                            </span>
                        )}
                    </div>
                </div>

                {isUpcoming && (
                    <div className="glass" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>T-Minus</p>
                        <CountdownTimer targetDate={launch.launch_date} />
                    </div>
                )}

                {isActive && (
                    <div className="glass" style={{ padding: '12px 20px', textAlign: 'center', border: '1px solid var(--accent)' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Mission Clock</p>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                            {formatTPlus(tPlusSeconds)}
                        </p>
                    </div>
                )}
            </div>

            {/* Main grid: Video + Telemetry / Phases + Weather */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }} className="fade-up">
                {/* Left Column: Video + Telemetry */}
                <div>
                    {/* Video Player */}
                    <div className="glass" style={{ overflow: 'hidden', padding: 0, marginBottom: 20 }}>
                        {ytId ? (
                            <iframe
                                width="100%" height="420"
                                src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1`}
                                title="Launch webcast" frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ display: 'block', border: 'none' }}
                            />
                        ) : isX ? (
                            <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a1428, #1c1c1c)', color: '#fff', flexDirection: 'column', gap: 20, textAlign: 'center', padding: 40 }}>
                                <div style={{ background: '#000', width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z"/></svg>
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>SpaceX Live on X</h3>
                                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', maxWidth: 350 }}>SpaceX now primarily broadcasts live on X. Standard embedding is not supported, but you can join the live feed below.</p>
                                </div>
                                <a 
                                    href={launch.webcast_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="btn btn-primary"
                                    style={{ background: '#fff', color: '#000', border: 'none', fontWeight: 800, padding: '12px 28px' }}
                                >
                                    OPEN LIVE FEED ON X
                                </a>
                            </div>
                        ) : (
                            <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a1428, #150d2e)', color: 'var(--text-muted)', flexDirection: 'column', gap: 12 }}>
                                <Radio size={32} strokeWidth={1} />
                                <span style={{ fontSize: 14 }}>{isUpcoming ? 'Webcast will appear here closer to launch' : 'No webcast available'}</span>
                            </div>
                        )}
                        <div style={{ padding: 24 }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700 }}>Mission Briefing</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                                {launch.mission_description || 'No detailed mission description available.'}
                            </p>
                        </div>
                    </div>

                    {/* Telemetry Panel - only during active mission */}
                    {(isActive || isComplete) && (
                        <div style={{ marginBottom: 20 }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Activity size={14} color="var(--accent)" /> Flight Telemetry {isSpaceX ? '(Falcon 9 Profile)' : '(Estimated)'}
                            </h3>
                            <TelemetryPanel telemetry={telemetry} tPlusSeconds={tPlusSeconds} />
                        </div>
                    )}

                    {/* Live Updates */}
                    {updates.length > 0 && (
                        <div className="glass" style={{ padding: '20px 24px', border: '1px solid var(--accent)' }}>
                            <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Activity size={14} /> Live Updates
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {updates.slice(0, 5).map(update => (
                                    <div key={update.id} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
                                        <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                            {update.comment}
                                        </p>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {new Date(update.created_on).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Phase Tracker + Weather + Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 80 }}>
                    {/* Mission Phase Tracker */}
                    <div className="glass" style={{ padding: '22px 24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Rocket size={14} color="var(--accent)" /> Mission Phases
                            {isSpaceX && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'auto' }}>Falcon 9</span>}
                        </h3>
                        <PhaseTimeline phases={phases} currentIndex={currentPhaseIndex} tPlusSeconds={tPlusSeconds} />
                    </div>

                    {/* Pad Weather */}
                    <div className="glass" style={{ padding: '22px 24px' }}>
                        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                            <Thermometer size={18} color="var(--accent)" /> Pad Weather
                        </h3>
                        {weather?.available ? (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{weather.temp_c}°C</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{weather.description}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: weather.overall === 'GO' ? 'var(--success)' : 'var(--warning)' }}>
                                            {weather.overall}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{weather.go_count}/{weather.total_rules} GO</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {weather.rules?.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>{r.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.value}</span>
                                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.go ? 'var(--success)' : 'var(--danger)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Weather data unavailable</div>
                        )}
                    </div>

                    {/* Launch Details */}
                    <div className="glass" style={{ padding: '22px 24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>Launch Info</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'Orbit', value: launch.orbit },
                                { label: 'Pad', value: launch.pad_name },
                                { label: 'Location', value: launch.pad_location },
                                { label: 'Mission Type', value: launch.mission_type },
                            ].filter(r => r.value).map(r => (
                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}