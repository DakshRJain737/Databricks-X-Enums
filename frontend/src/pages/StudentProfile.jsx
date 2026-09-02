import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api/client'
import Heatmap from '../components/Heatmap.jsx'

export default function StudentProfile() {
  const { usn } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    api.get(`/leaderboard/students/${usn}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load student'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [usn])

  // LeetCode's submissionCalendar is {unix_ts_string: count} — normalize to
  // the {date, count} shape Heatmap expects.
  const leetcodeDays = useMemo(() => {
    const cal = data?.leetcode_heatmap?.submissionCalendar
    if (!cal) return []
    return Object.entries(cal).map(([ts, count]) => ({
      date: new Date(Number(ts) * 1000).toISOString().slice(0, 10),
      count,
    }))
  }, [data])

  const githubDays = data?.github_heatmap?.days || []

  const syncNow = async () => {
    setSyncing(true)
    try {
      await api.post(`/leaderboard/sync/${usn}`)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !data) {
    return <div className="sp-card sp-empty">Loading…</div>
  }
  if (error && !data) {
    return <div className="sp-card sp-error">{error}</div>
  }
  if (!data) return null

  const p = data.profile

  return (
    <div className="sp-root">
      <style>{SP_STYLES}</style>

      <Link to="/leaderboard" className="sp-back">&larr; Back to leaderboard</Link>

      {/* Identity — just who they are + overall rank/score, nothing else */}
      <div className="sp-card sp-header-card">
        <div className="sp-header-main">
          <div className="sp-avatar">{(p.full_name || '?').slice(0, 1).toUpperCase()}</div>
          <div className="sp-identity">
            <h2 className="sp-name">{p.full_name}</h2>
            <span className="sp-usn">{p.usn}</span>
          </div>
          <div className="sp-rank-block">
            <span className="sp-rank-num">#{p.rank}</span>
            <span className="sp-rank-label">rank</span>
          </div>
        </div>
        <div className="sp-actions">
          {p.leetcode_username && (
            <a className="sp-icon-link" href={`https://leetcode.com/${p.leetcode_username}`} target="_blank" rel="noreferrer">
              LeetCode ↗
            </a>
          )}
          {p.github_username && (
            <a className="sp-icon-link" href={`https://github.com/${p.github_username}`} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          )}
          <button className="sp-sync-btn" onClick={syncNow} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {error && <div className="sp-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {/* Academic details — branch/department/cgpa, nothing else */}
      <div className="sp-card">
        <h3 className="sp-section-heading">Academic details</h3>
        <div className="sp-stat-grid sp-stat-grid-3">
          <div className="sp-stat"><span className="sp-stat-value">{p.branch}</span><span className="sp-stat-label">branch</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.department}</span><span className="sp-stat-label">department</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.cgpa}</span><span className="sp-stat-label">cgpa</span></div>
        </div>
      </div>

      {/* Skills — its own section */}
      {p.skills?.length > 0 && (
        <div className="sp-card">
          <h3 className="sp-section-heading">Skills</h3>
          <div className="sp-skills">
            {p.skills.map((s) => <span className="sp-skill-chip" key={s}>{s}</span>)}
          </div>
        </div>
      )}

      {/* LeetCode — stats + heatmap together, nothing else */}
      <div className="sp-card">
        <h3 className="sp-section-heading">LeetCode</h3>
        <div className="sp-stat-grid sp-stat-grid-3">
          <div className="sp-stat"><span className="sp-stat-value">{p.leetcode_total_solved}</span><span className="sp-stat-label">solved</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.leetcode_rating}</span><span className="sp-stat-label">rating</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.leetcode_contests_attended}</span><span className="sp-stat-label">contests</span></div>
        </div>
        {leetcodeDays.length > 0 ? (
          <>
            <Heatmap days={leetcodeDays} accent="#E8127F" />
            <div className="sp-heatmap-meta">
              {data.leetcode_heatmap.totalActiveDays} active days · {data.leetcode_heatmap.streak} day streak
            </div>
          </>
        ) : (
          <p className="sp-muted">No LeetCode activity data available.</p>
        )}
      </div>

      {/* GitHub — stats + heatmap together, nothing else */}
      <div className="sp-card">
        <h3 className="sp-section-heading">GitHub</h3>
        <div className="sp-stat-grid sp-stat-grid-3">
          <div className="sp-stat"><span className="sp-stat-value">{p.github_commit_count}</span><span className="sp-stat-label">commits</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.github_public_repos}</span><span className="sp-stat-label">repos</span></div>
          <div className="sp-stat"><span className="sp-stat-value">{p.github_followers}</span><span className="sp-stat-label">followers</span></div>
        </div>
        {githubDays.length > 0 ? (
          <>
            <Heatmap days={githubDays} accent="#E8127F" />
            <div className="sp-heatmap-meta">
              {data.github_heatmap.totalContributions} contributions in the last year
            </div>
          </>
        ) : (
          <p className="sp-muted">No GitHub activity data available (needs a configured GitHub token on the backend).</p>
        )}
      </div>

      {/* Overall score — separate from the raw per-platform stats above */}
      <div className="sp-card sp-score-card">
        <span className="sp-stat-value sp-stat-emphasis sp-score-big">{p.score}</span>
        <span className="sp-stat-label">composite score</span>
      </div>
    </div>
  )
}

const SP_STYLES = `
.sp-root {
  --lb-bg: #F5F0E1; --lb-surface: #FFDE59; --lb-border: #111111; --lb-text: #111111; --lb-muted: #4A4636; --lb-accent: #FF3EA5;
  font-family: 'Inter', -apple-system, sans-serif; color: var(--lb-text); max-width: 760px; margin: 0 auto;
}
.sp-back { display: inline-block; margin-bottom: 16px; font-weight: 700; color: var(--lb-text); text-decoration: none; }
.sp-back:hover { text-decoration: underline; }
.sp-card { background: #FFFFFF; border: 3px solid var(--lb-border); border-radius: 14px; padding: 20px 22px; margin-bottom: 18px; box-shadow: 6px 6px 0px var(--lb-border); }
.sp-empty, .sp-error { color: var(--lb-muted); font-weight: 600; }
.sp-error { color: #C4003A; }
.sp-header-card { background: var(--lb-surface); }
.sp-header-main { display: flex; align-items: center; gap: 16px; }
.sp-avatar { width: 56px; height: 56px; border-radius: 50%; background: #FFFFFF; border: 3px solid var(--lb-border); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.4rem; flex-shrink: 0; }
.sp-identity { display: flex; flex-direction: column; flex: 1; }
.sp-name { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 1.3rem; }
.sp-usn { color: var(--lb-muted); font-weight: 600; font-size: 0.85rem; }
.sp-rank-block { display: flex; flex-direction: column; align-items: center; }
.sp-rank-num { font-family: 'Space Grotesk', sans-serif; font-size: 1.6rem; font-weight: 700; }
.sp-rank-label { font-size: 0.72rem; color: var(--lb-muted); font-weight: 600; }
.sp-skills { display: flex; gap: 6px; flex-wrap: wrap; }
.sp-skill-chip { background: #FFFFFF; border: 2px solid var(--lb-border); border-radius: 8px; padding: 4px 10px; font-size: 0.78rem; font-weight: 600; }
.sp-stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.sp-stat-grid-3 { grid-template-columns: repeat(3, 1fr); margin-bottom: 18px; padding-bottom: 18px; border-bottom: 3px solid var(--lb-border); }
.sp-stat { display: flex; flex-direction: column; align-items: center; text-align: center; }
.sp-stat-value { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1.1rem; }
.sp-stat-emphasis { color: var(--lb-accent); }
.sp-stat-label { color: var(--lb-muted); font-size: 0.72rem; margin-top: 2px; font-weight: 600; }
.sp-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
.sp-score-card { display: flex; flex-direction: column; align-items: center; background: var(--lb-surface); }
.sp-score-big { font-size: 2.4rem !important; }
.sp-icon-link { background: #FFFFFF; border: 2.5px solid var(--lb-border); border-radius: 8px; padding: 8px 14px; font-weight: 700; font-size: 0.85rem; text-decoration: none; color: var(--lb-text); box-shadow: 3px 3px 0px var(--lb-border); }
.sp-sync-btn { background: var(--lb-accent); color: #fff; border: 2.5px solid var(--lb-border); border-radius: 8px; padding: 8px 14px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 3px 3px 0px var(--lb-border); }
.sp-sync-btn:disabled { opacity: 0.6; cursor: default; }
.sp-section-heading { font-family: 'Space Grotesk', sans-serif; font-size: 1rem; font-weight: 700; margin: 0 0 14px; }
.sp-heatmap-meta { margin-top: 10px; font-size: 0.8rem; color: var(--lb-muted); font-weight: 600; }
.sp-muted { color: var(--lb-muted); font-weight: 600; }
@media (max-width: 640px) {
  .sp-stat-grid { grid-template-columns: repeat(3, 1fr); }
}
`