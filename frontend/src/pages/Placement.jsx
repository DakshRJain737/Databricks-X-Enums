import { useState } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Placement() {
  const [file, setFile] = useState(null)
  const [cgpa, setCgpa] = useState('8.0')
  const [branch, setBranch] = useState('CSE')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('resume', file)
      form.append('cgpa', cgpa)
      form.append('branch', branch)
      const res = await api.post('/placement/analyze', form)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>Placement Readiness</h2>
      <div className="card">
        <form onSubmit={submit}>
          <label>Resume (PDF or text)</label>
          <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0])} required />
          <div className="grid-2">
            <div>
              <label>CGPA</label>
              <input type="number" step="0.01" min="0" max="10" value={cgpa} onChange={(e) => setCgpa(e.target.value)} />
            </div>
            <div>
              <label>Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option>CSE</option>
                <option>ISE</option>
                <option>AIML</option>
                <option>ECE</option>
              </select>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button disabled={loading} type="submit">{loading ? 'Analyzing...' : 'Analyze'}</button>
        </form>
      </div>

      {result && (
        <>
          <div className="card">
            <h2>Readiness score: {result.readiness_score}%</h2>
            <div>
              {result.detected_skills.map((s) => (
                <span key={s} className="pill ok">{s}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Eligibility</h2>
            {result.eligibility.map((e) => (
              <div key={e.company} style={{ marginBottom: 14 }}>
                <strong>{e.company} — {e.role}</strong>{' '}
                <span className={`pill ${e.eligible ? 'ok' : 'bad'}`}>{e.eligible ? 'Eligible' : 'Not eligible'}</span>
                <div style={{ fontSize: 13, color: '#9aa1af', marginTop: 4 }}>
                  Missing: {e.missing_skills.length ? e.missing_skills.join(', ') : 'none'}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Genie data lookup <GenieBadge mode={result.genie_analysis.mode} /></h2>
            <div className="answer-box">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.genie_analysis.answer}
              </ReactMarkdown>
            </div>
          </div>

          <div className="card">
            <h2>Improvement plan <GenieBadge mode={result.improvement_plan.mode} /></h2>
            <div className="answer-box">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.improvement_plan.answer}
              </ReactMarkdown>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
