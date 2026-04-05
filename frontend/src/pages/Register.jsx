import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Rocket, Eye, EyeOff, Check, X as XIcon } from 'lucide-react'
import toast from 'react-hot-toast'

function getPasswordStrength(pw) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0-5
}

const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
const strengthColors = ['', '#f87171', '#fbbf24', '#fbbf24', '#34d399', '#34d399']

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const strength = getPasswordStrength(form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password2) return toast.error("Passwords don't match")
    setLoading(true)
    try {
      await register(form.username, form.email, form.password, form.password2)
      toast.success('Account created - welcome aboard! 🚀')
      navigate('/dashboard')
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = Object.values(data).flat().join(' ')
        toast.error(msg || 'Registration failed')
      } else {
        toast.error('Registration failed')
      }
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
          <div style={{
            position: 'absolute', top: '15%', right: '20%',
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(260, 67%, 60%, 0.15), transparent 70%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '25%', left: '15%',
            width: 160, height: 160, borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(222, 89%, 64%, 0.12), transparent 70%)',
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
              Join the<br />mission
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              Create your account to start tracking launches and building your personal mission log.
            </p>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="glass-heavy fade-up" style={{ flex: 1, padding: '40px 40px', borderRadius: 0 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>Create account</h1>
          <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)', fontSize: 14 }}>Start tracking missions today</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Username</label>
              <input id="reg-username" className="input" name="username" value={form.username} onChange={handleChange} placeholder="astronaut42" required autoComplete="username" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Email</label>
              <input id="reg-email" className="input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-password" className="input" name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min 8 characters" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength indicator */}
              {form.password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2,
                        background: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.06)',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: strengthColors[strength], fontWeight: 600 }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-password2" className="input" name="password2" type={showPw ? 'text' : 'password'} value={form.password2} onChange={handleChange} placeholder="Repeat password" required style={{ paddingRight: 44 }} />
                {form.password2 && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                    {form.password === form.password2
                      ? <Check size={16} color="var(--success)" />
                      : <XIcon size={16} color="var(--danger)" />
                    }
                  </span>
                )}
              </div>
            </div>
            <button id="reg-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, justifyContent: 'center', padding: '12px 20px' }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
