import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import SkillTagInput from '../components/SkillTagInput.jsx'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [usn, setUsn] = useState('')
  const [branch, setBranch] = useState('CSE')
  const [department, setDepartment] = useState('')
  const [cgpa, setCgpa] = useState('')
  const [skills, setSkills] = useState([])
  const [leetcodeUsername, setLeetcodeUsername] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup({
        email,
        password,
        full_name: fullName,
        usn,
        branch,
        department,
        cgpa: cgpa ? parseFloat(cgpa) : 0,
        skills,
        leetcode_username: leetcodeUsername,
        github_username: githubUsername,
      })
      nav('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <style>{AUTH_STYLES}</style>

      <div className="auth-grid-bg" aria-hidden="true" />

      <div className="auth-panel auth-panel-wide">
        <div className="auth-wordmark">
          CAMPUS<span className="auth-accent-text">.AI</span>
        </div>
        <p className="auth-tagline">Create your account</p>

        <form onSubmit={submit} className="auth-form">
          <div className="auth-row-2">
            <div className="auth-field">
              <label className="auth-label">Full name</label>
              <input className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label className="auth-label">USN</label>
              <input className="auth-input" value={usn} onChange={(e) => setUsn(e.target.value)} required />
            </div>
          </div>

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

          <div className="auth-row-2">
            <div className="auth-field">
              <label className="auth-label">Branch</label>
              <select className="auth-input auth-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option>CSE</option>
                <option>ISE</option>
                <option>AIML</option>
                <option>ECE</option>
                <option>Other</option>
              </select>
            </div>
            <div className="auth-field">
              <label className="auth-label">Department</label>
              <input className="auth-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>

          <div className="auth-row-2">
            <div className="auth-field">
              <label className="auth-label">CGPA</label>
              <input
                className="auth-input"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                max="10"
                placeholder="0.00"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">LeetCode username</label>
              <input className="auth-input" value={leetcodeUsername} onChange={(e) => setLeetcodeUsername(e.target.value)} />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">GitHub username</label>
            <input className="auth-input" value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} />
          </div>

          <div className="auth-field">
            <label className="auth-label">Skills</label>
            <SkillTagInput value={skills} onChange={setSkills} />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
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
  padding: 40px 16px;
}

.auth-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 50% 30%, var(--auth-accent-glow), transparent 60%),
    linear-gradient(var(--auth-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--auth-border) 1px, transparent 1px);
  background-size: 100% 100%, 42px 42px, 42px 42px;
  opacity: 0.5;
  mask-image: radial-gradient(circle at 50% 35%, black 0%, transparent 72%);
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
.auth-panel-wide { max-width: 480px; }

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
.auth-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
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
  width: 100%;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.auth-input::placeholder { color: #4B5573; }
.auth-input:focus {
  border-color: var(--auth-accent);
  box-shadow: 0 0 0 3px var(--auth-accent-glow);
}

.auth-select {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C88A6' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 34px;
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

/* SkillTagInput — restyled to match the dark auth theme */
.auth-shell .skill-tag-input {
  background: var(--auth-bg);
  border: 1px solid var(--auth-border);
  border-radius: 9px;
  padding: 8px 10px;
  transition: border-color 0.15s ease;
}
.auth-shell .skill-tag-input:focus-within {
  border-color: var(--auth-accent);
  box-shadow: 0 0 0 3px var(--auth-accent-glow);
}
.auth-shell .skill-bubble {
  background: rgba(109, 94, 252, 0.16);
  color: #B4ACFF;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
}
.auth-shell .skill-bubble-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
}
.auth-shell .skill-tag-input input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--auth-text);
  flex: 1;
  min-width: 120px;
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
}
.auth-shell .skill-tag-input input::placeholder { color: #4B5573; }

@media (max-width: 520px) {
  .auth-panel { padding: 30px 22px 26px; }
  .auth-row-2 { grid-template-columns: 1fr; }
}
`