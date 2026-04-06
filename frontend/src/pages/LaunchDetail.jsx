import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, MapPin, Globe, Radio, Rocket, Play, Share2, Bell, BellOff, Activity } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import CountdownTimer from '../components/CountdownTimer'
import LogModal from '../components/LogModal'
import ShareCard from '../components/ShareCard'
import { useNotifications } from '../hooks/useNotifications'
import toast from 'react-hot-toast'

function getStatusBadge(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go') || s.includes('green')) return 'badge-go'
  if (s.includes('hold') || s.includes('tbd') || s.includes('tbc')) return 'badge-hold'
  if (s.includes('fail')) return 'badge-failure'
  if (s.includes('success')) return 'badge-success'
  return 'badge-default'
}

function getYouTubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

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
          .catch(() => {})
      })
      .catch(() => toast.error('Launch not found'))
      .finally(() => setLoading(false))
  }, [api_id])

  useEffect(() => {
    if (!user) return
    api.get('/watchlist/').then(({ data }) => {
      const items = Array.isArray(data) ? data : data.results ?? []
      const entry = items.find(e => e.launch?.api_id === api_id)
      if (entry) setWatchlistId(entry.id)
    }).catch(() => {})

    api.get('/watchlist/logs/').then(({ data }) => {
      const items = Array.isArray(data) ? data : data.results ?? []
      setLogs(items.filter(l => l.launch?.api_id === api_id))
    }).catch(() => {})
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
        setWatchlistId(data.id)
        toast.success('Saved to watchlist')
      }
    } catch { toast.error('Action failed') }
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

        <div className="detail-layout">
          {/* Left column: mission intel */}
          <div className="fade-up">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${getStatusBadge(launch.status)}`}>{launch.status || 'Unknown'}</span>
              {launch.mission_type && <span className="badge badge-default">{launch.mission_type}</span>}
            </div>

            <h1 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              {launch.name}
            </h1>
            <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
              {[launch.launch_provider, launch.rocket].filter(Boolean).join(' / ')}
            </p>

            {/* Countdown for upcoming */}
            {isUpcoming && (
              <div className="glass" style={{ padding: '18px 22px', marginBottom: 20, display: 'inline-block' }}>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  T-Minus
                </p>
                <CountdownTimer targetDate={launch.launch_date} large />
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

            {/* Mission Brief */}
            {launch.mission_description && (
              <div className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Mission Brief
                </h3>
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
              <button className={`btn ${watchlistId ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleWatchlist} style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}>
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
