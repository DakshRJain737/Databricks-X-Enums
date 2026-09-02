import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'
import GenieBadge from '../components/GenieBadge.jsx'
import FloorPlan from '../components/FloorPlan.jsx'

//added here
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
//added here

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// Half-hour grid, 8am - 6pm. Adjust to match your campus's actual class hours.
const HOURS = Array.from({ length: 20 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

export default function Facility() {
  const [tab, setTab] = useState('plan') // 'plan' | 'grid' | 'check' | 'book' | 'ask'
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSlots = () => {
    setLoading(true)
    setError('')
    api.get('/facility')
      .then((res) => setSlots(res.data.slots))
      .catch((err) => setError(err.response?.data?.detail || 'Failed to load facility data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSlots() }, [])

  const tabs = [
    { id: 'plan', label: 'Floor plan' },
    { id: 'grid', label: 'Occupancy grid' },
    { id: 'check', label: 'Check a room' },
    { id: 'book', label: 'Book a slot' },
    { id: 'ask', label: 'Ask a question' },
  ]

  return (
    <div className="fc-root">
      <style>{FC_STYLES}</style>

      <div className="fc-header">
        <h2 className="fc-title">Facility Utilisation</h2>
        <p className="fc-subtitle">See which classrooms and labs are free or occupied, by floor, day, and time.</p>
      </div>

      <div className="fc-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`fc-tab${tab === t.id ? ' fc-tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="fc-card fc-error">{error}</div>}

      <div className="fc-panel">
        {tab === 'plan' && <FloorPlan slots={slots} loading={loading} onBooked={loadSlots} />}
        {tab === 'grid' && <OccupancyGrid slots={slots} loading={loading} />}
        {tab === 'check' && <CheckRoom slots={slots} loading={loading} />}
        {tab === 'book' && <BookSlot onBooked={loadSlots} />}
        {tab === 'ask' && <AskFacility />}
      </div>
    </div>
  )
}

function OccupancyGrid({ slots, loading }) {
  const [day, setDay] = useState('Monday')
  const [floorFilter, setFloorFilter] = useState('all')

  const floors = useMemo(
    () => [...new Set(slots.map((s) => s.floor_number))].sort((a, b) => a - b),
    [slots]
  )

  const dayRooms = useMemo(() => {
    const bySlot = slots.filter((s) => s.day_of_week === day)
    const roomSet = new Map()
    bySlot.forEach((s) => {
      if (floorFilter !== 'all' && String(s.floor_number) !== floorFilter) return
      if (!roomSet.has(s.room_number)) {
        roomSet.set(s.room_number, { room_number: s.room_number, floor_number: s.floor_number, room_type: s.room_type })
      }
    })
    // Also show rooms that appear on other days but not this one, so an "all free" room is visible
    slots.forEach((s) => {
      if (floorFilter !== 'all' && String(s.floor_number) !== floorFilter) return
      if (!roomSet.has(s.room_number)) {
        roomSet.set(s.room_number, { room_number: s.room_number, floor_number: s.floor_number, room_type: s.room_type })
      }
    })
    return [...roomSet.values()].sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }))
  }, [slots, day, floorFilter])

  if (loading) {
    return <div className="fc-card fc-empty"><div className="fc-spinner" /><p>Loading occupancy…</p></div>
  }
  if (dayRooms.length === 0) {
    return <div className="fc-card fc-empty"><p>No rooms tracked yet. Book a slot to get started.</p></div>
  }

  return (
    <div>
      <div className="fc-filters">
        <div className="fc-day-tabs">
          {DAYS.map((d) => (
            <button key={d} className={`fc-day-tab${day === d ? ' fc-day-tab-active' : ''}`} onClick={() => setDay(d)}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <select className="fc-select" value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
          <option value="all">All floors</option>
          {floors.map((f) => <option key={f} value={f}>Floor {f}</option>)}
        </select>
      </div>

      <div className="fc-card fc-grid-card">
        <div className="fc-grid-scroll">
          <table className="fc-grid-table">
            <thead>
              <tr>
                <th className="fc-grid-room-col">Room</th>
                {HOURS.map((h) => <th key={h} className="fc-grid-hour">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dayRooms.map((r) => {
                const roomSlots = slots.filter((s) => s.room_number === r.room_number && s.day_of_week === day)
                return (
                  <tr key={r.room_number}>
                    <td className="fc-grid-room-cell">
                      <span className="fc-room-name">{r.room_number}</span>
                      <span className={`fc-room-type-chip fc-room-type-${r.room_type}`}>{r.room_type}</span>
                      <span className="fc-room-floor">Floor {r.floor_number}</span>
                    </td>
                    {HOURS.map((h, i) => {
                      const hEnd = HOURS[i + 1] || '23:59'
                      const occupying = roomSlots.find((s) => timesOverlap(s.start_time, s.end_time, h, hEnd))
                      return (
                        <td key={h} className={`fc-grid-cell${occupying ? ' fc-grid-cell-occupied' : ' fc-grid-cell-free'}`}>
                          {occupying && <span className="fc-grid-cell-tooltip">{occupying.start_time}-{occupying.end_time}<br />{occupying.purpose || 'Occupied'}</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="fc-legend">
          <span className="fc-legend-item"><span className="fc-legend-swatch fc-legend-free" /> Free</span>
          <span className="fc-legend-item"><span className="fc-legend-swatch fc-legend-occupied" /> Occupied</span>
        </div>
      </div>
    </div>
  )
}

function CheckRoom({ slots, loading }) {
  const [roomNumber, setRoomNumber] = useState('')
  const [day, setDay] = useState('Monday')
  const [time, setTime] = useState('')
  const [result, setResult] = useState(null)

  const check = (e) => {
    e.preventDefault()
    const matches = slots.filter(
      (s) => s.room_number.toLowerCase() === roomNumber.trim().toLowerCase() && s.day_of_week === day
    )
    const clashing = matches.filter((s) => time && s.start_time <= time && time < s.end_time)
    setResult({
      roomNumber: roomNumber.trim(),
      day,
      time,
      isFree: clashing.length === 0,
      clashing,
      allSlotsForDay: matches.sort((a, b) => a.start_time.localeCompare(b.start_time)),
    })
  }

  return (
    <div>
      <div className="fc-card">
        <form onSubmit={check} className="fc-form-grid">
          <div className="fc-field">
            <label className="fc-label">Room number</label>
            <input className="fc-input" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="e.g. 204 or Lab-3" required />
          </div>
          <div className="fc-field">
            <label className="fc-label">Day</label>
            <select className="fc-input" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="fc-field">
            <label className="fc-label">Time</label>
            <input className="fc-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <button className="fc-btn-primary fc-btn-align" type="submit" disabled={loading}>Check</button>
        </form>
      </div>

      {result && (
        <div className={`fc-card fc-result-card ${result.isFree ? 'fc-result-free' : 'fc-result-occupied'}`}>
          <div className="fc-result-headline">
            <span className={`fc-status-dot ${result.isFree ? 'fc-status-free' : 'fc-status-occupied'}`} />
            <strong>{result.roomNumber || 'Room'}</strong> is{' '}
            <strong>{result.isFree ? 'FREE' : 'OCCUPIED'}</strong> on {result.day} at {result.time}
          </div>
          {!result.isFree && result.clashing.map((c) => (
            <p key={c.id} className="fc-muted">Booked {c.start_time}–{c.end_time}: {c.purpose || 'No purpose given'}</p>
          ))}

          {result.allSlotsForDay.length > 0 && (
            <>
              <h3 className="fc-section-heading">All bookings for {result.roomNumber} on {result.day}</h3>
              <table className="fc-table">
                <thead><tr><th>Time</th><th>Purpose</th></tr></thead>
                <tbody>
                  {result.allSlotsForDay.map((s) => (
                    <tr key={s.id}><td>{s.start_time}–{s.end_time}</td><td className="fc-muted">{s.purpose || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BookSlot({ onBooked }) {
  const [form, setForm] = useState({
    room_number: '', room_type: 'classroom', floor_number: '', day_of_week: 'Monday',
    start_time: '', end_time: '', purpose: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/facility', { ...form, floor_number: Number(form.floor_number) })
      setSuccess(`Booked ${form.room_number} on ${form.day_of_week}, ${form.start_time}–${form.end_time}`)
      setForm((f) => ({ ...f, start_time: '', end_time: '', purpose: '' }))
      onBooked?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to book slot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fc-card">
      <form onSubmit={submit}>
        <div className="fc-form-grid fc-form-grid-3">
          <div className="fc-field">
            <label className="fc-label">Room number</label>
            <input className="fc-input" value={form.room_number} onChange={set('room_number')} required />
          </div>
          <div className="fc-field">
            <label className="fc-label">Room type</label>
            <select className="fc-input" value={form.room_type} onChange={set('room_type')}>
              <option value="classroom">Classroom</option>
              <option value="lab">Lab</option>
            </select>
          </div>
          <div className="fc-field">
            <label className="fc-label">Floor number</label>
            <input className="fc-input" type="number" value={form.floor_number} onChange={set('floor_number')} required />
          </div>
          <div className="fc-field">
            <label className="fc-label">Day</label>
            <select className="fc-input" value={form.day_of_week} onChange={set('day_of_week')}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="fc-field">
            <label className="fc-label">Start time</label>
            <input className="fc-input" type="time" value={form.start_time} onChange={set('start_time')} required />
          </div>
          <div className="fc-field">
            <label className="fc-label">End time</label>
            <input className="fc-input" type="time" value={form.end_time} onChange={set('end_time')} required />
          </div>
          <div className="fc-field fc-field-span2">
            <label className="fc-label">Purpose (optional)</label>
            <input className="fc-input" value={form.purpose} onChange={set('purpose')} placeholder="e.g. DBMS lecture, ML lab batch A" />
          </div>
        </div>
        {error && <div className="fc-error" style={{ marginTop: 12 }}>{error}</div>}
        {success && <div className="fc-success" style={{ marginTop: 12 }}>{success}</div>}
        <button className="fc-btn-primary" style={{ marginTop: 16 }} disabled={loading} type="submit">
          {loading ? 'Booking…' : 'Book slot'}
        </button>
      </form>
    </div>
  )
}

function AskFacility() {
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/facility/ask', { question })
      setHistory((h) => [...h, { question, answer: res.data.genie_analysis.answer, mode: res.data.genie_analysis.mode }])
      setQuestion('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get an answer')
    } finally {
      setLoading(false)
    }
  }

  
return (
    <div>
      <div className="fc-card">
        <form onSubmit={ask} className="fc-search-row">
          <span className="fc-prompt-marker">&gt;</span>
          <input
            className="fc-input fc-ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which classrooms on floor 2 are free between 2pm and 4pm on Wednesday?"
            required
          />
          <button className="fc-btn-primary" disabled={loading} type="submit">{loading ? 'Asking…' : 'Ask'}</button>
        </form>
        {error && <div className="fc-error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {history.length === 0 && !loading && (
        <div className="fc-card fc-empty">
          <p>Try "Which labs are empty on Friday afternoon?" or "How often is Room 204 used this week?"</p>
        </div>
      )}

      <div className="fc-thread">
        {[...history].reverse().map((item, i) => (
          <div className="fc-card fc-thread-item" key={i}>
            <div className="fc-thread-question"><span className="fc-prompt-marker">&gt;</span>{item.question}</div>
            <div className="fc-answer-box">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.answer}
              </ReactMarkdown>
              <GenieBadge mode={item.mode} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FC_STYLES = `
.fc-root {
  --fc-bg: #F5F0E1;
  --fc-surface: #FFDE59;
  --fc-border: #111111;
  --fc-text: #111111;
  --fc-muted: #4A4636;
  --fc-accent: #FF3EA5;
  --fc-free: #4FCB53;
  --fc-occupied: #FF3B3B;
  font-family: 'Inter', -apple-system, sans-serif;
  color: var(--fc-text);
  background: transparent;
  padding: 0;
  border-radius: 16px;
}

.fc-header { margin-bottom: 24px; }
.fc-title { font-family: 'Space Grotesk', sans-serif; font-size: 1.9rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.01em; }
.fc-subtitle { color: var(--fc-muted); font-size: 0.95rem; margin: 0; max-width: 520px; font-weight: 500; }

.fc-tabs {
  display: inline-flex; gap: 6px; padding: 5px;
  background: #FFFFFF; border: 3px solid var(--fc-border); border-radius: 12px;
  margin-bottom: 24px; box-shadow: 4px 4px 0px var(--fc-border);
}
.fc-tab {
  font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 700; color: var(--fc-muted);
  background: transparent; border: 2px solid transparent; padding: 9px 16px; border-radius: 8px; cursor: pointer;
}
.fc-tab:hover { color: var(--fc-text); }
.fc-tab-active { color: var(--fc-text); background: var(--fc-surface); border-color: var(--fc-border); font-weight: 700; }

.fc-card {
  background: var(--fc-surface); border: 3px solid var(--fc-border); border-radius: 14px;
  padding: 20px 22px; margin-bottom: 18px; box-shadow: 6px 6px 0px var(--fc-border);
}
.fc-empty { text-align: center; color: var(--fc-muted); padding: 40px 20px; font-weight: 600; }
.fc-error { color: #fff; font-weight: 700; font-size: 0.9rem; background: var(--fc-occupied); border-color: var(--fc-border); }
.fc-success { color: var(--fc-text); font-weight: 700; font-size: 0.9rem; }
.fc-muted { color: var(--fc-muted); }

.fc-spinner {
  width: 24px; height: 24px; border: 3px solid var(--fc-border); border-top-color: var(--fc-accent);
  border-radius: 50%; margin: 0 auto 12px; animation: fc-spin 0.8s linear infinite;
}
@keyframes fc-spin { to { transform: rotate(360deg); } }

.fc-filters { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.fc-day-tabs { display: flex; gap: 5px; padding: 5px; background: #FFFFFF; border: 3px solid var(--fc-border); border-radius: 10px; }
.fc-day-tab { font-size: 0.8rem; font-weight: 700; color: var(--fc-muted); background: transparent; border: 2px solid transparent; padding: 7px 12px; border-radius: 7px; cursor: pointer; }
.fc-day-tab-active { color: var(--fc-text); background: var(--fc-surface); border-color: var(--fc-border); font-weight: 700; }
.fc-select {
  background: #FFFFFF; border: 2.5px solid var(--fc-border); color: var(--fc-text);
  border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 600;
}

.fc-grid-card { padding: 12px; background: #FFFFFF; }
.fc-grid-scroll { overflow-x: auto; }
.fc-grid-table { border-collapse: collapse; font-size: 0.72rem; }
.fc-grid-room-col { position: sticky; left: 0; background: #FFFFFF; z-index: 1; }
.fc-grid-hour { color: var(--fc-muted); font-weight: 700; padding: 6px 4px; white-space: nowrap; }
.fc-grid-room-cell { position: sticky; left: 0; background: #FFFFFF; padding: 8px 12px; white-space: nowrap; border-right: 2px solid var(--fc-border); }
.fc-room-name { font-weight: 700; margin-right: 8px; }
.fc-room-type-chip { font-size: 0.65rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; border: 2px solid var(--fc-border); margin-right: 6px; text-transform: capitalize; background: #FFFFFF; }
.fc-room-type-lab { color: #6D3EFF; }
.fc-room-type-classroom { color: var(--fc-accent); }
.fc-room-floor { color: var(--fc-muted); font-size: 0.7rem; font-weight: 600; }
.fc-grid-cell { width: 22px; height: 26px; border: 1px solid #E6E0CE; position: relative; }
.fc-grid-cell-free { background: #DFF6D8; }
.fc-grid-cell-occupied { background: var(--fc-occupied); cursor: default; }
.fc-grid-cell-tooltip {
  display: none; position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%);
  background: var(--fc-border); color: #fff; padding: 6px 8px; border-radius: 6px; font-size: 0.68rem; white-space: nowrap; z-index: 5;
}
.fc-grid-cell-occupied:hover .fc-grid-cell-tooltip { display: block; }
.fc-legend { display: flex; gap: 18px; padding: 12px 10px 4px; font-size: 0.78rem; color: var(--fc-muted); font-weight: 600; }
.fc-legend-item { display: flex; align-items: center; gap: 6px; }
.fc-legend-swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; border: 2px solid var(--fc-border); }
.fc-legend-free { background: #DFF6D8; }
.fc-legend-occupied { background: var(--fc-occupied); }

.fc-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 14px; align-items: end; }
.fc-form-grid-3 { grid-template-columns: 1fr 1fr 1fr; align-items: stretch; }
.fc-field { display: flex; flex-direction: column; gap: 6px; }
.fc-field-span2 { grid-column: span 2; }
.fc-label { font-size: 0.8rem; color: var(--fc-text); font-weight: 700; }
.fc-input {
  background: #FFFFFF; border: 2.5px solid var(--fc-border); color: var(--fc-text);
  border-radius: 8px; padding: 10px 12px; font-size: 0.9rem; width: 100%; outline: none;
  transition: box-shadow 0.1s ease, transform 0.1s ease;
}
.fc-input:focus { box-shadow: 3px 3px 0px var(--fc-border); transform: translate(-1px, -1px); }
.fc-btn-primary {
  background: var(--fc-accent); color: #fff; border: 2.5px solid var(--fc-border); border-radius: 8px;
  padding: 10px 18px; font-size: 0.9rem; font-weight: 700; cursor: pointer; white-space: nowrap;
  box-shadow: 3px 3px 0px var(--fc-border); transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.fc-btn-primary:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--fc-border); }
.fc-btn-primary:active:not(:disabled) { transform: translate(1px, 1px); box-shadow: 1px 1px 0px var(--fc-border); }
.fc-btn-primary:disabled { opacity: 0.6; box-shadow: none; transform: none; }
.fc-btn-align { height: 41px; }

.fc-result-card { border-left-width: 6px; }
.fc-result-free { border-left-color: var(--fc-free); }
.fc-result-occupied { border-left-color: var(--fc-occupied); }
.fc-result-headline { display: flex; align-items: center; gap: 10px; font-size: 1rem; margin-bottom: 6px; font-weight: 600; }
.fc-status-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--fc-border); }
.fc-status-free { background: var(--fc-free); }
.fc-status-occupied { background: var(--fc-occupied); }
.fc-section-heading { font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem; font-weight: 700; margin: 18px 0 10px; }

.fc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.fc-table th { text-align: left; color: var(--fc-text); font-weight: 700; font-size: 0.75rem; padding: 8px 10px; border-bottom: 3px solid var(--fc-border); }
.fc-table td { padding: 8px 10px; border-bottom: 2px solid #E6E0CE; }

.fc-prompt-marker { font-family: 'Space Grotesk', monospace; color: var(--fc-accent); font-weight: 700; }
.fc-search-row { display: flex; gap: 10px; align-items: center; }
.fc-ask-input { flex: 1; }
.fc-thread { display: flex; flex-direction: column; gap: 12px; }
.fc-thread-item { padding: 16px 18px; background: #FFFFFF; }
.fc-thread-question { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 10px; }
.fc-answer-box {
  background: var(--fc-bg); border: 2.5px solid var(--fc-border); border-radius: 10px;
  padding: 14px 16px; font-size: 0.9rem; line-height: 1.55; white-space: pre-wrap;
}

@media (max-width: 720px) {
  .fc-form-grid, .fc-form-grid-3 { grid-template-columns: 1fr; }
  .fc-field-span2 { grid-column: span 1; }
}
`