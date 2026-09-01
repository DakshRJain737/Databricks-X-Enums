import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      nav('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <style>{AUTH_STYLES}</style>

      <div className="auth-grid-bg" aria-hidden="true" />

      <div className="auth-panel">
        <div className="auth-wordmark">
          CAMPUS<span className="auth-accent-text">.AI</span>
        </div>
        <p className="auth-tagline">Sign in to continue</p>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">College email</label>
            <input
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@college.edu"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer-text">
          No account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

const AUTH_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap');

.auth-shell {
  --auth-bg: #0B0F1A;
  --auth-surface: #131A2A;
  --auth-border: #232C42;
  --auth-text: #E8ECF4;
  --auth-muted: #7C88A6;
  --auth-accent: #6D5EFC;
  --auth-accent-glow: rgba(109, 94, 252, 0.28);

  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--auth-bg);
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;
}

.auth-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 50% 35%, var(--auth-accent-glow), transparent 60%),
    linear-gradient(var(--auth-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--auth-border) 1px, transparent 1px);
  background-size: 100% 100%, 42px 42px, 42px 42px;
  opacity: 0.5;
  mask-image: radial-gradient(circle at 50% 40%, black 0%, transparent 72%);
}

.auth-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  background: var(--auth-surface);
  border: 1px solid var(--auth-border);
  border-radius: 18px;
  padding: 36px 32px 30px;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.6);
}

.auth-wordmark {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--auth-text);
  letter-spacing: -0.01em;
}
.auth-accent-text { color: var(--auth-accent); }

.auth-tagline {
  color: var(--auth-muted);
  font-size: 0.88rem;
  margin: 6px 0 26px;
}

.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-label { font-size: 0.8rem; color: var(--auth-muted); font-weight: 500; }

.auth-input {
  background: var(--auth-bg);
  border: 1px solid var(--auth-border);
  color: var(--auth-text);
  border-radius: 9px;
  padding: 11px 13px;
  font-size: 0.92rem;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.auth-input::placeholder { color: #4B5573; }
.auth-input:focus {
  border-color: var(--auth-accent);
  box-shadow: 0 0 0 3px var(--auth-accent-glow);
}

.auth-error {
  color: #F0555A;
  font-size: 0.85rem;
  background: rgba(240, 85, 90, 0.1);
  border: 1px solid rgba(240, 85, 90, 0.3);
  border-radius: 8px;
  padding: 9px 12px;
}

.auth-submit {
  margin-top: 4px;
  background: var(--auth-accent);
  color: #FFFFFF;
  border: none;
  border-radius: 9px;
  padding: 12px;
  font-size: 0.94rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}
.auth-submit:hover:not(:disabled) { opacity: 0.92; }
.auth-submit:active:not(:disabled) { transform: scale(0.99); }
.auth-submit:disabled { opacity: 0.6; cursor: default; }

.auth-footer-text {
  text-align: center;
  font-size: 0.85rem;
  color: var(--auth-muted);
  margin: 22px 0 0;
}
.auth-link {
  color: var(--auth-accent);
  font-weight: 500;
  text-decoration: none;
}
.auth-link:hover { text-decoration: underline; }

@media (max-width: 420px) {
  .auth-panel { max-width: 92vw; padding: 30px 22px 26px; }
}
`