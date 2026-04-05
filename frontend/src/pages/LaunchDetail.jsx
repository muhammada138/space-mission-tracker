import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, MapPin, Globe, Radio, Rocket, Play } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import CountdownTimer from '../components/CountdownTimer'
import LogModal from '../components/LogModal'
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
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const match = url.match(p)
    if (match) return match[1]
  }
  return null
}

export default function LaunchDetail() {
  const { api_id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [launch, setLaunch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watchlistId, setWatchlistId] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    setLoading(true)
    api.get(`/launches/${api_id}/`)
      .then(({ data }) => setLaunch(data))
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
      <div style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(220px, 35vh, 360px)',
        overflow: 'hidden',
        marginBottom: -40,
      }}>
        {launch.image_url ? (
          <img
            src={launch.image_url}
            alt={launch.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 30%',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0d1729, #150d2e, #0d1729)',
          }} />
        )}
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(transparent 20%, var(--bg-base) 95%)',
        }} />
      </div>

      <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
        {/* Back button */}
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="detail-layout">
          {/* Left column */}
          <div className="fade-up">
            {/* Status + badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span className={`badge ${getStatusBadge(launch.status)}`}>{launch.status || 'Unknown'}</span>
              {launch.mission_type && (
                <span className="badge badge-default">{launch.mission_type}</span>
              )}
            </div>

            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 8px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              {launch.name}
            </h1>

            <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 15 }}>
              {[launch.launch_provider, launch.rocket].filter(Boolean).join(' / ')}
            </p>

            {/* Countdown for upcoming */}
            {isUpcoming && (
              <div className="glass" style={{ padding: '20px 24px', marginBottom: 24, display: 'inline-block' }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  T-minus
                </p>
                <CountdownTimer targetDate={launch.launch_date} large />
              </div>
            )}

            {/* Info grid */}
            <div className="glass" style={{ padding: '22px 26px', marginBottom: 22 }}>
              <div className="info-grid">
                <InfoRow icon={<Rocket size={14} />} label="Rocket" value={launch.rocket} />
                <InfoRow icon={<Globe size={14} />} label="Provider" value={launch.launch_provider} />
                <InfoRow icon={<MapPin size={14} />} label="Launch Pad" value={launch.pad_name} />
                <InfoRow icon={<MapPin size={14} />} label="Location" value={launch.pad_location} />
                <InfoRow icon={<Radio size={14} />} label="Orbit" value={launch.orbit} />
                <InfoRow
                  label="Date"
                  value={launch.launch_date ? format(new Date(launch.launch_date), 'MMM d, yyyy - HH:mm z') : 'TBD'}
                />
                {!isUpcoming && launch.launch_date && (
                  <InfoRow
                    label="Time ago"
                    value={formatDistanceToNow(new Date(launch.launch_date), { addSuffix: true })}
                  />
                )}
              </div>
            </div>

            {/* Mission description */}
            {launch.mission_description && (
              <div className="glass" style={{ padding: '22px 26px', marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mission Details
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: 14 }}>
                  {launch.mission_description}
                </p>
              </div>
            )}

            {/* External links */}
            {(launch.webcast_url || launch.wiki_url) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                {launch.webcast_url && (
                  <a href={launch.webcast_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <Play size={14} /> Watch Launch
                  </a>
                )}
                {launch.wiki_url && (
                  <a href={launch.wiki_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <ExternalLink size={14} /> Wikipedia
                  </a>
                )}
              </div>
            )}

            {/* Mission logs */}
            {user && logs.length > 0 && (
              <div className="glass" style={{ padding: '22px 26px', marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Your Mission Logs
                </h3>
                {logs.map(log => (
                  <div key={log.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{log.title}</h4>
                    <p style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>{log.body}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy - HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            {/* YouTube embed */}
            {ytId && (
              <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 14, overflow: 'hidden', marginBottom: 18, background: '#000', border: '1px solid var(--border)' }}>
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
              <div className="glass" style={{ overflow: 'hidden', marginBottom: 18 }}>
                <img
                  src={launch.infographic_url}
                  alt="Mission infographic"
                  style={{ width: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className={`btn ${watchlistId ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleWatchlist} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}>
                {watchlistId ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                {watchlistId ? 'Saved to Watchlist' : 'Save to Watchlist'}
              </button>
              {user && (
                <button className="btn btn-ghost" onClick={() => setShowLogModal(true)} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px' }}>
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
          onSaved={(newLog) => {
            setLogs(prev => [...prev, newLog])
            setShowLogModal(false)
          }}
        />
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
