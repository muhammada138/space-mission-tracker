import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Welcome back! 🚀')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="glass fade-up" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Rocket size={24} color="#fff" />
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 26 }}>Welcome back</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Log in to your mission control</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>Username</label>
            <input id="login-username" className="input" name="username" value={form.username} onChange={handleChange} placeholder="astronaut42" autoComplete="username" required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="login-password" className="input" name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete="current-password" required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, justifyContent: 'center' }}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
