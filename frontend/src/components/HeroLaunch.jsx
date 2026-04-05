import { useNavigate } from 'react-router-dom'
import CountdownTimer from './CountdownTimer'

export default function HeroLaunch({ launch }) {
  const navigate = useNavigate()
  if (!launch) return null

  return (
    <div className="hero-launch fade-up" onClick={() => navigate(`/launch/${launch.api_id}`)}>
      <div
        className="hero-launch-bg"
        style={{ backgroundImage: launch.image_url ? `url(${launch.image_url})` : 'linear-gradient(135deg, #0a1428, #150d2e)' }}
      />
      <div className="hero-launch-overlay" />
      <div className="hero-launch-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Next Launch
          </span>
          {launch.status && (
            <span className={`badge ${getStatusClass(launch.status)}`}>{launch.status}</span>
          )}
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(20px, 3vw, 30px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
          {launch.name}
        </h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
          {[launch.launch_provider, launch.rocket].filter(Boolean).join(' / ')}
          {launch.pad_location && ` \u00B7 ${launch.pad_location}`}
        </p>

        <CountdownTimer targetDate={launch.launch_date} large />
      </div>
    </div>
  )
}

function getStatusClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go')) return 'badge-go'
  if (s.includes('hold')) return 'badge-hold'
  if (s.includes('success')) return 'badge-success'
  if (s.includes('fail')) return 'badge-failure'
  return 'badge-default'
}
