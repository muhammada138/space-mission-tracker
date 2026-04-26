import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, Eye, EyeOff, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-container glass fade-up">
        {/* Side panel */}
        <div className="auth-side">
          <div style={{ marginBottom: 32 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(0,212,255,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,212,255,0.15)' }}>
              <Rocket size={20} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
            Your mission control awaits
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Track launches, save missions, and write personal logs about every launch you follow.
          </p>
        </div>

        {/* Form panel */}
        <div className="auth-form-panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Welcome back</h2>
          <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)', fontSize: 13 }}>Log in to your mission control</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label htmlFor="login-username" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Username</label>
              <input id="login-username" className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="astronaut42" autoFocus />
            </div>
            <div>
              <label htmlFor="login-password" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" className="input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="........" style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(p => !p)} aria-label="Toggle password visibility" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14 }}>
              {loading ? 'Logging in...' : <><LogIn size={15} /> Log in</>}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
