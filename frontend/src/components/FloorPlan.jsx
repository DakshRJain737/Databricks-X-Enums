import { useState, useEffect, useMemo } from 'react'
import api from '../api/client'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 20 }, (_, i) => {
  const totalMinutes = 8 * 60 + i * 30
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

/**
 * Schematic (not-to-scale) floor plan. Rooms aren't given real x/y coordinates
 * anywhere in the data model, so we lay them out as a simple grid of room
 * boxes, sorted by room number. It's visual and clickable, not a literal
 * blueprint.
 *
 * A room is uniquely identified by (room_number, room_type, floor_number) --
 * so a classroom "204" and a lab "204" on the same floor are two distinct
 * boxes, not one. Classrooms and labs are colored differently so you can
 * tell them apart at a glance.
 */
export default function FloorPlan({ slots, loading, onBooked }) {
  const [floor, setFloor] = useState(null)
  const [day, setDay] = useState('Monday')
  const [hourIdx, setHourIdx] = useState(4) // default ~10:00
  const [selectedRoom, setSelectedRoom] = useState(null)

  const time = HOURS[hourIdx]

  const floors = useMemo(
    () => [...new Set(slots.map((s) => s.floor_number))].sort((a, b) => a - b),
    [slots]
  )

  useEffect(() => {
    if (floor === null && floors.length) setFloor(floors[0])
  }, [floors, floor])

  // Key by room_number + room_type so a classroom and a lab that happen to
  // share a room number on the same floor are kept as two separate boxes.
  const roomKey = (room_number, room_type) => `${room_number}__${room_type}`

  const rooms = useMemo(() => {
    const map = new Map()
    slots.forEach((s) => {
      if (s.floor_number !== floor) return
      const key = roomKey(s.room_number, s.room_type)
      if (!map.has(key)) {
        map.set(key, { room_number: s.room_number, room_type: s.room_type, floor_number: s.floor_number })
      }
    })
    return [...map.values()].sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true }) || a.room_type.localeCompare(b.room_type)
    )
  }, [slots, floor])

  const occupyingSlot = (room) =>
    slots.find(
      (s) =>
        s.room_number === room.room_number &&
        s.room_type === room.room_type &&
        s.floor_number === room.floor_number &&
        s.day_of_week === day &&
        s.start_time <= time &&
        time < s.end_time
    )

  const selectRoom = (room) => {
    const occ = occupyingSlot(room)
    setSelectedRoom({ ...room, occupied: !!occ, occupyingSlot: occ || null })
  }

  if (loading) {
    return <div className="fc-card fc-empty"><div className="fc-spinner" /><p>Loading floor plan…</p></div>
  }
  if (floors.length === 0) {
    return <div className="fc-card fc-empty"><p>No rooms tracked yet. Book a slot to get started.</p></div>
  }

  return (
    <div>
      <style>{FP_STYLES}</style>

      <div className="fc-filters">
        <div className="fc-day-tabs">
          {floors.map((f) => (
            <button
              key={f}
              className={`fc-day-tab${floor === f ? ' fc-day-tab-active' : ''}`}
              onClick={() => { setFloor(f); setSelectedRoom(null) }}
            >
              Floor {f}
            </button>
          ))}
        </div>
        <div className="fc-day-tabs">
          {DAYS.map((d) => (
            <button
              key={d}
              className={`fc-day-tab${day === d ? ' fc-day-tab-active' : ''}`}
              onClick={() => { setDay(d); setSelectedRoom(null) }}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="fc-card fp-time-card">
        <div className="fp-time-row">
          <span className="fc-label">Viewing occupancy at</span>
          <strong className="fp-time-value">{time}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={HOURS.length - 1}
          value={hourIdx}
          onChange={(e) => setHourIdx(Number(e.target.value))}
          className="fp-slider"
        />
      </div>

      <div className="fc-card fp-plan-card">
        <div className="fp-grid">
          {rooms.map((r) => (
            <RoomBlock
              key={roomKey(r.room_number, r.room_type)}
              room={r}
              occupied={!!occupyingSlot(r)}
              selected={selectedRoom?.room_number === r.room_number && selectedRoom?.room_type === r.room_type}
              onClick={() => selectRoom(r)}
            />
          ))}
        </div>

        <div className="fc-legend" style={{ paddingTop: 16, flexWrap: 'wrap' }}>
          <span className="fc-legend-item"><span className="fc-legend-swatch fp-legend-classroom" /> Classroom</span>
          <span className="fc-legend-item"><span className="fc-legend-swatch fp-legend-lab" /> Lab</span>
          <span className="fc-legend-item"><span className="fc-legend-swatch fc-legend-occupied" /> Occupied (either type)</span>
          <span className="fc-muted" style={{ fontSize: '0.78rem' }}>Layout is schematic, not to scale — click a room to see details or book it.</span>
        </div>
      </div>

      {selectedRoom && (
        <RoomDetailPanel
          key={roomKey(selectedRoom.room_number, selectedRoom.room_type)}
          room={selectedRoom}
          day={day}
          slots={slots}
          onClose={() => setSelectedRoom(null)}
          onBooked={() => { onBooked?.(); setSelectedRoom(null) }}
        />
      )}
    </div>
  )
}

function RoomBlock({ room, occupied, selected, onClick }) {
  return (
    <button
      className={`fp-room fp-room-type-${room.room_type} fp-room-${occupied ? 'occupied' : 'free'}${selected ? ' fp-room-selected' : ''}`}
      onClick={onClick}
      title={`${room.room_number} (${room.room_type}) — ${occupied ? 'Occupied' : 'Free'} right now`}
    >
      <span className="fp-room-number">{room.room_number}</span>
      <span className={`fc-room-type-chip fc-room-type-${room.room_type}`}>{room.room_type}</span>
    </button>
  )
}

function RoomDetailPanel({ room, day, slots, onClose, onBooked }) {
  const daySlots = slots
    .filter((s) => s.room_number === room.room_number && s.room_type === room.room_type && s.floor_number === room.floor_number && s.day_of_week === day)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const [showBook, setShowBook] = useState(false)
  const [form, setForm] = useState({ start_time: '', end_time: '', purpose: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/facility', {
        room_number: room.room_number,
        room_type: room.room_type,
        floor_number: room.floor_number,
        day_of_week: day,
        start_time: form.start_time,
        end_time: form.end_time,
        purpose: form.purpose,
      })
      onBooked?.()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to book slot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`fc-card fp-detail-card ${room.occupied ? 'fc-result-occupied' : 'fc-result-free'} fc-result-card`}>
      <div className="fp-detail-header">
        <div className="fc-result-headline">
          <span className={`fc-status-dot ${room.occupied ? 'fc-status-occupied' : 'fc-status-free'}`} />
          <strong>{room.room_number}</strong> · {room.room_type} · Floor {room.floor_number} ·{' '}
          {room.occupied ? 'OCCUPIED' : 'FREE'} right now on {day}
        </div>
        <button className="fp-close-btn" onClick={onClose} aria-label="Close">×</button>
      </div>

      {daySlots.length > 0 ? (
        <table className="fc-table">
          <thead><tr><th>Time</th><th>Purpose</th></tr></thead>
          <tbody>
            {daySlots.map((s) => (
              <tr key={s.id}><td>{s.start_time}–{s.end_time}</td><td className="fc-muted">{s.purpose || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="fc-muted">No bookings for {room.room_number} ({room.room_type}) on {day} yet.</p>
      )}

      {!showBook ? (
        <button className="fc-btn-primary" style={{ marginTop: 14 }} onClick={() => setShowBook(true)}>
          Book this room
        </button>
      ) : (
        <form onSubmit={submit} className="fp-inline-form">
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
            <input className="fc-input" value={form.purpose} onChange={set('purpose')} placeholder="e.g. DBMS lecture" />
          </div>
          <button className="fc-btn-primary" type="submit" disabled={saving}>
            {saving ? 'Booking…' : `Confirm booking for ${room.room_number}`}
          </button>
        </form>
      )}
      {error && <div className="fc-error" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  )
}

const FP_STYLES = `
.fp-time-card { display: flex; flex-direction: column; gap: 8px; background: #FFFFFF; }
.fp-time-row { display: flex; align-items: center; justify-content: space-between; }
.fp-time-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; }
.fp-slider { width: 100%; accent-color: var(--fc-accent); cursor: pointer; }

.fp-plan-card { background: #FFFFFF; padding: 24px; }
.fp-grid { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }

.fp-room {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  width: 96px; height: 76px; border: 3px solid var(--fc-border); border-radius: 8px;
  cursor: pointer; font-family: inherit; box-shadow: 3px 3px 0px var(--fc-border);
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.fp-room:hover { transform: translate(-2px, -2px); box-shadow: 5px 5px 0px var(--fc-border); }
.fp-room:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0px var(--fc-border); }

/* Free rooms: classroom vs lab get distinct base colors */
.fp-room-type-classroom.fp-room-free { background: #4FA8FF; color: #111111; }
.fp-room-type-lab.fp-room-free { background: #39FF14; color: #111111; }

.fp-room-type-classroom.fp-room-free .fc-room-type-chip,
.fp-room-type-lab.fp-room-free .fc-room-type-chip { background: #fff; color: #111111; }

/* Occupied rooms: same red regardless of type, so occupancy still reads clearly at a glance */
.fp-room-occupied { background: var(--fc-occupied); }
.fp-room-occupied .fc-room-type-chip { background: #fff; }

.fp-room-selected { outline: 3px solid var(--fc-accent); outline-offset: 2px; }
.fp-room-number { font-weight: 700; font-size: 0.85rem; }

.fp-legend-classroom { background: #4FA8FF; }
.fp-legend-lab { background: #39FF14; }

.fp-detail-card { background: #FFFFFF; }
.fp-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.fp-close-btn {
  background: transparent; border: 2px solid var(--fc-border); border-radius: 6px; width: 28px; height: 28px;
  font-size: 1.1rem; line-height: 1; cursor: pointer; flex-shrink: 0;
}
.fp-inline-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; align-items: end; }
.fp-inline-form .fc-field-span2 { grid-column: span 2; }
.fp-inline-form button { grid-column: span 2; }

@media (max-width: 720px) {
  .fp-room { width: 84px; height: 70px; }
  .fp-inline-form { grid-template-columns: 1fr; }
  .fp-inline-form .fc-field-span2, .fp-inline-form button { grid-column: span 1; }
}
`