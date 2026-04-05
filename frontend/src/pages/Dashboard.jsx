import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { Trash2, NotebookPen, Bookmark, BookOpen } from 'lucide-react'
import api from '../api/axios'
import CountdownTimer from '../components/CountdownTimer'
import LogModal from '../components/LogModal'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editLog, setEditLog] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/watchlist/'),
      api.get('/watchlist/logs/'),
    ]).then(([wRes, lRes]) => {
      setWatchlist(Array.isArray(wRes.data) ? wRes.data : wRes.data.results ?? [])
      setLogs(Array.isArray(lRes.data) ? lRes.data : lRes.data.results ?? [])
    }).catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const removeFromWatchlist = async (id) => {
    try {
      await api.delete(`/watchlist/${id}/`)
      setWatchlist(w => w.filter(e => e.id !== id))
      toast.success('Removed from watchlist')
    } catch { toast.error('Failed to remove') }
  }

  const deleteLog = async (id) => {
    try {
      await api.delete(`/watchlist/logs/${id}/`)
      setLogs(l => l.filter(e => e.id !== id))
      toast.success('Log deleted')
    } catch { toast.error('Failed to delete') }
  }

  // Sort watchlist by upcoming date
  const sortedWatchlist = [...watchlist].sort((a, b) => {
    const da = a.launch?.launch_date ? new Date(a.launch.launch_date).getTime() : Infinity
    const db = b.launch?.launch_date ? new Date(b.launch.launch_date).getTime() : Infinity
    return da - db
  })

  // Next upcoming from watchlist
  const nextWatched = sortedWatchlist.find(e =>
    e.launch?.launch_date && new Date(e.launch.launch_date) > new Date()
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Mission <span style={{ color: 'var(--accent)' }}>Control</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Welcome back, <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{user?.username}</span>
        </p>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }} className="fade-up">
        <StatCard label="Tracked Missions" value={watchlist.length} color="#00d4ff" />
        <StatCard label="Mission Logs" value={logs.length} color="#7c3aed" />
        {nextWatched && (
          <div className="glass" style={{ padding: '16px 20px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Next Watched Launch
            </p>
            <CountdownTimer targetDate={nextWatched.launch.launch_date} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        <div className="tabs">
          <button className={`tab ${tab === 'watchlist' ? 'active' : ''}`} onClick={() => setTab('watchlist')}>
            Watchlist <span className="tab-count">{watchlist.length}</span>
          </button>
          <button className={`tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
            Mission Logs <span className="tab-count">{logs.length}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>
      )}

      {/* Watchlist as timeline */}
      {!loading && tab === 'watchlist' && (
        watchlist.length === 0 ? (
          <div className="empty-state fade-up">
            <div className="icon">🎯</div>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>No tracked missions yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Browse Launches</button>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 8, width: 2, background: 'var(--border)' }} />

            {sortedWatchlist.map((entry, i) => {
              const isUpcoming = entry.launch?.launch_date && new Date(entry.launch.launch_date) > new Date()
              return (
                <div key={entry.id} className="fade-up" style={{ position: 'relative', marginBottom: 16, animationDelay: `${i * 40}ms` }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute', left: -20, top: 20,
                    width: 10, height: 10, borderRadius: '50%',
                    background: isUpcoming ? 'var(--accent)' : 'var(--text-muted)',
                    border: '2px solid var(--bg-base)',
                    boxShadow: isUpcoming ? '0 0 8px var(--accent)' : 'none',
                  }} />

                  <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer' }}
                    onClick={() => navigate(`/launch/${entry.launch.api_id}`)}>
                    {entry.launch.image_url ? (
                      <img src={entry.launch.image_url} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 64, height: 48, borderRadius: 8, background: 'linear-gradient(135deg,#0a1428,#150d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🚀</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.launch.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {entry.launch.launch_date ? format(new Date(entry.launch.launch_date), 'MMM d, yyyy') : 'TBD'}
                      </p>
                    </div>
                    {isUpcoming && entry.launch.launch_date && (
                      <div style={{ flexShrink: 0 }}>
                        <CountdownTimer targetDate={entry.launch.launch_date} />
                      </div>
                    )}
                    <button className="btn btn-danger" style={{ padding: '6px 10px', flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); removeFromWatchlist(entry.id) }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Mission logs as journal entries */}
      {!loading && tab === 'logs' && (
        logs.length === 0 ? (
          <div className="empty-state fade-up">
            <div className="icon">📓</div>
            <p style={{ color: 'var(--text-secondary)' }}>No mission logs yet. Visit a launch and write your first log!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {logs
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map((log, i) => (
              <div key={log.id} className="glass fade-up" style={{ padding: '20px 24px', animationDelay: `${i * 35}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/launch/${log.launch.api_id}`)}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
                      {log.launch.name}
                    </p>
                    <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{log.title}</h3>
                    <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: 13 }}>{log.body}</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy / HH:mm')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}
                      onClick={() => { setEditLog(log); setShowLogModal(true) }}>
                      <NotebookPen size={13} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '6px 10px' }}
                      onClick={() => deleteLog(log.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showLogModal && editLog && (
        <LogModal
          launch={editLog.launch}
          existingLog={editLog}
          onClose={() => { setShowLogModal(false); setEditLog(null) }}
          onSaved={(updated) => setLogs(l => l.map(e => e.id === updated.id ? updated : e))}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const [display, setDisplay] = useState(0)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current || !value) return
    mounted.current = true
    const dur = 500, start = performance.now()
    function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      setDisplay(Math.floor((1 - (1 - p) * (1 - p)) * value))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return (
    <div className="glass stat-card">
      <div>
        <div className="stat-card-value" style={{ color }}>{display}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  )
}
