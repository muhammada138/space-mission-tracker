import { useEffect, useRef } from 'react'

export default function StarField() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animId
    let stars = []
    const STAR_COUNT = 180
    const SHOOTING_INTERVAL = 6000 // ms between shooting stars

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    function createStars() {
      stars = []
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.3 + 0.2,
          opacity: Math.random() * 0.6 + 0.1,
          twinkleSpeed: Math.random() * 0.008 + 0.002,
          twinkleOffset: Math.random() * Math.PI * 2,
        })
      }
    }

    // Shooting stars
    let shootingStars = []
    let lastShootingTime = 0

    function spawnShootingStar(time) {
      shootingStars.push({
        x: Math.random() * canvas.width * 0.7,
        y: Math.random() * canvas.height * 0.4,
        len: Math.random() * 60 + 40,
        speed: Math.random() * 4 + 3,
        angle: (Math.PI / 6) + Math.random() * (Math.PI / 8),
        opacity: 1,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      })
      lastShootingTime = time
    }

    function draw(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw stars
      ctx.fillStyle = '#c8d7ff'
      for (const star of stars) {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset)
        const opacity = star.opacity + twinkle * 0.2
        ctx.globalAlpha = Math.max(0.05, Math.min(0.8, opacity))
        ctx.fillRect(star.x - star.radius, star.y - star.radius, star.radius * 2, star.radius * 2)
      }
      ctx.globalAlpha = 1.0 // Reset for shooting stars

      // Shooting stars
      if (time - lastShootingTime > SHOOTING_INTERVAL) {
        spawnShootingStar(time)
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        s.life++
        s.x += Math.cos(s.angle) * s.speed
        s.y += Math.sin(s.angle) * s.speed
        s.opacity = 1 - (s.life / s.maxLife)

        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1)
          continue
        }

        const tailX = s.x - Math.cos(s.angle) * s.len
        const tailY = s.y - Math.sin(s.angle) * s.len

        const gradient = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
        gradient.addColorStop(0, `rgba(200, 215, 255, 0)`)
        gradient.addColorStop(1, `rgba(200, 215, 255, ${s.opacity * 0.7})`)

        ctx.beginPath()
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.2
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(s.x, s.y)
        ctx.stroke()

        // Head glow
        ctx.beginPath()
        ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 220, 255, ${s.opacity * 0.8})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    createStars()
    animId = requestAnimationFrame(draw)

    const handleResize = () => {
      resize()
      createStars()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield-canvas" />
}
