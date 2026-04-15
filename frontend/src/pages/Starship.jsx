import { useState, useEffect } from 'react'
import { CheckCircle2, Clock, Cloud, Thermometer, Wind, Rocket, Info, Calendar } from 'lucide-react'
import api from '../api/axios'
import LaunchCard from '../components/LaunchCard'

export default function Starship() {
  const [nextFlight, setNextFlight] = useState(null)
  const [recentTests, setRecentTests] = useState([])
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTests, setLoadingTests] = useState(true)
  const [starbaseTime, setStarbaseTime] = useState('')
  const [weather, setWeather] = useState({ temp: '--', condition: 'Loading...', wind: '--' })

  useEffect(() => {
    // 1. Fetch Starship specifically
    api.get('/launches/upcoming/', { params: { source: 'spacex' } })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results ?? []
        const starship = list.find(l => (l.rocket || '').toLowerCase().includes('starship') || (l.name || '').toLowerCase().includes('starship'))
        setNextFlight(starship)
      })
      .finally(() => setLoading(false))

    // 2. Fetch Recent Tests and Dynamic Checklist
    api.get('/launches/starship-tests/')
      .then(({ data }) => {
        setRecentTests(data.videos || [])
        setChecklist(data.checklist || [])
      })
      .catch(() => {})
      .finally(() => setLoadingTests(false))

    // 3. Starbase Time (Central Time)
    const updateTime = () => {
      const options = { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }
      setStarbaseTime(new Intl.DateTimeFormat('en-US', options).format(new Date()))
    }
    updateTime()
    const timeId = setInterval(updateTime, 1000)

    // 4. Simulated Weather for Boca Chica
    setWeather({ temp: '78°F', condition: 'Clear Skies', wind: '12 mph SE' })

    return () => clearInterval(timeId)
  }, [])

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 800 }}>
          Starship <span style={{ color: 'var(--accent)' }}>Tracker</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          24/7 Monitoring of Starbase, Boca Chica, Texas
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Left Column: Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="glass" style={{ overflow: 'hidden', borderRadius: 20, border: '1px solid var(--border)', position: 'relative', paddingTop: '56.25%', background: '#000' }}>
            <iframe 
              src="https://www.youtube.com/embed/mhJRzQsLZGg?autoplay=1&mute=1" 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              title="Starbase Live Stream"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            />
          </div>

          {/* Next Flight Info */}
          <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Rocket size={20} className="text-accent" />
              <h2 style={{ margin: 0, fontSize: 18 }}>Next Starship Flight</h2>
            </div>
            
            {loading ? (
              <div className="spinner" style={{ margin: '20px auto' }} />
            ) : nextFlight ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>{nextFlight.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                    <Calendar size={14} />
                    {new Date(nextFlight.launch_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <a href={`/launch/${nextFlight.api_id}`} className="btn btn-primary">Mission Details</a>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No upcoming flight data currently available.</p>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Starbase Info */}
          <div className="glass" style={{ padding: 24, borderRadius: 20, background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.05), transparent)' }}>
            <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16, letterSpacing: '0.05em' }}>Starbase Live Stats</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={20} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{starbaseTime}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Local Time (Central)</div>
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Thermometer size={16} style={{ color: 'var(--amber)' }} />
                  <span style={{ fontSize: 14 }}>{weather.temp}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Cloud size={16} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: 14 }}>{weather.condition}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: 'span 2' }}>
                  <Wind size={16} style={{ color: 'var(--cyan)' }} />
                  <span style={{ fontSize: 14 }}>{weather.wind}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="glass" style={{ padding: 24, borderRadius: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <CheckCircle2 size={18} className="text-accent" />
              <h3 style={{ margin: 0, fontSize: 16 }}>Flight Preparation</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {checklist.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: item.status === 'complete' ? 1 : 0.6 }}>
                  <div style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: '50%', 
                    border: '2px solid', 
                    borderColor: item.status === 'complete' ? 'var(--success)' : 'var(--text-muted)',
                    background: item.status === 'complete' ? 'var(--success)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {item.status === 'complete' && <CheckCircle2 size={12} color="#000" />}
                  </div>
                  <span style={{ fontSize: 13, textDecoration: item.status === 'complete' ? 'line-through' : 'none', color: item.status === 'complete' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {item.task}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 10 }}>
              <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Status is based on public NOTAMs, road closures, and NSF observations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tests Section */}
      <div className="fade-up" style={{ marginTop: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, background: 'rgba(248,113,113,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(248,113,113,0.2)' }}>
            <Clock size={20} style={{ color: '#f87171' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Recent Starbase Tests</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Latest updates from NASA Spaceflight</p>
          </div>
        </div>

        {loadingTests ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass" style={{ height: 200, borderRadius: 16, animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : recentTests.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {recentTests.map((test) => (
              <a 
                key={test.id} 
                href={test.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="glass" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  borderRadius: 16, 
                  overflow: 'hidden', 
                  textDecoration: 'none', 
                  color: 'inherit',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                  <img 
                    src={test.thumbnail} 
                    alt="" 
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: '#fff' }}>
                    YOUTUBE
                  </div>
                </div>
                <div style={{ padding: 16 }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.4, fontWeight: 700, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {test.title}
                  </h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {new Date(test.published).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="glass" style={{ padding: 40, textAlign: 'center', borderRadius: 20 }}>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No recent test videos found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
