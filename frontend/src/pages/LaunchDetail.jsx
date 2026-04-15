import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, MapPin, Globe, Radio, Rocket, Play, Share2, Bell, BellOff, Activity, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import CountdownTimer from '../components/CountdownTimer'
import LogModal from '../components/LogModal'
import ShareCard from '../components/ShareCard'
import WeatherWidget from '../components/WeatherWidget'
import { useNotifications } from '../hooks/useNotifications'
import toast from 'react-hot-toast'
import { getStatusClass } from '../utils/status'

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

// ── Prediction Widget ────────────────────────────────────────────────────────

function PredictionWidget({ apiId }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)

  useEffect(() => {
    api.get(`/watchlist/predictions/${apiId}/`)
      .then(({ data }) => setData(data))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [apiId])

  const vote = async (prediction) => {
    if (!user) { toast.error('Sign in to vote'); return }
    if (voting) return
    setVoting(true)
    try {
      await api.post(`/watchlist/predictions/${apiId}/`, { prediction })
      // Refetch counts
      const { data: fresh } = await api.get(`/watchlist/predictions/${apiId}/`)
      setData(fresh)
      toast.success('Vote recorded!')
    } catch {
      toast.error('Failed to record vote')
    } finally {
      setVoting(false)
    }
  }

  if (loading || !data) return null

  const total = (data.on_time || 0) + (data.delayed || 0) + (data.scrubbed || 0)
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0

  const options = [
    { key: 'on_time', label: 'On Time', icon: <ThumbsUp size={13} />, color: 'var(--success)' },
    { key: 'delayed', label: 'Delayed', icon: <Minus size={13} />, color: 'var(--amber)' },
    { key: 'scrubbed', label: 'Scrubbed', icon: <ThumbsDown size={13} />, color: 'var(--danger)' },
  ]

  return (
    <div className="glass" style={{ padding: '18px 22px', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Community Prediction
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
        Will this launch happen as scheduled?
        {total > 0 && <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>({total} vote{total !== 1 ? 's' : ''})</span>}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(opt => {
          const count = data[opt.key] || 0
          const percent = pct(count)
          const isMyVote = data.user_vote === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => vote(opt.key)}
              disabled={voting}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: isMyVote ? `color-mix(in srgb, ${opt.color} 12%, transparent)` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isMyVote ? opt.color : 'var(--border)'}`,
                borderRadius: 8,
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'border-color 0.2s',
                textAlign: 'left',
              }}
            >
              {/* progress fill */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percent}%`, background: `color-mix(in srgb, ${opt.color} 8%, transparent)`, transition: 'width 0.5s ease', pointerEvents: 'none' }} />
              <span style={{ color: opt.color, flexShrink: 0 }}>{opt.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isMyVote ? 700 : 400, color: 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{percent}%</span>
              {isMyVote && <span style={{ fontSize: 10, color: opt.color, fontWeight: 700 }}>✓ Your vote</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LaunchDetail() {
  const { api_id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addReminder, removeReminder, hasReminder } = useNotifications()

  const [launch, setLaunch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watchlistId, setWatchlistId] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [logs, setLogs] = useState([])
  const [reminded, setReminded] = useState(false)
  const [updates, setUpdates] = useState([])

  useEffect(() => {
    setLoading(true)
    api.get(`/launches/${api_id}/`)
      .then(({ data }) => {
        setLaunch(data)
        setReminded(hasReminder(api_id))

        api.get(`/launches/${api_id}/updates/`)
          .then(res => setUpdates(Array.isArray(res.data) ? res.data : []))
          .catch(() => { })
      })
      .catch(() => toast.error('Launch not found'))
      .finally(() => setLoading(false))
  }, [api_id])

  useEffect(() => {
    if (!user) return

    // Filter by launch_api_id to avoid pagination issues
    api.get('/watchlist/', { params: { launch_api_id: api_id } })
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.results ?? []
        if (items.length > 0) setWatchlistId(items[0].id)
      })
      .catch(() => { })

    api.get('/watchlist/logs/')
      .then(({ data }) => {
        const items = Array.isArray(data) ? data : data.results ?? []
        setLogs(items.filter(l => l.launch?.api_id === api_id))
      })
      .catch(() => { })
  }, [user, api_id])

  const toggleWatchlist = async () => {
    if (!user) return navigate('/login')
    try {
      if (watchlistId) {
        await api.delete(`/watchlist/${watchlistId}/`)
        setWatchlistId(null)
        toast.success('Removed from watchlist')
      } else {
        const { data } = await api.post('/watchlist/', { launch_api_id: api_id })
        // Backend returns {id, already_saved: true} for duplicates OR normal entry
        setWatchlistId(data.id)
        if (data.already_saved) {
          toast('Already in your watchlist', { icon: '🔖' })
        } else {
          toast.success('Saved to watchlist')
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.launch_api_id || 'Action failed'
      toast.error(typeof msg === 'string' ? msg : 'Action failed')
    }
  }

  const toggleReminder = () => {
    if (reminded) {
      removeReminder(api_id)
      setReminded(false)
    } else {
      addReminder(launch).then(ok => { if (ok) setReminded(true) })
    }
  }

  if (loading) return (
    <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
  if (!launch) return (
    <div className="page-container" style={{ paddingTop: 100, textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Launch not found.</p>
      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Back to launches</button>
    </div>
  )

  const isUpcoming = launch.launch_date && new Date(launch.launch_date) > new Date()
  const status = (launch.status || '').toLowerCase()
  const isSuccess = status.includes('success')
  const isFail = status.includes('fail')
  const isActive = status.includes('in flight') || status.includes('inflight') ||
    (launch.launch_date && new Date(launch.launch_date) < new Date() &&
     (Date.now() - new Date(launch.launch_date).getTime()) < 10800000 && // 3 hours
     !status.includes('fail'))

  const ytId = getYouTubeId(launch.webcast_url)

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Hero banner */}
      <div className="detail-hero">
        {launch.image_url ? (
          <img src={launch.image_url} alt={launch.name} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0a1428, #150d2e, #0a1428)' }} />
        )}
        <div className="detail-hero-gradient" />
      </div>

      <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          {/* Left column: main content */}
          <div style={{ flex: '1 1 600px', minWidth: 0 }}>
            {/* Header info */}
            <div style={{ marginBottom: 24 }} className="fade-up">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span className={`badge ${getStatusClass(launch.status)}`}>{launch.status || 'Unknown'}</span>
                {isActive && (
                  <span className="badge badge-accent" style={{ animation: 'pulse 2s infinite' }}>
                    <Radio size={10} /> Live Now
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 32, margin: '0 0 8px', lineHeight: 1.1 }}>{launch.name}</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
                {launch.launch_provider} • {launch.pad_name}
              </p>
            </div>

            {/* Countdown for upcoming */}
            {isUpcoming && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="glass" style={{ padding: '18px 22px', display: 'inline-block' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    T-Minus
                  </p>
                  <CountdownTimer targetDate={launch.launch_date} large />
                </div>
                
                {/* Prominent Watch Now Button */}
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate(`/live/${launch.api_id}`)}
                  style={{ 
                    height: 98, padding: '0 32px', fontSize: 16, fontWeight: 800,
                    display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
                    background: 'var(--gradient-brand)', border: 'none',
                    animation: 'urgentPulse 2s ease-in-out infinite',
                    boxShadow: '0 10px 30px rgba(0, 212, 255, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Radio size={20} /> WATCH NOW
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>Enter Live Tracker</span>
                </button>
              </div>
            )}

            {/* At a Glance */}
            <div className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                At a Glance
              </h3>
              <div className="info-grid">
                <InfoRow icon={<Rocket size={13} />} label="Rocket" value={launch.rocket} />
                <InfoRow icon={<Globe size={13} />} label="Provider" value={launch.launch_provider} />
                <InfoRow icon={<MapPin size={13} />} label="Pad" value={launch.pad_name} />
                <InfoRow icon={<MapPin size={13} />} label="Location" value={launch.pad_location} />
                <InfoRow icon={<Radio size={13} />} label="Orbit" value={launch.orbit} />
                <InfoRow label="Date" value={launch.launch_date ? format(new Date(launch.launch_date), 'MMM d, yyyy - HH:mm z') : 'TBD'} />
                {!isUpcoming && launch.launch_date && (
                  <InfoRow label="Time ago" value={formatDistanceToNow(new Date(launch.launch_date), { addSuffix: true })} />
                )}
              </div>
            </div>

            {/* Launch pad weather (upcoming only) */}
            {isUpcoming && (
              <WeatherWidget apiId={api_id} padName={launch.pad_name} />
            )}

            {/* Community prediction (upcoming only) */}
            {isUpcoming && <PredictionWidget apiId={api_id} isUpcoming={isUpcoming} />}

            {/* Live Updates */}
            {updates.length > 0 && (
              <div className="glass" style={{ padding: '20px 24px', marginBottom: 18, border: '1px solid var(--accent)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} /> Live Updates
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {updates.map(update => (
                    <div key={update.id} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.5, color: 'var(--text-main)' }}>
                        {update.comment}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        <span>{format(new Date(update.created_on), 'MMM d, HH:mm')}</span>
                        {update.info_url && (
                          <a href={update.info_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Source</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payload & Mission */}
            {launch.mission_description && (
              <div className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Payload & Mission Brief
                </h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {launch.mission_type && <span className="badge badge-default">{launch.mission_type}</span>}
                  {launch.orbit && <span className="badge badge-go">{launch.orbit}</span>}
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 13 }}>
                  {launch.mission_description}
                </p>
              </div>
            )}

            {/* External links */}
            {(launch.webcast_url || launch.wiki_url) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {launch.webcast_url && (
                  <a href={launch.webcast_url} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                    <Play size={13} /> Watch Launch
                  </a>
                )}
                {launch.wiki_url && (
                  <a href={launch.wiki_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <ExternalLink size={13} /> Wikipedia
                  </a>
                )}
              </div>
            )}

            {/* Mission logs */}
            {user && logs.length > 0 && (
              <div className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Your Mission Log
                </h3>
                {logs.map(log => (
                  <div key={log.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>{log.title}</h4>
                    <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{log.body}</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy - HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column: media and actions */}
          <div className="fade-up" style={{ animationDelay: '60ms' }}>
            {ytId && (
              <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: '#000', border: '1px solid var(--border)' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title="Launch webcast"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            )}

            {launch.infographic_url && (
              <div className="glass" style={{ overflow: 'hidden', marginBottom: 16 }}>
                <img src={launch.infographic_url} alt="Mission infographic" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'sticky', top: 80 }}>
              <button
                className={`btn ${watchlistId ? 'btn-primary' : 'btn-ghost'}`}
                onClick={toggleWatchlist}
                style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}
              >
                {watchlistId ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                {watchlistId ? 'Saved to Watchlist' : 'Save to Watchlist'}
              </button>

              {isUpcoming && (
                <button className={`btn ${reminded ? 'btn-accent' : 'btn-ghost'}`} onClick={toggleReminder} style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}>
                  {reminded ? <BellOff size={14} /> : <Bell size={14} />}
                  {reminded ? 'Reminder Set' : 'Remind Me'}
                </button>
              )}

              <button className="btn btn-ghost" onClick={() => setShowShareCard(true)} style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}>
                <Share2 size={14} /> Share Card
              </button>

              {user && (
                <button className="btn btn-ghost" onClick={() => setShowLogModal(true)} style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}>
                  Write a Log
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showLogModal && (
        <LogModal
          launch={launch}
          onClose={() => setShowLogModal(false)}
          onSaved={(newLog) => { setLogs(prev => [...prev, newLog]); setShowLogModal(false) }}
        />
      )}

      {showShareCard && (
        <ShareCard launch={launch} onClose={() => setShowShareCard(false)} />
      )}
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="info-row">
      <span className="info-label">{icon} {label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}
