import { useEffect, useState } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

export default function Facility() {
  const [status, setStatus] = useState(null)
  const [question, setQuestion] = useState('Which lab is free right now?')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadStatus = async () => {
    const res = await api.get('/facility/status')
    setStatus(res.data)
  }

  useEffect(() => { loadStatus() }, [])

  const ask = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.get('/facility/ask', { params: { question } })
      setAnswer(res.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>Facility Utilisation</h2>
      {status && (
        <div className="card">
          <h2>Live occupancy <span className="pill mock">{status.disclosed_as}</span></h2>
          {Object.entries(status.occupancy_percent).map(([lab, pct]) => (
            <div key={lab} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{lab}</span><span>{pct}%</span>
              </div>
              <div className="occ-bar-track">
                <div className="occ-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
          <button className="secondary" onClick={loadStatus}>Refresh</button>
        </div>
      )}

      <div className="card">
        <form onSubmit={ask}>
          <label>Ask Genie</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button disabled={loading} type="submit">{loading ? 'Asking...' : 'Ask'}</button>
        </form>
      </div>

      {answer && (
        <div className="card">
          <h2>Freest lab right now: {answer.freest_lab} <GenieBadge mode={answer.genie_analysis.mode} /></h2>
          <div className="answer-box">{answer.genie_analysis.answer}</div>
        </div>
      )}
    </div>
  )
}
