import { useMemo } from 'react'

/**
 * Generic activity heatmap, GitHub-contribution-graph style.
 *
 * Props:
 *  - days: [{ date: 'YYYY-MM-DD', count: number }]  (already normalized —
 *    see StudentProfile.jsx for how LeetCode's unix-timestamp map and
 *    GitHub's day list both get converted to this shape)
 *  - accent: CSS color for the filled cells (defaults per-usage)
 *  - weeksToShow: how many weeks of history to render (default 52)
 */
export default function Heatmap({ days = [], accent = '#E8127F', weeksToShow = 52 }) {
  const { weeks, maxCount } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d.count]))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // align end to the most recent Saturday so columns are full weeks
    const end = new Date(today)
    end.setDate(end.getDate() + (6 - end.getDay()))

    const totalDays = weeksToShow * 7
    const start = new Date(end)
    start.setDate(start.getDate() - totalDays + 1)

    const cells = []
    let max = 1
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const count = byDate.get(key) || 0
      if (count > max) max = count
      cells.push({ date: key, count, isFuture: d > today })
    }

    const weeksArr = []
    for (let i = 0; i < cells.length; i += 7) {
      weeksArr.push(cells.slice(i, i + 7))
    }
    return { weeks: weeksArr, maxCount: max }
  }, [days, weeksToShow])

  const intensity = (count) => {
    if (count <= 0) return 0
    const ratio = count / maxCount
    if (ratio > 0.75) return 4
    if (ratio > 0.5) return 3
    if (ratio > 0.25) return 2
    return 1
  }

  return (
    <div className="heatmap-root">
      <style>{`
        .heatmap-root { --hm-accent: ${accent}; }
        .heatmap-grid { display: flex; gap: 3px; overflow-x: auto; padding-bottom: 4px; }
        .heatmap-week { display: flex; flex-direction: column; gap: 3px; }
        .heatmap-cell {
          width: 11px; height: 11px;
          border-radius: 2px;
          background: #E6E0CE;
          border: 1px solid rgba(17,17,17,0.15);
        }
        .heatmap-cell[data-level="1"] { background: color-mix(in srgb, var(--hm-accent) 45%, #E6E0CE); }
        .heatmap-cell[data-level="2"] { background: color-mix(in srgb, var(--hm-accent) 65%, #E6E0CE); }
        .heatmap-cell[data-level="3"] { background: color-mix(in srgb, var(--hm-accent) 85%, #111111); }
        .heatmap-cell[data-level="4"] { background: color-mix(in srgb, var(--hm-accent) 100%, #111111 25%); }
        .heatmap-cell[data-future="true"] { visibility: hidden; }
        .heatmap-legend { display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 0.72rem; color: #4A4636; font-weight: 600; }
      `}</style>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div className="heatmap-week" key={wi}>
            {week.map((cell) => (
              <div
                key={cell.date}
                className="heatmap-cell"
                data-level={intensity(cell.count)}
                data-future={cell.isFuture}
                title={`${cell.date}: ${cell.count}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((lvl) => (
          <div key={lvl} className="heatmap-cell" data-level={lvl} style={{ width: 10, height: 10 }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}