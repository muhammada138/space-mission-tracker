import { useEffect, useState } from 'react'

function pad(n) {
  const val = Math.max(0, Math.floor(n))
  return String(val).padStart(2, '0')
}

function getSecondsUntil(dateStr) {
  if (!dateStr) return 0
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return 0
  return Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000))
}

export default function CountdownTimer({ targetDate, launchDate }) {
  const dateStr = targetDate || launchDate
  const [diff, setDiff] = useState(() => getSecondsUntil(dateStr))

  useEffect(() => {
    const id = setInterval(() => setDiff(getSecondsUntil(dateStr)), 1000)
    return () => clearInterval(id)
  }, [dateStr])

  if (!dateStr || diff <= 0) {
    return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>Launched</span>
  }

  const days    = Math.floor(diff / 86400)
  const hours   = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  const seconds = diff % 60

  return (
    <div className="countdown-grid">
      {days > 0 && (
        <div className="countdown-unit">
          <span className="num">{pad(days)}</span>
          <span className="lbl">days</span>
        </div>
      )}
      <div className="countdown-unit">
        <span className="num">{pad(hours)}</span>
        <span className="lbl">hrs</span>
      </div>
      <div className="countdown-unit">
        <span className="num">{pad(minutes)}</span>
        <span className="lbl">min</span>
      </div>
      <div className="countdown-unit">
        <span className="num">{pad(seconds)}</span>
        <span className="lbl">sec</span>
      </div>
    </div>
  )
}
