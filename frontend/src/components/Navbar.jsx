import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, LayoutDashboard, LogIn, LogOut, UserPlus, Menu, X, Globe, BarChart3, Timer, Map, Crosshair } from 'lucide-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

function pad(n) { return String(Math.max(0, Math.floor(n))).padStart(2, '0') }

function MiniCountdown({ targetDate }) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    const calc = () => {
      const d = targetDate ? Math.max(0, Math.floor((new Date(targetDate).getTime() - Date.now()) / 1000)) : 0
      setDiff(d)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!targetDate || diff <= 0) return null
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return <span>{pad(h)}:{pad(m)}:{pad(s)}</span>
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [nextLaunch, setNextLaunch] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Fetch next launch for ticker
  useEffect(() => {
    api.get('/launches/upcoming/', { params: { source: 'all' } })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.results ?? []
        const upcoming = list.filter(l => l.launch_date && new Date(l.launch_date) > new Date())
          .sort((a, b) => new Date(a.launch_date) - new Date(b.launch_date))
        if (upcoming[0]) setNextLaunch(upcoming[0])
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    setDrawerOpen(false)
    navigate('/')
  }

  const close = () => setDrawerOpen(false)

  const links = [
    { to: '/', label: 'Launches', icon: <Rocket size={14} /> },
    { to: '/map', label: 'Globe', icon: <Globe size={14} /> },
    { to: '/timeline', label: 'Timeline', icon: <Timer size={14} /> },
    { to: '/rockets', label: 'Rockets', icon: <Crosshair size={14} /> },
    { to: '/stats', label: 'Stats', icon: <BarChart3 size={14} /> },
    { to: '/iss', label: 'ISS', icon: <Map size={14} /> },
  ]

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }} onClick={close}>
            <div style={{ width: 32, height: 32, background: 'var(--gradient-brand)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)' }}>
              <Rocket size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em' }}>
              Space<span style={{ color: 'var(--accent)' }}>Tracker</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="nav-links">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {l.icon} {l.label}
              </NavLink>
            ))}

            {/* Next launch ticker */}
            {nextLaunch && (
              <div className="nav-ticker">
                <span className="ticker-label">Next:</span>
                <MiniCountdown targetDate={nextLaunch.launch_date} />
              </div>
            )}

            {user ? (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <LayoutDashboard size={14} /> Dashboard
                </NavLink>
                <button className="nav-link" onClick={handleLogout}>
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link"><LogIn size={14} /> Login</Link>
                <Link to="/register" className="btn btn-primary" style={{ fontSize: 12, padding: '7px 16px' }}>
                  <UserPlus size={13} /> Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="nav-mobile-toggle" onClick={() => setDrawerOpen(p => !p)} aria-label="Menu">
            {drawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="mobile-drawer-backdrop" onClick={close} />
          <div className="mobile-drawer">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            {links.map(l => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={close} style={{ padding: '12px 0' }}>
                {l.icon} {l.label}
              </NavLink>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            {user ? (
              <>
                <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={close} style={{ padding: '12px 0' }}>
                  <LayoutDashboard size={14} /> Dashboard
                </NavLink>
                <button className="nav-link" onClick={handleLogout} style={{ padding: '12px 0' }}>
                  <LogOut size={14} /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link" onClick={close} style={{ padding: '12px 0' }}><LogIn size={14} /> Login</Link>
                <Link to="/register" className="btn btn-primary" onClick={close} style={{ marginTop: 8, justifyContent: 'center' }}>
                  <UserPlus size={13} /> Sign up
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
