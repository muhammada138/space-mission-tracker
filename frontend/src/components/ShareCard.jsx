import { useRef, useState } from 'react'
import { Download, Copy, X } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ShareCard({ launch, onClose }) {
  const canvasRef = useRef(null)
  const [generating, setGenerating] = useState(false)

  const generateCard = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 600
    const H = 340
    canvas.width = W
    canvas.height = H

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#050a18')
    bg.addColorStop(1, '#0a1428')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Star dots
    for (let i = 0; i < 60; i++) {
      ctx.beginPath()
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3 + 0.1})`
      ctx.fill()
    }

    // Accent bar at top
    const accent = ctx.createLinearGradient(0, 0, W, 0)
    accent.addColorStop(0, '#00d4ff')
    accent.addColorStop(1, '#7c3aed')
    ctx.fillStyle = accent
    ctx.fillRect(0, 0, W, 3)

    // Branding
    ctx.font = '700 11px "Courier New"'
    ctx.fillStyle = '#00d4ff'
    ctx.fillText('SPACE TRACKER', 32, 40)

    // Mission name
    ctx.font = '800 24px Arial'
    ctx.fillStyle = '#e2e8f0'
    const name = launch.name || 'Unknown Mission'
    const lines = wrapText(ctx, name, W - 64, 24)
    let y = 72
    lines.forEach(line => {
      ctx.fillText(line, 32, y)
      y += 30
    })

    // Details
    ctx.font = '400 13px Arial'
    ctx.fillStyle = '#7a8ba7'
    y += 8
    if (launch.launch_provider) {
      ctx.fillText(`Provider: ${launch.launch_provider}`, 32, y)
      y += 22
    }
    if (launch.rocket) {
      ctx.fillText(`Rocket: ${launch.rocket}`, 32, y)
      y += 22
    }
    if (launch.launch_date) {
      ctx.fillText(`Date: ${format(new Date(launch.launch_date), 'MMM d, yyyy - HH:mm z')}`, 32, y)
      y += 22
    }

    // Status badge
    if (launch.status) {
      const s = (launch.status || '').toLowerCase()
      const badgeColor = s.includes('go') ? '#34d399' : s.includes('hold') ? '#ff9f43' : s.includes('fail') ? '#f87171' : '#00d4ff'
      ctx.font = '700 11px "Courier New"'
      const tw = ctx.measureText(launch.status.toUpperCase()).width
      ctx.fillStyle = badgeColor + '20'
      ctx.beginPath()
      ctx.roundRect(32, H - 52, tw + 20, 24, 4)
      ctx.fill()
      ctx.fillStyle = badgeColor
      ctx.fillText(launch.status.toUpperCase(), 42, H - 36)
    }

    // Footer
    ctx.font = '400 10px "Courier New"'
    ctx.fillStyle = '#3e516b'
    ctx.fillText('spacetracker.app', W - 120, H - 20)

    return canvas
  }

  const handleDownload = () => {
    const canvas = generateCard()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${(launch.name || 'mission').replace(/[^a-z0-9]/gi, '_')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('Card downloaded!')
  }

  const handleCopy = async () => {
    const canvas = generateCard()
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        toast.success('Copied to clipboard!')
      })
    } catch {
      toast.error('Copy failed. Try downloading instead.')
    }
  }

  // Generate preview on mount
  useState(() => {
    setTimeout(() => generateCard(), 50)
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 660 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Share Card</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Close" title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="share-preview" style={{ marginBottom: 20 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={handleDownload} style={{ flex: 1, justifyContent: 'center' }}>
            <Download size={14} /> Download PNG
          </button>
          <button className="btn btn-ghost" onClick={handleCopy} style={{ flex: 1, justifyContent: 'center' }}>
            <Copy size={14} /> Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  )
}

function wrapText(ctx, text, maxWidth, fontSize) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3) // max 3 lines
}
