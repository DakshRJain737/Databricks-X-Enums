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
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>CAMPUS<span style={{ color: '#6d5efc' }}>.AI</span></h1>
        <p style={{ color: '#9aa1af', fontSize: 14 }}>Create your account</p>
        <form onSubmit={submit}>
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <label>USN</label>
          <input value={usn} onChange={(e) => setUsn(e.target.value)} required />

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

          <label>Department</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />

          <label>CGPA</label>
          <input value={cgpa} onChange={(e) => setCgpa(e.target.value)} type="number" step="0.01" min="0" max="10" />

          <label>LeetCode username</label>
          <input value={leetcodeUsername} onChange={(e) => setLeetcodeUsername(e.target.value)} />

          <label>GitHub username</label>
          <input value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} />

          <label>Skills</label>
          <SkillTagInput value={skills} onChange={setSkills} />

          {error && <div className="error-text">{error}</div>}
          <button disabled={loading} type="submit">{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        <p style={{ fontSize: 13, color: '#9aa1af', marginTop: 16 }}>
          Already have an account? <Link to="/login" style={{ color: '#6d5efc' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}