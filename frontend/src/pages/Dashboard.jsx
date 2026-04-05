import { useState, useEffect } from 'react'
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
        <h1 style={{ margin: '0 0 6px', fontSize: 32 }}>
          Mission Control
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Welcome back, <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{user?.username}</span>
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 40 }} className="fade-up">
        <StatCard icon={<Bookmark size={20} />} label="Saved Missions" value={watchlist.length} color="#3b82f6" />
        <StatCard icon={<BookOpen size={20} />} label="Mission Logs" value={logs.length} color="#8b5cf6" />
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
          <div className="empty-state">
            <div className="icon"><Rocket size={48} /></div>
            <p style={{ marginBottom: 20 }}>No saved missions yet.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>Browse Launches</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {watchlist.map(entry => (
              <div key={entry.id} className="glass" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => navigate(`/launch/${entry.launch.api_id}`)}>
                {entry.launch.image_url ? (
                  <img src={entry.launch.image_url} alt={entry.launch.name} style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 72, height: 52, borderRadius: 8, background: 'linear-gradient(135deg,#0f1f3d,#1a0533)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🚀</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.launch.name}</p>
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
          <div className="empty-state">
            <div className="icon">📓</div>
            <p>No mission logs yet. Open a launch and write your first log!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {logs.map(log => (
              <div key={log.id} className="glass" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/launch/${log.launch.api_id}`)}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {log.launch.name}
                    </p>
                    <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{log.title}</h3>
                    <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 14 }}>{log.body}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {format(new Date(log.created_at), 'MMM d, yyyy · HH:mm')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}
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
  return (
    <div className="glass" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: '0 0 2px', fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{label}</p>
      </div>
    </div>
  )
}
