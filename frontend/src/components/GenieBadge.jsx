export default function GenieBadge({ mode }) {
  if (!mode) return null
  const map = {
    live: { cls: 'ok', label: 'Live Genie' },
    mock: { cls: 'mock', label: 'Mock (no Genie space configured)' },
    error: { cls: 'bad', label: 'Genie error — see message' },
  }
  const info = map[mode] || { cls: 'mock', label: mode }
  return <span className={`pill ${info.cls}`}>{info.label}</span>
}
