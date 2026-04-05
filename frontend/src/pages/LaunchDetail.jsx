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

  // Check watchlist status
  useEffect(() => {
    if (!user) return
    api.get('/watchlist/').then(({ data }) => {
      const items = Array.isArray(data) ? data : data.results ?? []
      const entry = items.find(e => e.launch?.api_id === api_id)
      if (entry) setWatchlistId(entry.id)
    }).catch(() => {})

    // Fetch logs for this launch
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

  return (
    <div className="page-container" style={{ paddingTop: 32, paddingBottom: 80 }}>
      {/* Back button */}
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 24 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className="detail-layout">
        {/* Left column */}
        <div className="fade-up">
          {/* Status + countdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className={`badge ${getStatusBadge(launch.status)}`}>{launch.status || 'Unknown'}</span>
            {launch.mission_type && (
              <span className="badge badge-default">{launch.mission_type}</span>
            )}
          </div>

          <h1 style={{ fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 }}>
            {launch.name}
          </h1>

          {/* Provider + Rocket */}
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 15 }}>
            {[launch.launch_provider, launch.rocket].filter(Boolean).join(' / ')}
          </p>

          {/* Countdown for upcoming */}
          {isUpcoming && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                T-minus
              </p>
              <CountdownTimer targetDate={launch.launch_date} />
            </div>
          )}

          {/* Info grid */}
          <div className="glass" style={{ padding: '20px 24px', marginBottom: 20 }}>
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
            <div className="glass" style={{ padding: '20px 24px', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Mission Details
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>
                {launch.mission_description}
              </p>
            </div>
          )}

          {/* External links */}
          {(launch.webcast_url || launch.wiki_url) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
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
            <div className="glass" style={{ padding: '20px 24px', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Your Mission Logs
              </h3>
              {logs.map(log => (
                <div key={log.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{log.title}</h4>
                  <p style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{log.body}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {format(new Date(log.created_at), 'MMM d, yyyy - HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column - image + actions */}
        <div className="fade-up" style={{ animationDelay: '80ms' }}>
          {launch.image_url ? (
            <img
              src={launch.image_url}
              alt={launch.name}
              style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'cover', aspectRatio: '16/10' }}
            />
          ) : (
            <div style={{
              width: '100%', aspectRatio: '16/10', borderRadius: 12, marginBottom: 16,
              background: 'linear-gradient(135deg, #111827, #1a1030)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48
            }}>
              🚀
            </div>
          )}

          {launch.infographic_url && (
            <img
              src={launch.infographic_url}
              alt="Mission infographic"
              style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'contain' }}
            />
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className={`btn ${watchlistId ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleWatchlist} style={{ width: '100%', justifyContent: 'center' }}>
              {watchlistId ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {watchlistId ? 'Saved to Watchlist' : 'Save to Watchlist'}
            </button>
            {user && (
              <button className="btn btn-ghost" onClick={() => setShowLogModal(true)} style={{ width: '100%', justifyContent: 'center' }}>
                Write a Log
              </button>
            )}
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
