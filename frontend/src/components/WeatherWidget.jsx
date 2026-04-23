import { useState, useEffect } from 'react'
import { CloudRain, Wind, Eye, Thermometer, Droplets, Zap, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/axios'

function RuleRow({ rule }) {
  const Icon = rule.go ? CheckCircle : XCircle
  const color = rule.go ? 'var(--success)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{rule.name}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-main)' }}>{rule.value}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right' }}>{rule.limit}</span>
    </div>
  )
}

export default function WeatherWidget({ apiId, padName }) {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!apiId) return
    setLoading(true)
    api.get(`/launches/${apiId}/pad-weather/`)
      .then(({ data }) => setWeather(data))
      .catch(() => setWeather(null))
      .finally(() => setLoading(false))
  }, [apiId])

  if (loading) {
    return (
      <div className="glass" style={{ padding: '16px 20px', marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pad Weather
        </p>
        <div style={{ marginTop: 10, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '60%', background: 'var(--accent)', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  if (!weather || !weather.available) {
    return null
  }

  const overallColor = weather.overall === 'GO'
    ? 'var(--success)'
    : weather.overall === 'HOLD'
    ? 'var(--danger)'
    : 'var(--amber)'

  const overallBg = weather.overall === 'GO'
    ? 'var(--success-soft)'
    : weather.overall === 'HOLD'
    ? 'var(--danger-soft)'
    : 'var(--warning-soft)'

  return (
    <div className="glass" style={{ padding: '18px 22px', marginBottom: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pad Weather
          </p>
          {padName && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{padName}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '4px 12px', borderRadius: 20, background: overallBg, border: `1px solid ${overallColor}`, fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)', color: overallColor, letterSpacing: '0.08em' }}>
            {weather.overall}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{weather.description}</span>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        <QuickStat icon={<Wind size={13} />} label="Wind" value={`${weather.wind_knots} kts`} />
        <QuickStat icon={<Eye size={13} />} label="Visibility" value={`${weather.visibility_mi} mi`} />
        <QuickStat icon={<Thermometer size={13} />} label="Temp" value={`${weather.temp_c}°C`} />
        <QuickStat icon={<Droplets size={13} />} label="Humidity" value={`${weather.humidity}%`} />
      </div>

      {/* Progress bar: rules passed */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span>Flight Rules</span>
          <span>{weather.go_count}/{weather.total_rules} GO</span>
        </div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(weather.go_count / weather.total_rules) * 100}%`, background: overallColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Expandable rules table */}
      <button
        onClick={() => setExpanded(p => !p)}
        aria-expanded={expanded}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
      >
        {expanded ? '▲ Hide Rules' : '▼ Show Flight Rules'}
      </button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {weather.rules.map(r => <RuleRow key={r.name} rule={r} />)}
        </div>
      )}
    </div>
  )
}

function QuickStat({ icon, label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border)', padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: 'var(--accent)' }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}
