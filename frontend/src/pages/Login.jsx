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
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>CAMPUS<span style={{ color: '#6d5efc' }}>.AI</span></h1>
        <p style={{ color: '#9aa1af', fontSize: 14 }}>Sign in to continue</p>
        <form onSubmit={submit}>
          <label>College email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          {error && <div className="error-text">{error}</div>}
          <button disabled={loading} type="submit">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p style={{ fontSize: 13, color: '#9aa1af', marginTop: 16 }}>
          No account? <Link to="/signup" style={{ color: '#6d5efc' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
