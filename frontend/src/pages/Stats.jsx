import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, Rocket, Calendar, MapPin, Trophy } from 'lucide-react'
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

export default function Stats() {
  const [launches, setLaunches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch both upcoming and past launches for stats
    Promise.all([
      api.get('/launches/upcoming/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
      api.get('/launches/past/', { params: { source: 'all' } }).catch(() => ({ data: [] })),
    ]).then(([upRes, pastRes]) => {
      const upData = Array.isArray(upRes.data) ? upRes.data : upRes.data?.results ?? []
      const pastData = Array.isArray(pastRes.data) ? pastRes.data : pastRes.data?.results ?? []
      setLaunches([...upData, ...pastData])
    }).finally(() => setLoading(false))
  }, [])

  // Compute stats from loaded launches
  const totalLaunches = launches.length
  const providers = {}
  const monthData = {}
  const padCounts = {}
  const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let successCount = 0
  let failCount = 0
  let streak = 0
  let maxStreak = 0

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
    .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const monthChartData = Object.entries(monthData)
    .map(([month, count]) => ({ month, count }))
    .slice(-12)

  const padData = Object.entries(padCounts)
    .map(([name, count]) => ({ name: name.length > 30 ? name.slice(0, 30) + '...' : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const dayData = dayNames.map((name, i) => ({ name, count: dayCounts[i] || 0 }))

  const busiestDay = dayData.reduce((max, d) => d.count > max.count ? d : max, dayData[0])

  const successRate = pastLaunches.length > 0
    ? Math.round((successCount / pastLaunches.length) * 100)
    : 0

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{label}</p>
        <p style={{ margin: 0, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{payload[0].value} launches</p>
      </div>
    )
  }

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
            <BarChart data={monthChartData}>
              <XAxis dataKey="month" tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#00d4ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Provider breakdown */}
        <div className="glass fade-up" style={{ padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            By Provider
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={providerData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {providerData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {providerData.slice(0, 5).map((p, i) => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {padData.map((pad, i) => (
              <div key={pad.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{pad.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{pad.count}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: COLORS[i % COLORS.length], width: `${(pad.count / (padData[0]?.count || 1)) * 100}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Busiest day of week */}
        <div className="glass fade-up" style={{ padding: '22px 24px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
            Launches by Day
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dayData}>
              <XAxis dataKey="name" tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3e516b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
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
