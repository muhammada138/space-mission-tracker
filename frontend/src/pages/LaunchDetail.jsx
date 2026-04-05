import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Bookmark, BookmarkCheck, NotebookPen, ExternalLink } from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import CountdownTimer from '../components/CountdownTimer'
import LogModal from '../components/LogModal'
import toast from 'react-hot-toast'

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go'))      return 'badge badge-go'
  if (s.includes('hold'))    return 'badge badge-hold'
  if (s.includes('success')) return 'badge badge-success'
  if (s.includes('fail'))    return 'badge badge-failure'
  return 'badge badge-default'
}

export default function LaunchDetail() {
  const { api_id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [launch, setLaunch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [watchlistId, setWatchlistId] = useState(null)
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [myLog, setMyLog] = useState(null)

  const isPast = launch?.launch_date && new Date(launch.launch_date) < new Date()

  useEffect(() => {
    api.get(`/launches/${api_id}/`)
      .then(({ data }) => setLaunch(data))
      .catch(() => toast.error('Launch not found'))
      .finally(() => setLoading(false))
  }, [api_id])

  // Check if already in watchlist
  useEffect(() => {
    if (!user || !launch) return
    api.get('/watchlist/').then(({ data }) => {
      const results = Array.isArray(data) ? data : data.results ?? []
      const entry = results.find(e => e.launch.api_id === api_id)
      if (entry) setWatchlistId(entry.id)
    }).catch(() => {})

    api.get('/watchlist/logs/').then(({ data }) => {
      const results = Array.isArray(data) ? data : data.results ?? []
      const log = results.find(l => l.launch.api_id === api_id)
      if (log) setMyLog(log)
    }).catch(() => {})
  }, [user, launch, api_id])

  const toggleWatchlist = async () => {
    if (!user) { toast.error('Log in to save missions'); return }
    setWatchlistLoading(true)
    try {
      if (watchlistId) {
        await api.delete(`/watchlist/${watchlistId}/`)
        setWatchlistId(null)
        toast.success('Removed from watchlist')
      } else {
        const { data } = await api.post('/watchlist/', { launch_api_id: api_id })
        setWatchlistId(data.id)
        toast.success('Saved to watchlist! 🎯')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally {
      setWatchlistLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
      <div className="spinner" />
    </div>
  )

  if (!launch) return (
    <div className="empty-state" style={{ paddingTop: 120 }}>
      <div className="icon">🚀</div>
      <p>Launch not found.</p>
      <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginTop: 16 }}>Back to launches</button>
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 40, paddingBottom: 80 }}>
      {/* Back */}
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 32, fontSize: 13 }}>
        <ArrowLeft size={15} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>
        {/* Left - main info */}
        <div className="fade-up">
          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            <span className={statusBadgeClass(launch.status)}>{launch.status || 'Unknown'}</span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1.2 }}>{launch.name}</h1>
          <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 15 }}>
            {[launch.launch_provider, launch.rocket].filter(Boolean).join(' · ')}
          </p>

          {/* Countdown or date */}
          {launch.launch_date && (
            <div style={{ marginBottom: 32 }}>
              {isPast ? (
                <div className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 20px' }}>
                  <span style={{ color: 'var(--success)', fontSize: 18 }}>✅</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Launched on</p>
                    <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-primary)' }}>
                      {format(new Date(launch.launch_date), 'MMMM d, yyyy · HH:mm')} UTC
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>T-MINUS</p>
                  <CountdownTimer launchDate={launch.launch_date} />
                  <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {format(new Date(launch.launch_date), 'MMMM d, yyyy · HH:mm')} UTC
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mission description */}
          {launch.mission_description && (
            <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mission</h2>
              <p style={{ margin: 0, lineHeight: 1.8, color: 'var(--text-primary)', fontSize: 15 }}>{launch.mission_description}</p>
            </div>
          )}

          {/* My log */}
          {myLog && (
            <div className="glass" style={{ padding: 24, borderColor: 'rgba(139,92,246,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, color: 'var(--accent-2)', fontWeight: 600 }}>📓 My Mission Log</h2>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setShowLogModal(true)}>Edit</button>
              </div>
              <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16 }}>{myLog.title}</p>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{myLog.body}</p>
            </div>
          )}
        </div>

        {/* Right - image + actions */}
        <div className="fade-up" style={{ animationDelay: '100ms' }}>
          {launch.image_url ? (
            <img src={launch.image_url} alt={launch.name} style={{ width: '100%', borderRadius: 16, marginBottom: 20, objectFit: 'cover', aspectRatio: '16/9' }} />
          ) : (
            <div style={{
              width: '100%', aspectRatio: '16/9', borderRadius: 16, marginBottom: 20,
              background: 'linear-gradient(135deg, #0f1f3d, #1a0533)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64,
            }}>🚀</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              id="watchlist-btn"
              className={`btn ${watchlistId ? 'btn-ghost' : 'btn-primary'}`}
              onClick={toggleWatchlist}
              disabled={watchlistLoading}
              style={{ justifyContent: 'center' }}
            >
              {watchlistId ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {watchlistId ? 'Saved to Watchlist' : 'Save to Watchlist'}
            </button>

            {user && (
              <button
                id="log-btn"
                className="btn btn-ghost"
                onClick={() => setShowLogModal(true)}
                style={{ justifyContent: 'center' }}
              >
                <NotebookPen size={16} />
                {myLog ? 'Edit Mission Log' : 'Add Mission Log'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showLogModal && (
        <LogModal
          launch={launch}
          existingLog={myLog}
          onClose={() => setShowLogModal(false)}
          onSaved={(log) => setMyLog(log)}
        />
      )}
    </div>
  )
}
