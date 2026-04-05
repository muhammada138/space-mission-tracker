import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { MapPin, CheckCircle, XCircle } from 'lucide-react'
import CountdownTimer from './CountdownTimer'

function getStatusClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go')) return 'status-go'
  if (s.includes('hold')) return 'status-hold'
  if (s.includes('success')) return 'status-success'
  if (s.includes('fail')) return 'status-fail'
  return 'status-default'
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go')) return 'badge badge-go'
  if (s.includes('hold')) return 'badge badge-hold'
  if (s.includes('success')) return 'badge badge-success'
  if (s.includes('fail')) return 'badge badge-failure'
  return 'badge badge-default'
}

export default function LaunchCard({ launch, showCountdown = true }) {
  const navigate = useNavigate()
  const isPast = launch.launch_date && new Date(launch.launch_date) < new Date()
  const status = (launch.status || '').toLowerCase()
  const isSuccess = status.includes('success')
  const isFail = status.includes('fail')

  return (
    <div
      className={`glass launch-card ${getStatusClass(launch.status)}`}
      onClick={() => navigate(`/launch/${launch.api_id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/launch/${launch.api_id}`)}
    >
      <div className="card-img-wrapper">
        {launch.image_url ? (
          <img src={launch.image_url} alt={launch.name} className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-placeholder">🚀</div>
        )}
        <div className="card-img-gradient" />
        <div className="badge-overlay">
          <span className={statusBadgeClass(launch.status)}>{launch.status || 'Unknown'}</span>
        </div>
      </div>

      <div className="card-content">
        <h3 style={{ margin: '0 0 4px', fontSize: 14, lineHeight: 1.35, fontWeight: 700 }}>
          {launch.name}
        </h3>

        {/* Provider badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          {[launch.launch_provider, launch.rocket].filter(Boolean).join(' / ')}
        </div>

        {/* Pad location */}
        {launch.pad_location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            <MapPin size={10} />
            {launch.pad_location}
          </div>
        )}

        {/* Past launch result icon */}
        {isPast && (isSuccess || isFail) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: isSuccess ? 'var(--success)' : 'var(--danger)', marginBottom: 8 }}>
            {isSuccess ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {isSuccess ? 'Mission Success' : 'Mission Failure'}
          </div>
        )}

        {/* Countdown or date */}
        <div>
          {launch.launch_date ? (
            isPast ? (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            ) : showCountdown ? (
              <CountdownTimer launchDate={launch.launch_date} />
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            )
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Date TBD</p>
          )}
        </div>
      </div>
    </div>
  )
}
