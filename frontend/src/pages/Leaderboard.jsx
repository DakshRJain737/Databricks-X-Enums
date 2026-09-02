import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'

// --- Tier system, borrowed from competitive-programming rating conventions ---
// Purely presentational — computed client-side from data already on the record.
function tierFor(rating) {
  const r = rating || 0
  if (r >= 2400) return { name: 'Red', color: '#F0555A' }
  if (r >= 2100) return { name: 'Orange', color: '#E8883A' }
  if (r >= 1900) return { name: 'Purple', color: '#A371F7' }
  if (r >= 1600) return { name: 'Blue', color: '#5B8DEF' }
  if (r >= 1400) return { name: 'Cyan', color: '#39C5CF' }
  if (r >= 1200) return { name: 'Green', color: '#3FB950' }
  return { name: 'Unrated', color: '#7C88A6' }
}

const PODIUM_STYLE = [
  { label: '1st', accent: '#E8B84B', glow: 'rgba(232,184,75,0.35)' },
  { label: '2nd', accent: '#C7CCDA', glow: 'rgba(199,204,218,0.28)' },
  { label: '3rd', accent: '#D08A56', glow: 'rgba(208,138,86,0.28)' },
]

// SSE hook — /leaderboard/stream is deliberately unauthenticated (EventSource
// can't send an Authorization header, and the stream only emits an empty
// 'refresh' ping, no user data). Any component using this just refetches
// its own data on receipt.
function useLeaderboardStream(onRefresh) {
  const esRef = useRef(null)

  useEffect(() => {
    const es = new EventSource('/api/leaderboard/stream')
    es.addEventListener('refresh', () => onRefresh())
    es.onerror = () => {
      // browser auto-reconnects EventSource on its own; nothing to do here
    }
    esRef.current = es
    return () => es.close()
  }, [onRefresh])
}

export default function Leaderboard() {
  const [tab, setTab] = useState('board') // 'board' | 'myrank' | 'live' | 'ask'

  const tabs = [
    { id: 'board', label: 'Leaderboard' },
    { id: 'myrank', label: 'Check my rank' },
    { id: 'live', label: 'Live compare' },
    { id: 'ask', label: 'Ask a question' },
  ]

  return (
    <div className="lb-root">
      <style>{LB_STYLES}</style>

      <div className="lb-header">
        <h2 className="lb-title">Leaderboard</h2>
        <p className="lb-subtitle">Ranked by problems solved, contest performance, and shipped code.</p>
      </div>

      <div className="lb-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`lb-tab${tab === t.id ? ' lb-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lb-panel">
        {tab === 'board' && <FullBoard />}
        {tab === 'myrank' && <MyRank />}
        {tab === 'live' && <LiveCompare />}
        {tab === 'ask' && <AskLeaderboard />}
      </div>
    </div>
  )
}

function FullBoard() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchBoard = useCallback(() => {
    api.get('/leaderboard')
      .then((res) => setRows(res.data.leaderboard))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchBoard()
  }, [fetchBoard])

  // Live updates: whenever the backend scheduler detects a ranking change
  // (new solve, new commit, etc.), silently refetch — no full-page loading
  // state on refresh, just a quiet row swap.
  useLeaderboardStream(fetchBoard)

  const maxScore = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.score || 0), 1),
    [rows]
  )

  if (loading) {
    return (
      <div className="lb-card lb-empty">
        <div className="lb-spinner" aria-hidden="true" />
        <p>Loading leaderboard…</p>
      </div>
    )
  }
  if (error) return <div className="lb-card lb-error">{error}</div>
  if (rows.length === 0) {
    return (
      <div className="lb-card lb-empty">
        <p>No students on the board yet. Once people sign up, their stats land here automatically.</p>
      </div>
    )
  }

  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  return (
    <div>
      {podium.length > 0 && (
        <div className="lb-podium">
          {podium.map((r, i) => {
            const style = PODIUM_STYLE[i]
            const tier = tierFor(r.leetcode_rating)
            return (
              <Link
                to={`/students/${r.usn}`}
                key={r.usn || r.full_name}
                className={`lb-podium-card lb-podium-${i}`}
                style={{ '--accent': style.accent, '--glow': style.glow }}
              >
                <span className="lb-podium-rank">{style.label}</span>
                <span className="lb-podium-name">{r.full_name}</span>
                <span className="lb-podium-usn">{r.usn}</span>
                <span className="lb-podium-score">{r.score}</span>
                <div className="lb-podium-meta">
                  <span>{r.leetcode_total_solved} solved</span>
                  <span className="lb-dot" />
                  <span style={{ color: tier.color }}>{tier.name}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="lb-card lb-table-card">
        <table className="lb-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Branch</th>
              <th>Solved</th>
              <th>Rating</th>
              <th>Contests</th>
              <th>Repos</th>
              <th>Commits</th>
              <th>Followers</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {[...podium, ...rest].map((r) => {
              const tier = tierFor(r.leetcode_rating)
              const barWidth = Math.max(4, Math.round((r.score / maxScore) * 100))
              return (
                <tr key={r.usn || r.full_name} style={{ '--tier-color': tier.color }}>
                  <td className="lb-rank-cell">{r.rank}</td>
                  <td>
                    <Link to={`/students/${r.usn}`} className="lb-student-cell lb-student-link">
                      <span className="lb-student-name">{r.full_name}</span>
                      <span className="lb-student-usn">{r.usn}</span>
                    </Link>
                  </td>
                  <td className="lb-muted">{r.branch}</td>
                  <td>{r.leetcode_total_solved}</td>
                  <td>
                    <span className="lb-tier-chip" style={{ color: tier.color, borderColor: tier.color }}>
                      {r.leetcode_rating || 0}
                    </span>
                  </td>
                  <td className="lb-muted">{r.leetcode_contests_attended}</td>
                  <td className="lb-muted">{r.github_public_repos}</td>
                  <td className="lb-muted">{r.github_commit_count ?? 0}</td>
                  <td className="lb-muted">{r.github_followers}</td>
                  <td>
                    <div className="lb-score-cell">
                      <span className="lb-score-num">{r.score}</span>
                      <div className="lb-score-bar-track">
                        <div className="lb-score-bar-fill" style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
      <div className="lb-card">
        <form onSubmit={search} className="lb-search-row">
          <input
            className="lb-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="USN, LeetCode username, GitHub username, or name"
            required
          />
          <button className="lb-btn-primary" disabled={loading} type="submit">
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {error && <div className="lb-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {result && (
        <>
          <div className="lb-card lb-you-card">
            <div className="lb-you-main">
              <div className="lb-you-rank">
                <span className="lb-you-rank-num">#{result.you.rank}</span>
                <span className="lb-you-rank-of">of {result.total_users}</span>
              </div>
              <Link to={`/students/${result.you.usn}`} className="lb-you-identity lb-student-link">
                <span className="lb-you-name">{result.you.full_name}</span>
                <span className="lb-you-usn">{result.you.usn}</span>
              </Link>
              <div className="lb-percentile-ring" style={{ '--pct': result.percentile }}>
                <span>{result.percentile}%</span>
              </div>
            </div>
            <div className="lb-you-stats">
              <div className="lb-stat">
                <span className="lb-stat-value">{result.you.leetcode_total_solved}</span>
                <span className="lb-stat-label">solved</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-value">{result.you.leetcode_rating}</span>
                <span className="lb-stat-label">rating</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-value">{result.you.leetcode_contests_attended}</span>
                <span className="lb-stat-label">contests</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-value">{result.you.github_public_repos}</span>
                <span className="lb-stat-label">repos</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-value">{result.you.github_followers}</span>
                <span className="lb-stat-label">followers</span>
              </div>
              <div className="lb-stat">
                <span className="lb-stat-value lb-stat-emphasis">{result.you.score}</span>
                <span className="lb-stat-label">score</span>
              </div>
            </div>
          </div>

          <div className="lb-card lb-table-card">
            <h3 className="lb-section-heading">Nearby peers</h3>
            <table className="lb-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Solved</th>
                  <th>Repos</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {result.nearby_peers.map((p) => (
                  <tr
                    key={p.usn || p.full_name}
                    className={p.rank === result.you.rank ? 'lb-row-highlight' : ''}
                  >
                    <td className="lb-rank-cell">{p.rank}</td>
                    <td>
                      <Link to={`/students/${p.usn}`} className="lb-student-cell lb-student-link">
                        <span className="lb-student-name">{p.full_name}</span>
                        <span className="lb-student-usn">{p.usn}</span>
                      </Link>
                    </td>
                    <td>{p.leetcode_total_solved}</td>
                    <td className="lb-muted">{p.github_public_repos}</td>
                    <td><strong>{p.score}</strong></td>
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
      <div className="lb-card">
        <form onSubmit={submit}>
          <div className="lb-form-grid">
            <div className="lb-field">
              <label className="lb-label">GitHub username</label>
              <input className="lb-input" value={github} onChange={(e) => setGithub(e.target.value)} required />
            </div>
            <div className="lb-field">
              <label className="lb-label">Codeforces handle</label>
              <input className="lb-input" value={codeforces} onChange={(e) => setCodeforces(e.target.value)} required />
            </div>
          </div>
          {error && <div className="lb-error" style={{ marginTop: 12 }}>{error}</div>}
          <button className="lb-btn-primary" style={{ marginTop: 16 }} disabled={loading} type="submit">
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </form>
      </div>

      {result && (
        <>
          <div className="lb-form-grid" style={{ marginTop: 20 }}>
            <div className="lb-card">
              <h3 className="lb-section-heading">GitHub</h3>
              {result.github.error ? (
                <p className="lb-error">{result.github.error}</p>
              ) : (
                <div className="lb-mini-stats">
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value">{result.github.public_repos}</span>
                    <span className="lb-stat-label">public repos</span>
                  </div>
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value">{result.github.followers}</span>
                    <span className="lb-stat-label">followers</span>
                  </div>
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value">{result.github.total_stars}</span>
                    <span className="lb-stat-label">total stars</span>
                  </div>
                </div>
              )}
            </div>
            <div className="lb-card">
              <h3 className="lb-section-heading">Codeforces</h3>
              {result.codeforces.error ? (
                <p className="lb-error">{result.codeforces.error}</p>
              ) : (
                <div className="lb-mini-stats">
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value">{result.codeforces.rating}</span>
                    <span className="lb-stat-label">rating</span>
                  </div>
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value">{result.codeforces.max_rating}</span>
                    <span className="lb-stat-label">max rating</span>
                  </div>
                  <div className="lb-mini-stat">
                    <span className="lb-stat-value" style={{ fontSize: '1.1rem' }}>{result.codeforces.rank}</span>
                    <span className="lb-stat-label">rank title</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lb-card lb-genie-card">
            <h3 className="lb-section-heading">
              Genie analysis <GenieBadge mode={result.genie_analysis.mode} />
            </h3>
            <div className="lb-answer-box">{result.genie_analysis.answer}</div>
          </div>
        </>
      )}
    </div>
  )
}

function AskLeaderboard() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([]) // [{question, answer, mode}]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/leaderboard/ask', { question })
      setHistory((h) => [
        ...h,
        {
          question,
          answer: res.data.genie_analysis.answer,
          mode: res.data.genie_analysis.mode,
        },
      ])
      setQuestion('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get an answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="lb-card lb-ask-card">
        <form onSubmit={ask} className="lb-search-row">
          <span className="lb-prompt-marker">&gt;</span>
          <input
            className="lb-input lb-ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Who has the highest LeetCode rating in CSE?"
            required
          />
          <button className="lb-btn-primary" disabled={loading} type="submit">
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>
        {error && <div className="lb-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {history.length === 0 && !loading && (
        <div className="lb-card lb-empty">
          <p>Ask anything about the leaderboard — try "Who's the top ISE student by CGPA?",
          "How many students have solved over 200 LeetCode problems?", or
          "Compare average GitHub repos between CSE and ECE."</p>
        </div>
      )}

      <div className="lb-thread">
        {[...history].reverse().map((item, i) => (
          <div className="lb-card lb-thread-item" key={i}>
            <div className="lb-thread-question">
              <span className="lb-prompt-marker">&gt;</span>
              {item.question}
            </div>
            <div className="lb-answer-box">
              {item.answer}
              <GenieBadge mode={item.mode} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const LB_STYLES = `
.lb-root {
  --lb-bg: #F5F0E1;
  --lb-surface: #FFDE59;
  --lb-surface-raised: #FFFFFF;
  --lb-border: #111111;
  --lb-text: #111111;
  --lb-muted: #4A4636;
  --lb-accent: #FF3EA5;
  --lb-accent-warm: #FF9F1C;
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--lb-text);
  background: transparent;
  padding: 0;
  border-radius: 16px;
}

.lb-header { margin-bottom: 24px; }
.lb-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.9rem;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.lb-subtitle { color: var(--lb-muted); font-size: 0.95rem; margin: 0; max-width: 480px; font-weight: 500; }

.lb-tabs {
  display: inline-flex;
  gap: 6px;
  padding: 5px;
  background: #FFFFFF;
  border: 3px solid var(--lb-border);
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 4px 4px 0px var(--lb-border);
}
.lb-tab {
  font-family: 'Inter', sans-serif;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--lb-muted);
  background: transparent;
  border: 2px solid transparent;
  padding: 9px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.08s ease, background 0.1s ease;
}
.lb-tab:hover { color: var(--lb-text); }
.lb-tab-active {
  color: var(--lb-text);
  background: var(--lb-accent-warm);
  border-color: var(--lb-border);
  font-weight: 700;
}

.lb-card {
  background: var(--lb-surface);
  border: 3px solid var(--lb-border);
  border-radius: 14px;
  padding: 20px 22px;
  margin-bottom: 18px;
  box-shadow: 6px 6px 0px var(--lb-border);
}
.lb-empty { text-align: center; color: var(--lb-muted); padding: 40px 20px; font-weight: 600; }
.lb-error { color: #C4003A; font-weight: 700; font-size: 0.9rem; }

.lb-spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--lb-border);
  border-top-color: var(--lb-accent);
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: lb-spin 0.8s linear infinite;
}
@keyframes lb-spin { to { transform: rotate(360deg); } }

/* Podium */
.lb-podium {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}
.lb-podium-card {
  position: relative;
  background: var(--lb-surface-raised);
  border: 3px solid var(--lb-border);
  border-radius: 16px;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 6px 6px 0px var(--lb-border);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.lb-podium-0 { transform: translateY(-10px); background: var(--lb-surface); }
.lb-podium-rank {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--lb-text);
  background: var(--accent, #FF3EA5);
  border: 2px solid var(--lb-border);
  padding: 2px 10px;
  border-radius: 999px;
  margin-bottom: 8px;
}
.lb-podium-name { font-weight: 700; font-size: 1rem; }
.lb-podium-usn { color: var(--lb-muted); font-size: 0.78rem; margin-top: 2px; font-weight: 600; }
.lb-podium-score {
  font-family: 'Space Grotesk', monospace;
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--lb-text);
  margin: 10px 0 6px;
}
.lb-podium-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--lb-muted);
  font-weight: 600;
}
.lb-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--lb-muted); }

/* Table */
.lb-table-card { padding: 8px; overflow-x: auto; background: #FFFFFF; }
.lb-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.lb-table th {
  text-align: left;
  font-weight: 700;
  color: var(--lb-text);
  font-size: 0.76rem;
  padding: 12px 14px;
  border-bottom: 3px solid var(--lb-border);
}
.lb-table td {
  padding: 12px 14px;
  border-bottom: 2px solid #E6E0CE;
  vertical-align: middle;
}
.lb-table tr:last-child td { border-bottom: none; }
.lb-table tbody tr {
  border-left: 4px solid var(--tier-color, transparent);
}
.lb-rank-cell {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  color: var(--lb-text);
}
.lb-student-cell { display: flex; flex-direction: column; }
.lb-student-link { text-decoration: none; color: inherit; cursor: pointer; }
.lb-student-link:hover .lb-student-name { text-decoration: underline; }
.lb-student-name { font-weight: 700; }
.lb-student-usn { color: var(--lb-muted); font-size: 0.76rem; font-weight: 600; }
.lb-muted { color: var(--lb-muted); }
.lb-tier-chip {
  display: inline-block;
  font-family: 'Space Grotesk', monospace;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 2px 10px;
  border: 2px solid;
  border-radius: 999px;
  background: #fff;
}
.lb-score-cell { display: flex; flex-direction: column; gap: 5px; min-width: 90px; }
.lb-score-num { font-family: 'Space Grotesk', monospace; font-weight: 700; }
.lb-score-bar-track { height: 6px; background: #E6E0CE; border: 1px solid var(--lb-border); border-radius: 2px; overflow: hidden; }
.lb-score-bar-fill { height: 100%; background: var(--lb-accent); border-radius: 2px; }
.lb-row-highlight { background: #FFF3B0; }

/* Forms */
.lb-search-row { display: flex; gap: 10px; align-items: center; }
.lb-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.lb-field { display: flex; flex-direction: column; gap: 6px; }
.lb-label { font-size: 0.8rem; color: var(--lb-muted); font-weight: 700; }
.lb-input {
  background: #FFFFFF;
  border: 2.5px solid var(--lb-border);
  color: var(--lb-text);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.9rem;
  font-family: 'Inter', sans-serif;
  width: 100%;
  outline: none;
  transition: box-shadow 0.1s ease, transform 0.1s ease;
}
.lb-input:focus { box-shadow: 3px 3px 0px var(--lb-border); transform: translate(-1px, -1px); }
.lb-btn-primary {
  background: var(--lb-accent);
  color: #fff;
  border: 2.5px solid var(--lb-border);
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 3px 3px 0px var(--lb-border);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.lb-btn-primary:disabled { opacity: 0.6; cursor: default; box-shadow: none; transform: none; }
.lb-btn-primary:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--lb-border); }
.lb-btn-primary:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: 1px 1px 0px var(--lb-border); }

.lb-section-heading {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 14px;
  padding: 12px 14px 0;
}
.lb-table-card .lb-section-heading { padding-top: 12px; }

/* My rank */
.lb-you-card { padding: 24px; }
.lb-you-main { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; }
.lb-you-rank { display: flex; flex-direction: column; }
.lb-you-rank-num {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--lb-accent-warm);
  -webkit-text-stroke: 1px var(--lb-border);
  line-height: 1;
}
.lb-you-rank-of { color: var(--lb-muted); font-size: 0.78rem; margin-top: 4px; font-weight: 600; }
.lb-you-identity { display: flex; flex-direction: column; flex: 1; }
.lb-you-name { font-weight: 700; font-size: 1.05rem; }
.lb-you-usn { color: var(--lb-muted); font-size: 0.82rem; font-weight: 600; }
.lb-percentile-ring {
  --pct: 0;
  width: 66px; height: 66px;
  border-radius: 50%;
  border: 3px solid var(--lb-border);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', monospace;
  font-weight: 700;
  font-size: 0.82rem;
  background: conic-gradient(var(--lb-accent) calc(var(--pct) * 1%), #E6E0CE 0);
}
.lb-percentile-ring span {
  width: 50px; height: 50px;
  background: var(--lb-surface-raised);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.lb-you-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  padding-top: 18px;
  border-top: 3px solid var(--lb-border);
}
.lb-stat { display: flex; flex-direction: column; align-items: center; text-align: center; }
.lb-stat-value { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1.15rem; }
.lb-stat-emphasis { color: var(--lb-accent); }
.lb-stat-label { color: var(--lb-muted); font-size: 0.74rem; margin-top: 2px; font-weight: 600; }

.lb-mini-stats { display: flex; justify-content: space-around; gap: 10px; padding: 6px 0 2px; }
.lb-mini-stat { display: flex; flex-direction: column; align-items: center; }

.lb-genie-card { border-color: var(--lb-border); background: #FFFFFF; }
.lb-answer-box {
  background: var(--lb-bg);
  border: 2.5px solid var(--lb-border);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 0.9rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

/* Ask */
.lb-prompt-marker {
  font-family: 'Space Grotesk', monospace;
  color: var(--lb-accent);
  font-weight: 700;
  font-size: 1rem;
}
.lb-ask-input { flex: 1; }
.lb-thread { display: flex; flex-direction: column; gap: 12px; }
.lb-thread-item { padding: 16px 18px; background: #FFFFFF; }
.lb-thread-question {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  margin-bottom: 10px;
}

@media (max-width: 720px) {
  .lb-podium { grid-template-columns: 1fr; }
  .lb-podium-0 { transform: none; }
  .lb-you-stats { grid-template-columns: repeat(3, 1fr); }
  .lb-form-grid { grid-template-columns: 1fr; }
}
`