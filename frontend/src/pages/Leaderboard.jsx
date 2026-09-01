import { useState } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

export default function Leaderboard() {
  const [github, setGithub] = useState('')
  const [codeforces, setCodeforces] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.get('/leaderboard/compare', {
        params: { github_handle: github, codeforces_handle: codeforces },
      })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>CP / GitHub Leaderboard</h2>
      <div className="card">
        <form onSubmit={submit}>
          <div className="grid-2">
            <div>
              <label>GitHub username</label>
              <input value={github} onChange={(e) => setGithub(e.target.value)} required />
            </div>
            <div>
              <label>Codeforces handle</label>
              <input value={codeforces} onChange={(e) => setCodeforces(e.target.value)} required />
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button disabled={loading} type="submit">{loading ? 'Comparing...' : 'Compare'}</button>
        </form>
      </div>

      {result && (
        <>
          <div className="grid-2">
            <div className="card">
              <h2>GitHub</h2>
              {result.github.error
                ? <p className="error-text">{result.github.error}</p>
                : (
                  <>
                    <p>Public repos: {result.github.public_repos}</p>
                    <p>Followers: {result.github.followers}</p>
                    <p>Total stars: {result.github.total_stars}</p>
                  </>
                )}
            </div>
            <div className="card">
              <h2>Codeforces</h2>
              {result.codeforces.error
                ? <p className="error-text">{result.codeforces.error}</p>
                : (
                  <>
                    <p>Rating: {result.codeforces.rating}</p>
                    <p>Max rating: {result.codeforces.max_rating}</p>
                    <p>Rank: {result.codeforces.rank}</p>
                  </>
                )}
            </div>
          </div>
          <div className="card">
            <h2>Genie analysis <GenieBadge mode={result.genie_analysis.mode} /></h2>
            <div className="answer-box">{result.genie_analysis.answer}</div>
          </div>
        </>
      )}
    </div>
  )
}
