import { useEffect, useState } from 'react'
import { differenceInSeconds } from 'date-fns'

function pad(n) { return String(Math.max(0, n)).padStart(2, '0') }

export default function CountdownTimer({ launchDate }) {
  const target = new Date(launchDate)
  const [diff, setDiff] = useState(differenceInSeconds(target, new Date()))

  useEffect(() => {
    const id = setInterval(() => setDiff(differenceInSeconds(target, new Date())), 1000)
    return () => clearInterval(id)
  }, [launchDate])

  if (diff <= 0) {
    return <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>🚀 Launched</span>
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
