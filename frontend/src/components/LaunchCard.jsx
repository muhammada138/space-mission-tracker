import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { MapPin, CheckCircle, XCircle, Radio } from 'lucide-react'
import CountdownTimer from './CountdownTimer'
import { getStatusClass as getBadgeClass } from '../utils/status'

function getCardClass(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('go')) return 'status-go'
  if (s.includes('hold')) return 'status-hold'
  if (s.includes('success')) return 'status-success'
  if (s.includes('fail')) return 'status-fail'
  if (s.includes('in flight') || s.includes('inflight')) return 'status-go'
  return 'status-default'
}

function statusBadgeClass(status) {
  return `badge ${getBadgeClass(status)}`
}

export default function LaunchCard({ launch, showCountdown = true }) {
  const navigate = useNavigate()
  const isPast = launch.launch_date && new Date(launch.launch_date) < new Date()
  const status = (launch.status || '').toLowerCase()
  const isSuccess = status.includes('success')
  const isFail = status.includes('fail')
  const isActive = status.includes('in flight') || status.includes('inflight') ||
    (launch.launch_date && new Date(launch.launch_date) < new Date() &&
     (Date.now() - new Date(launch.launch_date).getTime()) < 10800000 &&
     !isSuccess && !isFail)

  return (
    <div
      className={`glass launch-card ${getCardClass(launch.status)}`}
      onClick={() => navigate(isActive ? `/live/${launch.api_id}` : `/launch/${launch.api_id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(isActive ? `/live/${launch.api_id}` : `/launch/${launch.api_id}`)}
    >
      <div className="card-img-wrapper">
        {launch.image_url ? (
          <img src={launch.image_url} alt={launch.name} className="card-img" loading="lazy" />
        ) : (
          <div className="card-img-placeholder">🚀</div>
        )}
        <div className="card-img-gradient" />
        <div className="badge-overlay" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isActive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800,
              background: 'rgba(248, 113, 113, 0.9)', color: '#fff',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
              animation: 'urgentPulse 2s ease-in-out infinite',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'urgentPulse 1s ease-in-out infinite' }} />
              LIVE
            </span>
          )}
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
        {isPast && !isActive && (isSuccess || isFail) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: isSuccess ? 'var(--success)' : 'var(--danger)', marginBottom: 8 }}>
            {isSuccess ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {isSuccess ? 'Mission Success' : 'Mission Failure'}
          </div>
        )}

        {/* Active mission CTA */}
        {isActive && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            color: 'var(--danger)', marginBottom: 8,
          }}>
            <Radio size={14} />
            Watch Live →
          </div>
        )}

        {/* Countdown or date */}
        <div>
          {launch.launch_date ? (
            isPast && !isActive ? (
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {format(new Date(launch.launch_date), 'MMM d, yyyy HH:mm')} UTC
              </p>
            ) : showCountdown ? (
              <CountdownTimer targetDate={launch.launch_date} />
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

