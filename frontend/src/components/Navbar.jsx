import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, LayoutDashboard, LogIn, LogOut, UserPlus, Menu, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    setMobileOpen(false)
    navigate('/')
  }

  const closeMenu = () => setMobileOpen(false)

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }} onClick={closeMenu}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--gradient-brand)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Rocket size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Space<span style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tracker</span>
          </span>
        </Link>

        {/* Mobile toggle */}
        <button className="nav-mobile-toggle" onClick={() => setMobileOpen(p => !p)} aria-label="Toggle menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Nav links */}
        <div className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => `btn btn-ghost ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({ color: isActive ? 'var(--text-primary)' : undefined, fontSize: 14 })}
            onClick={closeMenu}>
            Launches
          </NavLink>

          {user ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `btn btn-ghost ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({ color: isActive ? 'var(--text-primary)' : undefined, fontSize: 14 })}
                onClick={closeMenu}>
                <LayoutDashboard size={15} />
                Dashboard
              </NavLink>
              <button className="btn btn-ghost" onClick={handleLogout} style={{ fontSize: 14 }}>
                <LogOut size={15} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost" style={{ fontSize: 14 }} onClick={closeMenu}>
                <LogIn size={15} />
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: 14 }} onClick={closeMenu}>
                <UserPlus size={15} />
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
