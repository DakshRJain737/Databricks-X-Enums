import { useState, useMemo } from 'react'
import api from '../api/client'

const STATE_META = {
  match: { label: 'Match', bg: '#B9FF66' },
  close: { label: 'Close', bg: '#FFD166' },
  gap: { label: 'Gap', bg: '#FF8A8A' },
  not_required: { label: 'Not required', bg: '#F0EEE0' },
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'Strong match' },
  { id: 'almost', label: 'Almost ready' },
  { id: 'gaps', label: 'Biggest gaps' },
]

function driveMatchesFilter(drive, filter, requiredLevel) {
  if (!drive) return false
  if (filter === 'all') return true
  if (filter === 'strong') return drive.eligible && drive.skill_match_pct >= requiredLevel
  if (filter === 'almost') return drive.eligible && drive.skill_match_pct >= 40 && drive.skill_match_pct < requiredLevel
  if (filter === 'gaps') return !drive.eligible || drive.skill_match_pct < 40
  return true
}

export default function OpportunityHeatmap({ data, eligibility }) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [simTarget, setSimTarget] = useState(85)
  const [simResult, setSimResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState('')

  const heatmap = data.heatmap
  const gapAnalysis = data.gap_analysis
  const skillScores = data.skill_scores
  const requiredLevel = heatmap.required_level

  const drivesByKey = useMemo(
    () => Object.fromEntries(gapAnalysis.drives.map((d) => [d.key, d])),
    [gapAnalysis]
  )

  const visibleColumns = useMemo(
    () => heatmap.columns.filter((c) => driveMatchesFilter(drivesByKey[c.key], filter, requiredLevel)),
    [heatmap.columns, drivesByKey, filter, requiredLevel]
  )

  const visibleRows = useMemo(
    () => heatmap.rows.filter((row) => visibleColumns.some((c) => row.cells[c.key].state !== 'not_required')),
    [heatmap.rows, visibleColumns]
  )

  const maxImpact = gapAnalysis.biggest_gaps[0]?.opportunities_affected || 1

  const impactFor = (skill) =>
    gapAnalysis.biggest_gaps.find((g) => g.skill === skill)?.opportunities_affected || 0

  const changedDrives = useMemo(() => {
    if (!simResult || !selected) return []
    const beforeRow = simResult.before.heatmap.rows.find((r) => r.skill === selected.skill)
    const afterRow = simResult.after.heatmap.rows.find((r) => r.skill === selected.skill)
    if (!beforeRow || !afterRow) return []
    return heatmap.columns.filter((c) => beforeRow.cells[c.key].state !== afterRow.cells[c.key].state)
  }, [simResult, selected, heatmap.columns])

  const openCell = (skill, col, cell) => {
    if (cell.state === 'not_required') return
    setSelected({ skill, driveKey: col.key, company: col.company, role: col.role, ...cell })
    setSimResult(null)
    setSimError('')
    setSimTarget(Math.min(100, Math.max(cell.score + 15, requiredLevel)))
  }

  const runSimulation = async () => {
    if (!selected) return
    setSimLoading(true)
    setSimError('')
    try {
      const res = await api.post('/placement/simulate', {
        skill_scores: skillScores,
        eligibility: eligibility.map((e) => ({ company: e.company, role: e.role, eligible: e.eligible })),
        skill: selected.skill,
        new_score: simTarget,
      })
      setSimResult(res.data)
    } catch (err) {
      setSimError(err.response?.data?.detail || 'Simulation failed')
    } finally {
      setSimLoading(false)
    }
  }

  return (
    <div className="og-root">
      <style>{OG_STYLES}</style>

      <div className="og-header">
        <h2 className="og-title">Opportunity Intelligence</h2>
        <p className="og-subtitle">
          Where your skills stand against every drive you're eligible for, and what closes the gap fastest.
        </p>
      </div>

      <div className="og-stats-row">
        <div className="og-stat-chip">
          <span className="og-stat-value">{gapAnalysis.strong_opportunities}/{gapAnalysis.total_opportunities}</span>
          <span className="og-stat-label">strong opportunities</span>
        </div>
        <div className="og-stat-chip">
          <span className="og-stat-value">{gapAnalysis.biggest_gaps.length}</span>
          <span className="og-stat-label">skills with a gap</span>
        </div>
        <div className="og-stat-chip">
          <span className="og-stat-value">{requiredLevel}+</span>
          <span className="og-stat-label">signal counted as a match</span>
        </div>
      </div>

      <div className="og-drive-row">
        {gapAnalysis.drives.map((d) => (
          <div key={d.key} className={`og-drive-card ${d.eligible ? 'og-drive-eligible' : 'og-drive-ineligible'}`}>
            <div className="og-drive-card-head">
              <div className="og-drive-identity">
                <span className="og-drive-company">{d.company}</span>
                <span className="og-drive-role">{d.role}</span>
              </div>
              <span className={`og-pill ${d.eligible ? 'og-pill-ok' : 'og-pill-bad'}`}>
                {d.eligible ? 'Eligible' : 'Not eligible'}
              </span>
            </div>
            <div className="og-drive-match">
              <span className="og-drive-match-num">{d.skill_match_pct}%</span>
              <span className="og-drive-match-label">skill match</span>
            </div>
            <div className="og-chip-row">
              {d.gap_skills.map((s) => (
                <span key={s} className="og-chip og-chip-gap">{s}</span>
              ))}
              {d.close_skills.map((s) => (
                <span key={s} className="og-chip og-chip-close">{s}</span>
              ))}
              {d.gap_skills.length === 0 && d.close_skills.length === 0 && (
                <span className="og-chip og-chip-clean">all required skills matched</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="og-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={`og-filter-tab${filter === f.id ? ' og-filter-tab-active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="og-hint">Click any cell to see the requirement, then simulate closing that gap.</p>

      <div className="og-body">
        <div className="og-heatmap-card">
          {visibleColumns.length === 0 ? (
            <div className="og-empty">No drives match this filter.</div>
          ) : (
            <div className="og-heatmap-scroll">
              <table className="og-heatmap-table">
                <thead>
                  <tr>
                    <th className="og-skill-col">Skill</th>
                    {visibleColumns.map((c) => (
                      <th key={c.key} className="og-col-head">
                        <span className="og-col-company">{c.company}</span>
                        <span className="og-col-role">{c.role}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.skill}>
                      <td className="og-skill-cell">{row.skill}</td>
                      {visibleColumns.map((c) => {
                        const cell = row.cells[c.key]
                        const meta = STATE_META[cell.state]
                        const isSelected = selected && selected.skill === row.skill && selected.driveKey === c.key
                        return (
                          <td key={c.key} className="og-cell-wrap">
                            <button
                              type="button"
                              className={`og-cell og-cell-${cell.state}${isSelected ? ' og-cell-selected' : ''}`}
                              style={{ '--cell-bg': meta.bg }}
                              onClick={() => openCell(row.skill, c, cell)}
                              disabled={cell.state === 'not_required'}
                            >
                              {cell.state === 'not_required' ? '–' : cell.score}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="og-legend">
            {Object.entries(STATE_META).map(([key, meta]) => (
              <span key={key} className="og-legend-item">
                <span className="og-legend-swatch" style={{ background: meta.bg }} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        <div className="og-sidebar">
          <div className="og-gaps-card">
            <h3 className="og-section-heading">Biggest gaps</h3>
            {gapAnalysis.biggest_gaps.length === 0 ? (
              <p className="og-muted">No gaps detected — every listed skill is at or above the required signal.</p>
            ) : (
              gapAnalysis.biggest_gaps.map((g) => (
                <div key={g.skill} className="og-gap-row">
                  <span className="og-gap-skill">{g.skill}</span>
                  <div className="og-gap-bar-track">
                    <div className="og-gap-bar-fill" style={{ width: `${(g.opportunities_affected / maxImpact) * 100}%` }} />
                  </div>
                  <span className="og-gap-count">{g.opportunities_affected}</span>
                </div>
              ))
            )}
          </div>

          {selected && (
            <div className="og-detail-card">
              <div className="og-detail-head">
                <div>
                  <h3 className="og-section-heading">{selected.skill} × {selected.company}</h3>
                  <p className="og-muted" style={{ margin: 0 }}>{selected.role}</p>
                </div>
                <button className="og-detail-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
              </div>

              <div className="og-detail-stat-grid">
                <div className="og-detail-stat">
                  <span className="og-detail-stat-value">{selected.score}</span>
                  <span className="og-detail-stat-label">your signal</span>
                </div>
                <div className="og-detail-stat">
                  <span className="og-detail-stat-value">{STATE_META[selected.state].label}</span>
                  <span className="og-detail-stat-label">status</span>
                </div>
                <div className="og-detail-stat">
                  <span className="og-detail-stat-value">{impactFor(selected.skill)}</span>
                  <span className="og-detail-stat-label">opportunities affected</span>
                </div>
              </div>

              {selected.state !== 'match' && (
                <div className="og-simulate">
                  <label className="og-label">What if {selected.skill} were at</label>
                  <div className="og-simulate-row">
                    <input
                      type="range"
                      min={requiredLevel}
                      max="100"
                      value={simTarget}
                      onChange={(e) => setSimTarget(Number(e.target.value))}
                    />
                    <span className="og-simulate-value">{simTarget}</span>
                    <button className="og-btn-primary" onClick={runSimulation} disabled={simLoading}>
                      {simLoading ? 'Simulating…' : 'Simulate'}
                    </button>
                  </div>
                  {simError && <div className="og-error">{simError}</div>}
                  {simResult && (
                    <div className="og-sim-result">
                      <div className="og-sim-delta">
                        <span>{simResult.before.gap_analysis.strong_opportunities}</span>
                        <span className="og-sim-arrow">→</span>
                        <span className="og-sim-after">{simResult.after.gap_analysis.strong_opportunities}</span>
                        <span className="og-muted">strong opportunities</span>
                      </div>
                      <p className="og-muted" style={{ marginTop: 6 }}>
                        {changedDrives.length > 0
                          ? `Raising ${selected.skill} to ${simTarget} changes its status at ${changedDrives.map((c) => c.company).join(', ')}.`
                          : `Raising ${selected.skill} to ${simTarget} doesn't flip any drive's status on its own — it may need another skill improved alongside it.`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const OG_STYLES = `
.og-root {
  --og-bg: #F5F0E1;
  --og-surface: #FFDE59;
  --og-surface-2: #FFFFFF;
  --og-border: #111111;
  --og-text: #111111;
  --og-muted: #4A4636;
  --og-accent: #FF3EA5;
  --og-accent-warm: #FF9F1C;
  --og-match: #B9FF66;
  --og-close: #FFD166;
  --og-gap: #FF8A8A;
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--og-text);
}

.og-header { margin-bottom: 18px; }
.og-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.6rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }
.og-subtitle { color: var(--og-muted); font-size: 0.92rem; margin: 0; max-width: 560px; font-weight: 500; }

.og-stats-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
.og-stat-chip {
  background: var(--og-surface-2);
  border: 3px solid var(--og-border);
  border-radius: 12px;
  padding: 12px 18px;
  box-shadow: 4px 4px 0px var(--og-border);
  display: flex;
  flex-direction: column;
  min-width: 150px;
}
.og-stat-value { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1.4rem; }
.og-stat-label { color: var(--og-muted); font-size: 0.74rem; font-weight: 600; margin-top: 2px; }

.og-drive-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.og-drive-card {
  background: var(--og-surface-2);
  border: 3px solid var(--og-border);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 5px 5px 0px var(--og-border);
  border-left-width: 6px;
}
.og-drive-eligible { border-left-color: var(--og-accent); }
.og-drive-ineligible { border-left-color: var(--og-gap); }
.og-drive-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.og-drive-identity { display: flex; flex-direction: column; }
.og-drive-company { font-weight: 700; font-size: 0.98rem; }
.og-drive-role { color: var(--og-muted); font-size: 0.76rem; font-weight: 600; }
.og-pill {
  display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 3px 9px;
  border: 2px solid var(--og-border); border-radius: 999px; white-space: nowrap;
}
.og-pill-ok { background: var(--og-match); }
.og-pill-bad { background: var(--og-gap); }
.og-drive-match { display: flex; align-items: baseline; gap: 6px; margin: 10px 0 8px; }
.og-drive-match-num { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1.3rem; }
.og-drive-match-label { color: var(--og-muted); font-size: 0.74rem; font-weight: 600; }
.og-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.og-chip {
  font-size: 0.7rem; font-weight: 700; padding: 3px 9px; border: 2px solid var(--og-border);
  border-radius: 999px; background: var(--og-bg);
}
.og-chip-gap { background: var(--og-gap); }
.og-chip-close { background: var(--og-close); }
.og-chip-clean { background: var(--og-match); }

.og-filters {
  display: inline-flex; gap: 6px; padding: 5px;
  background: var(--og-surface-2); border: 3px solid var(--og-border); border-radius: 12px;
  box-shadow: 4px 4px 0px var(--og-border); margin-bottom: 8px;
}
.og-filter-tab {
  font-family: 'Inter', sans-serif; font-size: 0.84rem; font-weight: 700; color: var(--og-muted);
  background: transparent; border: 2px solid transparent; padding: 8px 14px; border-radius: 8px; cursor: pointer;
}
.og-filter-tab:hover { color: var(--og-text); }
.og-filter-tab-active { color: var(--og-text); background: var(--og-accent-warm); border-color: var(--og-border); }
.og-hint { color: var(--og-muted); font-size: 0.8rem; font-weight: 600; margin: 0 0 16px; }

.og-body { display: grid; grid-template-columns: 2fr 1fr; gap: 18px; align-items: start; }

.og-heatmap-card {
  background: var(--og-surface-2); border: 3px solid var(--og-border); border-radius: 14px;
  padding: 14px; box-shadow: 6px 6px 0px var(--og-border);
}
.og-empty { text-align: center; color: var(--og-muted); padding: 40px 20px; font-weight: 600; }
.og-heatmap-scroll { overflow-x: auto; }
.og-heatmap-table { border-collapse: separate; border-spacing: 6px; }
.og-skill-col { position: sticky; left: 0; background: var(--og-surface-2); z-index: 1; }
.og-skill-cell {
  position: sticky; left: 0; background: var(--og-surface-2); font-weight: 700; font-size: 0.82rem;
  padding: 6px 10px; white-space: nowrap; border-right: 2px solid var(--og-border);
}
.og-col-head { padding: 4px 6px 8px; text-align: center; }
.og-col-company { display: block; font-weight: 700; font-size: 0.78rem; }
.og-col-role { display: block; color: var(--og-muted); font-size: 0.68rem; font-weight: 600; }
.og-cell-wrap { text-align: center; }
.og-cell {
  width: 52px; height: 40px; border: 2.5px solid var(--og-border); border-radius: 8px;
  background: var(--cell-bg); font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 0.85rem;
  cursor: pointer; transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.og-cell:not(:disabled):hover { transform: translate(-2px, -2px); box-shadow: 3px 3px 0px var(--og-border); }
.og-cell:disabled { cursor: default; opacity: 0.55; }
.og-cell-selected { outline: 3px solid var(--og-border); transform: translate(-2px, -2px); box-shadow: 3px 3px 0px var(--og-border); }
.og-legend { display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 6px 2px; font-size: 0.76rem; color: var(--og-muted); font-weight: 600; }
.og-legend-item { display: flex; align-items: center; gap: 6px; }
.og-legend-swatch { width: 12px; height: 12px; border-radius: 3px; border: 2px solid var(--og-border); display: inline-block; }

.og-sidebar { display: flex; flex-direction: column; gap: 16px; }
.og-gaps-card, .og-detail-card {
  background: var(--og-surface-2); border: 3px solid var(--og-border); border-radius: 14px;
  padding: 16px 18px; box-shadow: 6px 6px 0px var(--og-border);
}
.og-section-heading { font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem; font-weight: 700; margin: 0 0 12px; }
.og-muted { color: var(--og-muted); font-size: 0.82rem; font-weight: 500; }
.og-gap-row { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.og-gap-skill { font-size: 0.78rem; font-weight: 700; width: 92px; flex-shrink: 0; }
.og-gap-bar-track { flex: 1; height: 10px; background: var(--og-bg); border: 2px solid var(--og-border); border-radius: 4px; overflow: hidden; }
.og-gap-bar-fill { height: 100%; background: var(--og-accent); }
.og-gap-count { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 0.78rem; width: 16px; text-align: right; }

.og-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.og-detail-close {
  background: var(--og-bg); border: 2px solid var(--og-border); border-radius: 8px; width: 28px; height: 28px;
  font-size: 1rem; line-height: 1; cursor: pointer; font-weight: 700; padding: 0; box-shadow: 2px 2px 0px var(--og-border);
}
.og-detail-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
.og-detail-stat { display: flex; flex-direction: column; background: var(--og-bg); border: 2px solid var(--og-border); border-radius: 8px; padding: 8px 6px; text-align: center; }
.og-detail-stat-value { font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1rem; }
.og-detail-stat-label { color: var(--og-muted); font-size: 0.66rem; font-weight: 600; margin-top: 2px; }

.og-simulate { border-top: 2.5px solid var(--og-border); padding-top: 14px; margin-top: 4px; }
.og-label { font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 8px; }
.og-simulate-row { display: flex; align-items: center; gap: 10px; }
.og-simulate-row input[type='range'] { flex: 1; }
.og-simulate-value { font-family: 'Space Grotesk', monospace; font-weight: 700; min-width: 26px; text-align: right; }
.og-btn-primary {
  background: var(--og-accent); color: #fff; border: 2.5px solid var(--og-border); border-radius: 8px;
  padding: 8px 14px; font-size: 0.82rem; font-weight: 700; cursor: pointer; white-space: nowrap;
  box-shadow: 3px 3px 0px var(--og-border); transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.og-btn-primary:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--og-border); }
.og-btn-primary:disabled { opacity: 0.6; cursor: default; box-shadow: none; transform: none; }
.og-error { color: #C4003A; font-weight: 700; font-size: 0.8rem; margin-top: 10px; }
.og-sim-result { margin-top: 12px; background: var(--og-bg); border: 2px solid var(--og-border); border-radius: 10px; padding: 12px 14px; }
.og-sim-delta { display: flex; align-items: center; gap: 8px; font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 1.1rem; }
.og-sim-arrow { color: var(--og-accent); }
.og-sim-after { color: var(--og-accent); }

@media (max-width: 860px) {
  .og-body { grid-template-columns: 1fr; }
  .og-detail-stat-grid { grid-template-columns: repeat(3, 1fr); }
}
`
