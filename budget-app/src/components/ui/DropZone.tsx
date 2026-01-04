import type { DragEvent } from 'react'
import { dropZoneEnd, dropZoneLine, dropZoneLabel } from '@styles/shared'

interface DropZoneProps {
  isActive: boolean
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent) => void
  label?: string
}

export function DropZone({
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
  label = 'Move to end',
}: DropZoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={dropZoneEnd}
    >
      <div
        style={{
          ...dropZoneLine,
          opacity: isActive ? 1 : 0.3,
          boxShadow: isActive ? '0 0 8px rgba(100, 108, 255, 0.6)' : 'none',
        }}
      />
      {isActive && <span style={dropZoneLabel}>{label}</span>}
    </div>
  )
}

