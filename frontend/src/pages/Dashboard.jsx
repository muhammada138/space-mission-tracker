import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { Trash2, NotebookPen, Rocket, BookOpen, Bookmark } from 'lucide-react'
import api from '../api/axios'
import LogModal from '../components/LogModal'
import toast from 'react-hot-toast'

const TABS = ['watchlist', 'logs']

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
    }).catch(() => toast.error('Failed to load dashboard data'))
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
    } catch { toast.error('Failed to delete log') }
  }

  const handleLogSaved = (updated) => {
    setLogs(l => l.map(e => e.id === updated.id ? updated : e))
  }

  return (
    <div className="page-container" style={{ paddingTop: 48, paddingBottom: 80 }}>
      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 40 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Mission Control
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
          Welcome back, <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>{user?.username}</span>
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginBottom: 40 }} className="fade-up">
        <StatCard icon={<Bookmark size={22} />} label="Saved Missions" value={watchlist.length} color="#4f7df5" />
        <StatCard icon={<BookOpen size={22} />} label="Mission Logs" value={logs.length} color="#8b5cf6" />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 28 }}>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'watchlist' ? '🎯 Watchlist' : '📓 Mission Logs'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner" />
        </div>
      )}

      {/* Watchlist */}
      {!loading && tab === 'watchlist' && (
        watchlist.length === 0 ? (
          <div className="empty-state fade-up">
            <div className="icon"><Rocket size={48} /></div>
            <p style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>No saved missions yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Browse Launches</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {watchlist.map((entry, i) => (
              <div key={entry.id} className="glass fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 22px',
                cursor: 'pointer', animationDelay: `${i * 40}ms`
              }}
                onClick={() => navigate(`/launch/${entry.launch.api_id}`)}>
                {entry.launch.image_url ? (
                  <img src={entry.launch.image_url} alt={entry.launch.name} style={{ width: 76, height: 54, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 76, height: 54, borderRadius: 10, background: 'linear-gradient(135deg,#0d1729,#150d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🚀</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.launch.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    {[entry.launch.launch_provider, entry.launch.rocket].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {entry.launch.launch_date ? format(new Date(entry.launch.launch_date), 'MMM d, yyyy') : 'TBD'}
                  </p>
                </div>
                <button
                  className="btn btn-danger"
                  style={{ padding: '8px 12px', flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); removeFromWatchlist(entry.id) }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Logs */}
      {!loading && tab === 'logs' && (
        logs.length === 0 ? (
          <div className="empty-state fade-up">
            <div className="icon">📓</div>
            <p style={{ color: 'var(--text-secondary)' }}>No mission logs yet. Open a launch and write your first log!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {logs.map((log, i) => (
              <div key={log.id} className="glass fade-up" style={{ padding: '22px 26px', animationDelay: `${i * 40}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/launch/${log.launch.api_id}`)}>
                    <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{log.launch.name}</span>
                    </p>
                    <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700 }}>{log.title}</h3>
                    <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{log.body}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}
                      onClick={() => { setEditLog(log); setShowLogModal(true) }}>
                      <NotebookPen size={14} /> Edit
                    </button>
                    <button className="btn btn-danger" style={{ padding: '8px 12px' }}
                      onClick={() => deleteLog(log.id)}>
                      <Trash2 size={14} />
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
          onSaved={handleLogSaved}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const [displayValue, setDisplayValue] = useState(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    if (value === 0) return

    let start = 0
    const duration = 600
    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setDisplayValue(Math.floor(eased * value))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return (
    <div className="glass" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: `${color}15`,
        border: `1px solid ${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: '0 0 2px', fontSize: 28, fontWeight: 800, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>{displayValue}</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  )
}
