import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket, Eye, EyeOff, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

function getStrength(pw) {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
const strengthColors = ['', '#f87171', '#ff9f43', '#00d4ff', '#34d399']

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await register(username, email, password, password)
      toast.success('Account created! Welcome aboard.')
      navigate('/dashboard')
    } catch (err) {
      const data = err?.response?.data
      const msg = data?.username?.[0] || data?.password?.[0] || data?.detail || 'Registration failed'
      toast.error(msg)
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
            Join mission control
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Create your account to build a personal watchlist, set launch reminders, and write mission logs.
          </p>
        </div>

        {/* Form panel */}
        <div className="auth-form-panel">
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>Create account</h2>
          <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)', fontSize: 13 }}>Start tracking missions in seconds</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label htmlFor="reg-username" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Username</label>
              <input id="reg-username" className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="astronaut42" autoFocus />
            </div>
            <div>
              <label htmlFor="reg-email" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Email (optional)</label>
              <input id="reg-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@mission-control.com" />
            </div>
            <div>
              <label htmlFor="reg-password" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-password" className="input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label={showPw ? "Hide password" : "Show password"} title={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength indicator */}
              {password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.06)', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: strengthColors[strength], fontFamily: 'var(--font-mono)' }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14 }}>
              {loading ? 'Creating account...' : <><UserPlus size={15} /> Create account</>}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
