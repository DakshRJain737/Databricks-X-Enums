import { useEffect, useState } from 'react'
import api from '../api/client'
import SkillTagInput from '../components/SkillTagInput.jsx'

export default function Profile() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load your profile'))
      .finally(() => setLoading(false))
  }, [])

  const field = (key) => ({
    value: data?.[key] ?? '',
    onChange: (e) => setData((d) => ({ ...d, [key]: e.target.value })),
  })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      const res = await api.patch('/users/me', {
        full_name: data.full_name,
        usn: data.usn,
        branch: data.branch,
        department: data.department,
        cgpa: data.cgpa === '' ? 0 : parseFloat(data.cgpa),
        skills: data.skills || [],
        leetcode_username: data.leetcode_username,
        github_username: data.github_username,
      })
      setData(res.data)
      setSaved(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="profile-shell"><style>{PROFILE_STYLES}</style>Loading…</div>
  if (!data) return <div className="profile-shell"><style>{PROFILE_STYLES}</style>{error || 'Something went wrong'}</div>

  return (
    <div className="profile-shell">
      <style>{PROFILE_STYLES}</style>
      <div className="profile-card">
        <h2 className="profile-heading">Your profile</h2>
        <p className="profile-email">{data.email}</p>

        <form onSubmit={submit} className="profile-form">
          <div className="profile-row-2">
            <div className="profile-field">
              <label className="profile-label">Full name</label>
              <input className="profile-input" {...field('full_name')} />
            </div>
            <div className="profile-field">
              <label className="profile-label">USN</label>
              <input className="profile-input" {...field('usn')} />
            </div>
          </div>
          <div className="profile-row-2">
            <div className="profile-field">
              <label className="profile-label">Branch</label>
              <select className="profile-input profile-select" {...field('branch')}>
                <option value="CSE">CSE</option>
                <option value="ISE">ISE</option>
                <option value="AIML">AIML</option>
                <option value="ECE">ECE</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="profile-field">
              <label className="profile-label">Department</label>
              <input className="profile-input" {...field('department')} />
            </div>
          </div>
          <div className="profile-row-2">
            <div className="profile-field">
              <label className="profile-label">CGPA</label>
              <input
                className="profile-input"
                type="number"
                step="0.01"
                min="0"
                max="10"
                {...field('cgpa')}
              />
            </div>
            <div className="profile-field">
              <label className="profile-label">LeetCode username</label>
              <input className="profile-input" {...field('leetcode_username')} />
            </div>
          </div>
          <div className="profile-field">
            <label className="profile-label">GitHub username</label>
            <input className="profile-input" {...field('github_username')} />
          </div>
          <div className="profile-field">
            <label className="profile-label">Skills</label>
            <SkillTagInput
              value={data.skills || []}
              onChange={(skills) => setData((d) => ({ ...d, skills }))}
            />
          </div>

          {(data.leetcode_total_solved > 0 || data.github_public_repos > 0) && (
            <div className="profile-stats">
              {data.leetcode_total_solved > 0 && (
                <span className="profile-stat-pill">LeetCode: {data.leetcode_total_solved} solved</span>
              )}
              {data.github_public_repos > 0 && (
                <span className="profile-stat-pill">GitHub: {data.github_public_repos} repos, {data.github_followers} followers</span>
              )}
            </div>
          )}

          {saved && <div className="profile-info">Saved!</div>}
          {error && <div className="profile-error">{error}</div>}
          <button className="profile-submit" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

const PROFILE_STYLES = `
.profile-shell { padding: 8px 20px 40px; font-family: 'Inter', -apple-system, sans-serif; }
.profile-card {
  max-width: 620px;
  background: #FFDE59;
  border: 3px solid #111111;
  border-radius: 14px;
  padding: 28px 30px 30px;
  box-shadow: 8px 8px 0px #111111;
}
.profile-heading {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 1.3rem;
  color: #111111;
  margin: 0 0 2px;
}
.profile-email { color: #4A4636; font-size: 0.85rem; font-weight: 600; margin: 0 0 22px; }
.profile-form { display: flex; flex-direction: column; gap: 16px; }
.profile-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.profile-field { display: flex; flex-direction: column; gap: 6px; }
.profile-label { font-size: 0.8rem; color: #111111; font-weight: 700; }
.profile-input {
  background: #FFFFFF;
  border: 2.5px solid #111111;
  color: #111111;
  border-radius: 8px;
  padding: 11px 13px;
  font-size: 0.92rem;
  font-family: 'Inter', sans-serif;
  outline: none;
  width: 100%;
}
.profile-input:focus { box-shadow: 3px 3px 0px #111111; transform: translate(-1px, -1px); }
.profile-select {
  appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2.5'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 34px;
}
.profile-stats { display: flex; gap: 8px; flex-wrap: wrap; }
.profile-stat-pill {
  background: #FFFFFF;
  border: 2px solid #111111;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #111111;
}
.profile-info {
  color: #111111; font-size: 0.85rem; font-weight: 700;
  background: #C6F6C6; border: 2.5px solid #111111; border-radius: 8px; padding: 9px 12px;
}
.profile-error {
  color: #111111; font-size: 0.85rem; font-weight: 700;
  background: #FF8A8A; border: 2.5px solid #111111; border-radius: 8px; padding: 9px 12px;
}
.profile-submit {
  align-self: flex-start;
  margin-top: 4px;
  background: #FF3EA5;
  color: #FFFFFF;
  border: 2.5px solid #111111;
  border-radius: 8px;
  padding: 11px 22px;
  font-size: 0.9rem;
  font-weight: 700;
  font-family: 'Space Grotesk', 'Inter', sans-serif;
  cursor: pointer;
  box-shadow: 4px 4px 0px #111111;
}
.profile-submit:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px #111111; }
.profile-submit:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
@media (max-width: 520px) {
  .profile-row-2 { grid-template-columns: 1fr; }
}
`