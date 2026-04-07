import { useState, useEffect } from 'react'
import { Sun, X } from 'lucide-react'

export default function SpaceWeather() {
  const [weather, setWeather] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/space-weather/')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setWeather(data))
      .catch(() => {
        setWeather({ level: 'nominal', kp: 2, flares: 0, label: 'Quiet' })
      })
  }, [])

  if (!weather || dismissed) return null

  const levelColors = {
    nominal: { bg: 'var(--success-soft)', dot: 'var(--success)', text: 'var(--success)' },
    moderate: { bg: 'var(--warning-soft)', dot: 'var(--warning)', text: 'var(--warning)' },
    severe: { bg: 'var(--danger-soft)', dot: 'var(--danger)', text: 'var(--danger)' },
  }

  const colors = levelColors[weather.level] || levelColors.nominal

  return (
    <div className="weather-indicator fade-up" style={{ background: colors.bg, display: 'inline-flex', border: `1px solid ${colors.dot}15`, position: 'relative' }}>
      <div className="weather-dot" style={{ background: colors.dot }} />
      <Sun size={13} style={{ color: colors.text }} />
      <span style={{ color: colors.text, fontWeight: 600, fontSize: 12 }}>
        Space Weather: {weather.label || 'Quiet'}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Kp {weather.kp || 0}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); setDismissed(true) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: colors.text, opacity: 0.6, padding: '0 0 0 4px',
          display: 'flex', alignItems: 'center', transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}
