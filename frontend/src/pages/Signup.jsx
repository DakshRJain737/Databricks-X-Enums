import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Signup() {
  const { signup } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [branch, setBranch] = useState('CSE')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, password, fullName, branch)
      nav('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>CAMPUS<span style={{ color: '#6d5efc' }}>.AI</span></h1>
        <p style={{ color: '#9aa1af', fontSize: 14 }}>Create your account</p>
        <form onSubmit={submit}>
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <label>College email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          <label>Branch</label>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option>CSE</option>
            <option>ISE</option>
            <option>AIML</option>
            <option>ECE</option>
            <option>Other</option>
          </select>
          {error && <div className="error-text">{error}</div>}
          <button disabled={loading} type="submit">{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        <p style={{ fontSize: 13, color: '#9aa1af', marginTop: 16 }}>
          Already have an account? <Link to="/login" style={{ color: '#6d5efc' }}>Sign in</Link>
        </p>
      </div>
    </div> //chinmay was here
  )
}
