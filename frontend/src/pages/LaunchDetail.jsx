import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, MapPin, Globe, Radio, Rocket, Play, Share2, Bell, BellOff, Activity, ThumbsUp, ThumbsDown, Minus, CheckCircle, Users } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
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

// ── Sub-Components ────────────────────────────────────────────────────────

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
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass" style={{ padding: '18px 22px', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Community Prediction</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(opt => {
          const count = data[opt.key] || 0
          const percent = pct(count)
          const isMyVote = data.user_vote === opt.key
          return (
            <button key={opt.key} onClick={() => vote(opt.key)} disabled={voting} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isMyVote ? `color-mix(in srgb, ${opt.color} 12%, transparent)` : 'rgba(255,255,255,0.02)', border: `1px solid ${isMyVote ? opt.color : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.2s', textAlign: 'left' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: `color-mix(in srgb, ${opt.color} 8%, transparent)`, pointerEvents: 'none' }} />
              <span style={{ color: opt.color, flexShrink: 0 }}>{opt.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isMyVote ? 700 : 400, color: 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{percent}%</span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

function NewsWidget({ articles }) {
  if (!articles || articles.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Radio size={14} /> Related News
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {articles.map(article => (
          <a key={article.api_id} href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}>
            {article.image_url && <img src={article.image_url} alt="" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }} />}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{article.title}</h4>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{article.news_site}</span>
            </div>
          </a>
        ))}
      </div>
    </motion.div>
  )
}

function CrewWidget({ crew }) {
  if (!crew || crew.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass" style={{ padding: '20px 24px', marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={14} /> Mission Crew
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        {crew.map(member => (
          <div key={member.api_id} style={{ textAlign: 'center' }}>
            <img src={member.profile_image || '/placeholder-astronaut.png'} alt={member.name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', marginBottom: 8, border: '2px solid var(--border)' }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>{member.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{member.agency}</div>
          </div>
        ))}
      </div>
    </motion.div>
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

// ── Main Page ────────────────────────────────────────────────────────────────

const getIsActive = (launch) => {
  if (!launch) return false;
  const status = (launch.status || '').toLowerCase();
  const now = Date.now();
  return ((status.includes('in flight') || status.includes('inflight')) &&
    (launch.launch_date && (now - new Date(launch.launch_date).getTime()) < 86400000)) ||
    (launch.launch_date && new Date(launch.launch_date) < new Date() &&
     (now - new Date(launch.launch_date).getTime()) < 10800000 &&
     !status.includes('success') && !status.includes('fail'));
};

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
        api.get(`/launches/${api_id}/updates/`).then(res => setUpdates(Array.isArray(res.data) ? res.data : []))
      })
      .catch(() => toast.error('Launch not found'))
      .finally(() => setLoading(false))
  }, [api_id])

  useEffect(() => {
    if (!user) return
    api.get('/watchlist/', { params: { launch_api_id: api_id } }).then(({ data }) => {
      const items = Array.isArray(data) ? data : data.results ?? []
      if (items.length > 0) setWatchlistId(items[0].id)
    })
    api.get('/watchlist/logs/').then(({ data }) => {
      const items = Array.isArray(data) ? data : data.results ?? []
      setLogs(items.filter(l => l.launch?.api_id === api_id))
    })
  }, [user, api_id])

  if (loading) return <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
  if (!launch) return <div className="page-container" style={{ paddingTop: 100, textAlign: 'center' }}><p>Launch not found.</p><button className="btn btn-ghost" onClick={() => navigate('/')}>Back</button></div>

  const isUpcoming = launch.launch_date && new Date(launch.launch_date) > new Date()
  const ytId = getYouTubeId(launch.webcast_url)
  const isActive = getIsActive(launch)

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Hero */}
      <div className="detail-hero">
        {launch.image_url ? <img src={launch.image_url} alt="" /> : <div style={{ width: '100%', height: '100%', background: '#0a1428' }} />}
        <div className="detail-hero-gradient" />
      </div>

      <div className="page-container" style={{ position: 'relative', zIndex: 1 }}>
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}><ArrowLeft size={14} /> Back</button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
          <div style={{ flex: '1 1 600px', minWidth: 0 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <span className={`badge ${getStatusClass(launch.status)}`}>{launch.status}</span>
                {isActive && <span className="badge badge-accent">LIVE</span>}
              </div>
              <h1 style={{ fontSize: 36, margin: 0 }}>{launch.name}</h1>
              <p style={{ color: 'var(--text-secondary)' }}>{launch.launch_provider} • {launch.rocket}</p>
            </div>

            {ytId && (
              <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', marginBottom: 24, border: '1px solid var(--border)' }}>
                <iframe src={`https://www.youtube.com/embed/${ytId}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen />
              </div>
            )}

            {isUpcoming && (
              <div className="glass" style={{ padding: 24, textAlign: 'center', marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>T-Minus</p>
                <CountdownTimer targetDate={launch.launch_date} large />
              </div>
            )}

            <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>At a Glance</h3>
              <div className="info-grid">
                <InfoRow icon={<Rocket size={13} />} label="Rocket" value={launch.rocket} />
                <InfoRow icon={<Globe size={13} />} label="Provider" value={launch.launch_provider} />
                <InfoRow icon={<MapPin size={13} />} label="Pad" value={launch.pad_name} />
                <InfoRow icon={<Radio size={13} />} label="Orbit" value={launch.orbit} />
              </div>
            </div>

            {isUpcoming && <WeatherWidget apiId={api_id} padName={launch.pad_name} />}
            {isUpcoming && <PredictionWidget apiId={api_id} />}

            {updates.length > 0 && (
              <div className="glass" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--accent)' }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>Live Updates</h3>
                {updates.map(u => <div key={u.id} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 12, marginBottom: 16 }}><p style={{ fontSize: 13 }}>{u.comment}</p></div>)}
              </div>
            )}

            <CrewWidget crew={launch.crew} />
            
            {launch.mission_description && (
              <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Mission Brief</h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{launch.mission_description}</p>
              </div>
            )}

            <NewsWidget articles={launch.articles} />

            {launch.wiki_url && <a href={launch.wiki_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><ExternalLink size={13} /> Wikipedia</a>}
          </div>

          <div style={{ flex: '0 0 320px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 80 }}>
              <button className="btn btn-primary" onClick={toggleWatchlist}>{watchlistId ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {watchlistId ? 'Saved' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setShowShareCard(true)}><Share2 size={14} /> Share</button>
              {user && <button className="btn btn-ghost" onClick={() => setShowLogModal(true)}>Write Log</button>}
            </div>
          </div>
        </div>
      </div>

      {showLogModal && <LogModal launch={launch} onClose={() => setShowLogModal(false)} onSaved={(l) => setLogs(p => [...p, l])} />}
      {showShareCard && <ShareCard launch={launch} onClose={() => setShowShareCard(false)} />}
    </div>
  )
}
