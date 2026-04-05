import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, LayoutDashboard, LogIn, LogOut, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '64px' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Rocket size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Space<span style={{ color: 'var(--accent)' }}>Tracker</span>
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavLink to="/" end className={({ isActive }) => `btn btn-ghost ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({ color: isActive ? 'var(--text-primary)' : undefined, fontSize: 14 })}>
            Launches
          </NavLink>

          {user ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `btn btn-ghost ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({ color: isActive ? 'var(--text-primary)' : undefined, fontSize: 14 })}>
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
              <Link to="/login" className="btn btn-ghost" style={{ fontSize: 14 }}>
                <LogIn size={15} />
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: 14 }}>
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
