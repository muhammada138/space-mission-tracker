import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import CountdownTimer from './CountdownTimer'
import { Rocket } from 'lucide-react'

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
      {/* Image */}
      {launch.image_url ? (
        <img src={launch.image_url} alt={launch.name} className="card-img" />
      ) : (
        <div className="card-img-placeholder">🚀</div>
      )}

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Status badge */}
        <div style={{ marginBottom: 8 }}>
          <span className={statusBadgeClass(launch.status)}>{launch.status || 'Unknown'}</span>
        </div>

        {/* Name */}
        <h3 style={{ margin: '0 0 4px', fontSize: 16, lineHeight: 1.3, color: 'var(--text-primary)' }}>
          {launch.name}
        </h3>

        {/* Provider + rocket */}
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
          {[launch.launch_provider, launch.rocket].filter(Boolean).join(' · ')}
        </p>

        {/* Date / Countdown */}
        <div>
          {launch.launch_date ? (
            isPast ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            ) : showCountdown ? (
              <CountdownTimer launchDate={launch.launch_date} />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            )
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Date TBD</p>
          )}
        </div>
      </div>
    </div>
  )
}
