import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Sector,
} from 'recharts'
import { TrendingUp, Rocket, Calendar, Trophy } from 'lucide-react'
import api from '../api/axios'

const COLORS = ['#00d4ff', '#7c3aed', '#34d399', '#ff9f43', '#f87171', '#60a5fa', '#a855f7']

function AnimatedValue({ value }) {
  const [display, setDisplay] = useState(0)
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current || !value) return
    mounted.current = true
    const dur = 600
    const start = performance.now()
    function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      const eased = 1 - (1 - p) * (1 - p)
      setDisplay(Math.floor(eased * value))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <span>{display}</span>
}

// Shared premium tooltip for bar charts
function BarTooltip({ active, payload, label, color = '#00d4ff' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(10,17,40,0.97)',
      border: `1px solid ${color}40`,
      borderRadius: 10,
      padding: '10px 16px',
      fontSize: 13,
      boxShadow: `0 4px 24px ${color}20`,
      fontFamily: 'var(--font-body)',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</p>
      <p style={{ margin: 0, color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
        {payload[0].value} <span style={{ fontWeight: 400, opacity: 0.7 }}>launches</span>
      </p>
    </div>
  )
}

// Custom active shape for pie - zooms and shows label on hover
function ActivePieShape(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props
  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 12}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 8px ${fill}80)` }}
      />
      <text x={cx} y={cy - 10} textAnchor="middle" fill={fill} style={{ fontWeight: 800, fontSize: 18, fontFamily: 'var(--font-mono)' }}>
        {payload.count}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: 11, fontFamily: 'var(--font-body)' }}>
        {payload.name.length > 16 ? payload.name.slice(0, 16) + '…' : payload.name}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill={fill} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  )
}

export default function Stats() {
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePieIndex, setActivePieIndex] = useState(0)

  useEffect(() => {
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
    ]).then(([upRes, pastRes]) => {
      const upData = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const pastData = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      const seen = new Set()
      const unique = []
      for (const l of [...upData, ...pastData]) {
        const key = l.api_id || l.id
        if (key && !seen.has(key)) { seen.add(key); unique.push(l) }
      }
      setLaunches(unique)
    }).finally(() => setLoading(false))
  }, [])

  const totalLaunches = launches.length
  const providers = {}
  const monthData = {}
  const padCounts = {}
  const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let successCount = 0, failCount = 0, streak = 0, maxStreak = 0

  const pastLaunches = launches
    .filter(l => l.launch_date && new Date(l.launch_date) < new Date())
    .sort((a, b) => new Date(b.launch_date) - new Date(a.launch_date))

  pastLaunches.forEach(l => {
    const s = (l.status || '').toLowerCase()
    if (s.includes('success')) { successCount++; streak++; maxStreak = Math.max(maxStreak, streak) }
    else if (s.includes('fail')) { failCount++; streak = 0 }
  })

  launches.forEach(l => {
    const prov = l.launch_provider || 'Unknown'
    providers[prov] = (providers[prov] || 0) + 1
    if (l.launch_date) {
      const d = new Date(l.launch_date)
      const m = d.toLocaleString('en', { month: 'short', year: '2-digit' })
      monthData[m] = (monthData[m] || 0) + 1
      dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1
    }
    const pad = l.pad_location || l.pad_name
    if (pad) padCounts[pad] = (padCounts[pad] || 0) + 1
  })

  const providerData = Object.entries(providers)
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 8)

  const monthChartData = Object.entries(monthData)
    .map(([month, count]) => ({ month, count })).slice(-12)

  const padData = Object.entries(padCounts)
    .map(([name, count]) => ({ name: name.length > 30 ? name.slice(0, 30) + '…' : name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 6)

  const dayData = dayNames.map((name, i) => ({ name, count: dayCounts[i] || 0 }))
  const busiestDay = dayData.reduce((max, d) => d.count > max.count ? d : max, dayData[0])

  const successRate = pastLaunches.length > 0
    ? Math.round((successCount / pastLaunches.length) * 100) : 0

  if (loading) return (
    <div className="page-container" style={{ paddingTop: 100, display: 'flex', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-container" style={{ paddingTop: 36, paddingBottom: 80 }}>
      <div className="fade-up" style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Launch <span style={{ color: 'var(--accent)' }}>Statistics</span>
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
          Data aggregated from {totalLaunches} tracked launches
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 14, marginBottom: 32 }} className="fade-up">
        <StatCard icon={<Rocket size={20} />} label="Total Launches" value={totalLaunches} color="#00d4ff" />
        <StatCard icon={<TrendingUp size={20} />} label="Success Rate" value={successRate} suffix="%" color="#34d399" />
        <StatCard icon={<Trophy size={20} />} label="Best Streak" value={maxStreak} color="#7c3aed" />
        <StatCard icon={<Calendar size={20} />} label={`Busiest: ${busiestDay?.name}`} value={busiestDay?.count || 0} color="#ff9f43" />
      </div>

      {/* Charts grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Launches per month */}
        <div className="glass fade-up" style={{ padding: '22px 24px', gridColumn: monthChartData.length > 6 ? 'span 2' : undefined }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Launches per Month
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthChartData} barCategoryGap="30%">
              <XAxis dataKey="month" tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip color="#00d4ff" />} cursor={{ fill: 'rgba(0,212,255,0.06)', radius: 4 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {monthChartData.map((_, i) => (
                  <Cell key={i} fill="#00d4ff" fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Provider donut — active shape zooms on hover */}
        <div className="glass fade-up" style={{ padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            By Provider
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>Hover a segment to inspect</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={providerData}
                dataKey="count"
                nameKey="name"
                cx="50%" cy="50%"
                innerRadius={54}
                outerRadius={88}
                paddingAngle={2}
                activeIndex={activePieIndex}
                activeShape={<ActivePieShape />}
                onMouseEnter={(_, index) => setActivePieIndex(index)}
              >
                {providerData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {providerData.slice(0, 6).map((p, i) => (
              <div
                key={p.name}
                onClick={() => setActivePieIndex(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  color: activePieIndex === i ? COLORS[i % COLORS.length] : 'var(--text-secondary)',
                  cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
                  background: activePieIndex === i ? `${COLORS[i % COLORS.length]}15` : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Most active pads */}
        <div className="glass fade-up" style={{ padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Most Active Pads
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {padData.map((pad, i) => {
              const color = COLORS[i % COLORS.length]
              const pct = Math.round((pad.count / (padData[0]?.count || 1)) * 100)
              return (
                <div key={pad.name} className="stats-pad-row" style={{ '--pad-color': color }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{pad.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>{pad.count}</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg, ${color}, ${color}99)`,
                      width: `${pct}%`,
                      boxShadow: `0 0 8px ${color}50`,
                      transition: 'width 0.6s var(--ease-out-expo)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Busiest day of week */}
        <div className="glass fade-up" style={{ padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Launches by Day
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dayData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<BarTooltip color="#7c3aed" />} cursor={{ fill: 'rgba(124,58,237,0.08)', radius: 4 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {dayData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.name === busiestDay?.name ? '#ff9f43' : '#7c3aed'}
                    fillOpacity={d.name === busiestDay?.name ? 1 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, suffix = '', color }) {
  return (
    <div className="glass stat-card">
      <div className="stat-card-icon" style={{ background: `${color}12`, border: `1px solid ${color}20`, color }}>
        {icon}
      </div>
      <div>
        <div className="stat-card-value" style={{ color }}>
          <AnimatedValue value={value} />{suffix}
        </div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  )
}
