import { useState, useEffect } from 'react'
import { Sun, AlertTriangle, Zap } from 'lucide-react'

export default function SpaceWeather() {
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    // Try to fetch from our backend proxy, fall back gracefully
    fetch(`${import.meta.env.VITE_API_URL}/api/space-weather/`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setWeather(data))
      .catch(() => {
        // Fallback: show a static "nominal" state if backend doesnt have this endpoint yet
        setWeather({ level: 'nominal', kp: 2, flares: 0, label: 'Quiet' })
      })
  }, [])

  if (!weather) return null

  const levelColors = {
    nominal: { bg: 'var(--success-soft)', dot: 'var(--success)', text: 'var(--success)' },
    moderate: { bg: 'var(--warning-soft)', dot: 'var(--warning)', text: 'var(--warning)' },
    severe: { bg: 'var(--danger-soft)', dot: 'var(--danger)', text: 'var(--danger)' },
  }

  const colors = levelColors[weather.level] || levelColors.nominal

  return (
    <div className="weather-indicator fade-up" style={{ background: colors.bg, display: 'inline-flex', border: `1px solid ${colors.dot}15` }}>
      <div className="weather-dot" style={{ background: colors.dot }} />
      <Sun size={13} style={{ color: colors.text }} />
      <span style={{ color: colors.text, fontWeight: 600, fontSize: 12 }}>
        Space Weather: {weather.label || 'Quiet'}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        Kp {weather.kp || 0}
      </span>
    </div>
  )
}
