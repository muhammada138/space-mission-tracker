import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import CountdownTimer from './CountdownTimer'

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go'))      return 'badge badge-go'
  if (s.includes('hold'))    return 'badge badge-hold'
  if (s.includes('success')) return 'badge badge-success'
  if (s.includes('fail'))    return 'badge badge-failure'
  return 'badge badge-default'
}

export default function LaunchCard({ launch, showCountdown = true }) {
  const navigate = useNavigate()
  const isPast = launch.launch_date && new Date(launch.launch_date) < new Date()

  return (
    <div
      className="glass launch-card fade-up"
      onClick={() => navigate(`/launch/${launch.api_id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/launch/${launch.api_id}`)}
    >
      {/* Image with gradient overlay */}
      <div className="card-img-wrapper">
        {launch.image_url ? (
          <img src={launch.image_url} alt={launch.name} className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-placeholder">🚀</div>
        )}
        <div className="card-img-gradient" />
        {/* Status badge overlay on image */}
        <div className="badge-overlay">
          <span className={statusBadgeClass(launch.status)}>{launch.status || 'Unknown'}</span>
        </div>
      </div>

      {/* Content */}
      <div className="card-content">
        {/* Name */}
        <h3 style={{ margin: '0 0 5px', fontSize: 15, lineHeight: 1.35, color: 'var(--text-primary)', fontWeight: 700 }}>
          {launch.name}
        </h3>

        {/* Provider + rocket */}
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
          {[launch.launch_provider, launch.rocket].filter(Boolean).join(' · ')}
        </p>

        {/* Date / Countdown */}
        <div>
          {launch.launch_date ? (
            isPast ? (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            ) : showCountdown ? (
              <CountdownTimer launchDate={launch.launch_date} />
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            )
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Date TBD</p>
          )}
        </div>
      </div>
    </div>
  )
}
