import type { DragEvent, ReactNode } from 'react'
import { card, dropIndicator, dragHandle, buttonGroup } from '../../styles/shared'
import { Button } from './Button'

interface DraggableCardProps {
  children: ReactNode
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDragEnd: () => void
  onDrop: (e: DragEvent) => void
  onEdit: () => void
  onDelete: () => void
}

export function DraggableCard({
  children,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
}: DraggableCardProps) {
  return (
    <div
      onDragOver={(e) => {
        e.stopPropagation()
        onDragOver(e)
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        onDragLeave()
      }}
      onDrop={(e) => {
        e.stopPropagation()
        onDrop(e)
      }}
      style={{ position: 'relative' }}
    >
      <div
        style={{
          ...dropIndicator,
          opacity: isDragOver ? 1 : 0,
          boxShadow: isDragOver ? '0 0 8px rgba(100, 108, 255, 0.6)' : 'none',
        }}
      />
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          ...card,
          cursor: 'grab',
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={dragHandle}>⋮⋮</span>
          {children}
        </div>
        <div style={buttonGroup}>
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

