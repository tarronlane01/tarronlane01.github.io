import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  count?: number
  children: ReactNode
  defaultExpanded?: boolean
}

export function CollapsibleSection({ title, count, children, defaultExpanded = false }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div style={{ marginTop: '2rem' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0',
          fontSize: '0.9rem',
          opacity: 0.7,
        }}
      >
        <span style={{
          transition: 'transform 0.2s',
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          ▶
        </span>
        {title}{count !== undefined && ` (${count})`}
      </button>

      {isExpanded && children}
    </div>
  )
}

