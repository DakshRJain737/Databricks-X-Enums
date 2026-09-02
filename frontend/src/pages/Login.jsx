import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
export default function Login() {
  const { sendOtp, verifyOtp } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const requestOtp = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await sendOtp(email)
      setInfo(`Code sent to ${email}`)
      setStep('otp')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send OTP')
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyOtp(email, otp)
      nav('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    setError('')
    setInfo('')
    setLoading(true)
    try {
      await sendOtp(email)
      setInfo(`Code re-sent to ${email}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend OTP')
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
        <p className="auth-tagline">
          {step === 'email' ? 'Sign in with your college email' : 'Enter the code we sent you'}
        </p>

        {step === 'email' && (
          <form onSubmit={requestOtp} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">College email</label>
              <input
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@bmsce.ac.in"
                required
                autoFocus
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" disabled={loading} type="submit">
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={submitOtp} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">6-digit code</label>
              <input
                className="auth-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            {info && <div className="auth-info">{info}</div>}
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" disabled={loading} type="submit">
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <div className="auth-otp-actions">
              <button type="button" className="auth-linklike" onClick={resendOtp} disabled={loading}>
                Resend code
              </button>
              <button
                type="button"
                className="auth-linklike"
                onClick={() => { setStep('email'); setOtp(''); setError(''); setInfo('') }}
              >
                Change email
              </button>
            </div>
          </form>
        )}

        <p className="auth-footer-text">
          No account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
const AUTH_STYLES = `
.auth-shell {
  --auth-bg: #F5F0E1;
  --auth-surface: #FFDE59;
  --auth-border: #111111;
  --auth-text: #111111;
  --auth-muted: #4A4636;
  --auth-accent: #FF3EA5;
  --auth-accent-glow: rgba(255, 62, 165, 0.25);
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--auth-bg);
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;
  padding: 40px 16px;
}
.auth-grid-bg {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--auth-border) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.6;
}
.auth-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
  background: var(--auth-surface);
  border: 3px solid var(--auth-border);
  border-radius: 14px;
  padding: 36px 32px 30px;
  box-shadow: 8px 8px 0px var(--auth-border);
}
.auth-wordmark {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--auth-text);
  letter-spacing: -0.01em;
}
.auth-accent-text {
  color: var(--auth-surface);
  -webkit-text-stroke: 1.5px var(--auth-border);
}
.auth-tagline {
  color: var(--auth-muted);
  font-size: 0.88rem;
  font-weight: 600;
  margin: 6px 0 26px;
}
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-label { font-size: 0.8rem; color: var(--auth-text); font-weight: 700; }
.auth-input {
  background: #FFFFFF;
  border: 2.5px solid var(--auth-border);
  color: var(--auth-text);
  border-radius: 8px;
  padding: 11px 13px;
  font-size: 0.92rem;
  font-family: 'Inter', sans-serif;
  outline: none;
  width: 100%;
  transition: box-shadow 0.1s ease, transform 0.1s ease;
}
.auth-input::placeholder { color: #8A8368; }
.auth-input:focus {
  box-shadow: 3px 3px 0px var(--auth-border);
  transform: translate(-1px, -1px);
}
.auth-error {
  color: var(--auth-text);
  font-size: 0.85rem;
  font-weight: 700;
  background: #FF8A8A;
  border: 2.5px solid var(--auth-border);
  border-radius: 8px;
  padding: 9px 12px;
}
.auth-info {
  color: var(--auth-text);
  font-size: 0.85rem;
  font-weight: 700;
  background: #C6F6C6;
  border: 2.5px solid var(--auth-border);
  border-radius: 8px;
  padding: 9px 12px;
}
.auth-submit {
  margin-top: 4px;
  background: var(--auth-accent);
  color: #FFFFFF;
  border: 2.5px solid var(--auth-border);
  border-radius: 8px;
  padding: 12px;
  font-size: 0.94rem;
  font-weight: 700;
  font-family: 'Space Grotesk', 'Inter', sans-serif;
  cursor: pointer;
  box-shadow: 4px 4px 0px var(--auth-border);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.auth-submit:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--auth-border); }
.auth-submit:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 2px 2px 0px var(--auth-border); }
.auth-submit:disabled { opacity: 0.5; cursor: default; box-shadow: none; transform: none; }
.auth-otp-actions {
  display: flex;
  justify-content: space-between;
  margin-top: -4px;
}
.auth-linklike {
  background: none;
  border: none;
  padding: 0;
  color: var(--auth-accent);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
}
.auth-linklike:disabled { opacity: 0.5; cursor: default; }
.auth-footer-text {
  text-align: center;
  font-size: 0.85rem;
  color: var(--auth-muted);
  font-weight: 600;
  margin: 22px 0 0;
}
.auth-link {
  color: var(--auth-accent);
  font-weight: 700;
  text-decoration: none;
}
.auth-link:hover { text-decoration: underline; }
@media (max-width: 420px) {
  .auth-panel { max-width: 92vw; padding: 30px 22px 26px; }
}
`