import { useState } from 'react'

interface PackingFabProps {
  onAddItem: () => void
  onAddTask: () => void
  onAddFeedback?: () => void
}

export function PackingFab({ onAddItem, onAddTask, onAddFeedback }: PackingFabProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 100 }}>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button onClick={() => { onAddItem(); setExpanded(false) }} style={fabOptionStyle}>
            + Item
          </button>
          <button onClick={() => { onAddTask(); setExpanded(false) }} style={fabOptionStyle}>
            + Task
          </button>
          {onAddFeedback && (
            <button onClick={() => { onAddFeedback(); setExpanded(false) }} style={fabOptionStyle}>
              💬 Feedback
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '3.5rem', height: '3.5rem',
          borderRadius: '50%',
          background: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px var(--shadow-overlay)',
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(45deg)' : 'none',
          marginLeft: 'auto',
        }}
      >
        +
      </button>
    </div>
  )
}

const fabOptionStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '1.5rem',
  background: 'var(--color-primary)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.9rem',
  boxShadow: '0 2px 6px var(--shadow-overlay)',
  whiteSpace: 'nowrap',
  marginLeft: 'auto',
}
