import type { DragEvent } from 'react'
import { colors } from '../../../styles/shared'

interface CategoryEndDropZoneProps {
  groupId: string
  isActive: boolean
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

export function CategoryEndDropZone({ isActive, onDragOver, onDragLeave, onDrop }: CategoryEndDropZoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        height: '2rem',
        marginTop: '-0.25rem',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '3px',
          background: colors.primary,
          borderRadius: '2px',
          opacity: isActive ? 1 : 0.3,
          transition: 'opacity 0.15s',
          boxShadow: isActive ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
        }}
      />
      {isActive && (
        <span style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '0.75rem',
          opacity: 0.7,
          background: 'var(--background, #1a1a1a)',
          padding: '0 0.5rem',
          whiteSpace: 'nowrap',
        }}>
          Move to end
        </span>
      )}
    </div>
  )
}

