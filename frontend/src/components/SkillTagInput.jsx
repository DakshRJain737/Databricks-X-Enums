import { useState } from 'react'

export default function SkillTagInput({ value = [], onChange }) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const tag = draft.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setDraft('')
  }

  const removeTag = (tag) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="skill-tag-input">
      <div className="skill-tag-list">
        {value.map((tag) => (
          <span className="skill-bubble" key={tag}>
            {tag}
            <button
              type="button"
              className="skill-bubble-remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? 'Type a skill and press Enter (Java, React...)' : ''}
        />
      </div>
    </div>
  )
}