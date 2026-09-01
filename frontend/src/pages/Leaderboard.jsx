import { useState, useEffect } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

export default function Leaderboard() {
  const [tab, setTab] = useState('board') // 'board' | 'myrank' | 'live'

  return (
    <div>
      <h2 style={{ fontSize: 22 }}>Leaderboard</h2>
      <div className="tab-row" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={tab === 'board' ? 'tab-active' : ''} onClick={() => setTab('board')}>
          Full Leaderboard
        </button>
        <button className={tab === 'myrank' ? 'tab-active' : ''} onClick={() => setTab('myrank')}>
          Check My Rank
        </button>
        <button className={tab === 'live' ? 'tab-active' : ''} onClick={() => setTab('live')}>
          Live GitHub / Codeforces Compare
        </button>
      </div>

      {tab === 'board' && <FullBoard />}
      {tab === 'myrank' && <MyRank />}
      {tab === 'live' && <LiveCompare />}
    </div>
  )
}

function FullBoard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.get('/leaderboard')
      .then((res) => {
        if (!cancelled) setRows(res.data.leaderboard)
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail || 'Failed to load leaderboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="card">Loading leaderboard...</div>
  if (error) return <div className="card error-text">{error}</div>
  if (rows.length === 0) return <div className="card">No users yet.</div>

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="leaderboard-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>USN</th>
            <th>Branch</th>
            <th>LeetCode Solved</th>
            <th>LC Rating</th>
            <th>Contests</th>
            <th>GitHub Repos</th>
            <th>Followers</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.usn || r.full_name}>
              <td>{r.rank}</td>
              <td>{r.full_name}</td>
              <td>{r.usn}</td>
              <td>{r.branch}</td>
              <td>{r.leetcode_total_solved}</td>
              <td>{r.leetcode_rating}</td>
              <td>{r.leetcode_contests_attended}</td>
              <td>{r.github_public_repos}</td>
              <td>{r.github_followers}</td>
              <td><strong>{r.score}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MyRank() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await api.get('/leaderboard/rank', { params: { query } })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card">
        <form onSubmit={search} style={{ display: 'flex', gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter USN, LeetCode username, GitHub username, or name"
            required
            style={{ flex: 1 }}
          />
          <button disabled={loading} type="submit">{loading ? 'Searching...' : 'Search'}</button>
        </form>
        {error && <div className="error-text" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {result && (
        <>
          <div className="card">
            <h3>You: {result.you.full_name}</h3>
            <p>Rank <strong>#{result.you.rank}</strong> of {result.total_users} ({result.percentile}th percentile)</p>
            <div className="grid-2">
              <p>LeetCode solved: {result.you.leetcode_total_solved}</p>
              <p>LeetCode rating: {result.you.leetcode_rating}</p>
              <p>Contests attended: {result.you.leetcode_contests_attended}</p>
              <p>GitHub repos: {result.you.github_public_repos}</p>
              <p>GitHub followers: {result.you.github_followers}</p>
              <p>Score: <strong>{result.you.score}</strong></p>
            </div>
          </div>

          <div className="card">
            <h3>Nearby peers</h3>
            <table className="leaderboard-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>USN</th>
                  <th>LC Solved</th>
                  <th>GitHub Repos</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {result.nearby_peers.map((p) => (
                  <tr
                    key={p.usn || p.full_name}
                    style={p.rank === result.you.rank ? { fontWeight: 'bold', background: '#6d5efc22' } : {}}
                  >
                    <td>{p.rank}</td>
                    <td>{p.full_name}</td>
                    <td>{p.usn}</td>
                    <td>{p.leetcode_total_solved}</td>
                    <td>{p.github_public_repos}</td>
                    <td>{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function LiveCompare() {
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