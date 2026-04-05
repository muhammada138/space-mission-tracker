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
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', width: '100%', maxWidth: 820, gap: 0, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* Left panel - decorative */}
        <div className="auth-side-panel" style={{
          flex: '0 0 340px',
          background: 'linear-gradient(135deg, #0d1a3a, #1a0d33, #0d1729)',
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: '20%', left: '30%',
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(222, 89%, 64%, 0.15), transparent 70%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '20%', right: '20%',
            width: 150, height: 150, borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(260, 67%, 60%, 0.12), transparent 70%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 28,
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-lg)',
            }}>
              <Rocket size={26} color="#fff" />
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
              Your mission<br />control awaits
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              Track launches, save missions, and write personal logs about every launch you follow.
            </p>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="glass-heavy fade-up" style={{ flex: 1, padding: '48px 40px', borderRadius: 0 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>Welcome back</h1>
          <p style={{ margin: '0 0 32px', color: 'var(--text-secondary)', fontSize: 14 }}>Log in to your mission control</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Username</label>
              <input id="login-username" className="input" name="username" value={form.username} onChange={handleChange} placeholder="astronaut42" autoComplete="username" required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input id="login-password" className="input" name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete="current-password" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button id="login-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, justifyContent: 'center', padding: '12px 20px' }}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
