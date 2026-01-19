import type { DragEvent, ReactNode } from 'react'
import {
  card,
  cardMobile,
  dropIndicator,
  dragHandle,
  buttonGroup,
  buttonGroupMobile,
  iconButton,
  iconButtonDanger,
  reorderButton,
  reorderButtonGroup,
} from '@styles/shared'
import { Button } from './Button'
import { useIsMobile } from '@hooks'
import { logUserAction } from '@utils/actionLogger'

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
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  itemName?: string  // For logging context
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
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  itemName,
}: DraggableCardProps) {
  const isMobile = useIsMobile()
  const showReorderButtons = onMoveUp || onMoveDown

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
        style={{
          ...(isMobile ? cardMobile : card),
          opacity: isDragging ? 0.5 : 1,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', minWidth: 0 }}>
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              logUserAction('DRAG_START', itemName || 'Item')
              onDragStart(e)
            }}
            onDragEnd={(e) => {
              e.stopPropagation()
              logUserAction('DRAG_END', itemName || 'Item')
              onDragEnd()
            }}
            style={{
              ...dragHandle,
              fontSize: isMobile ? '0.9rem' : undefined,
              cursor: 'grab',
              padding: '0.25rem',
              margin: '-0.25rem',
              borderRadius: '4px',
              userSelect: 'none',
            }}
            title="Drag to reorder"
          >
            ⋮⋮
          </span>
          <div
            draggable={false}
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'text',
            }}
            onDragStart={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {children}
          </div>
        </div>
        <div style={isMobile ? buttonGroupMobile : buttonGroup}>
          {isMobile ? (
            // Mobile: Icon buttons
            <>
              <button
                onClick={() => { logUserAction('CLICK', `Edit ${itemName || 'Item'}`); onEdit() }}
                style={iconButton}
                title="Edit"
                aria-label="Edit"
              >
                ✏️
              </button>
              <button
                onClick={() => { logUserAction('CLICK', `Delete ${itemName || 'Item'}`); onDelete() }}
                style={iconButtonDanger}
                title="Delete"
                aria-label="Delete"
              >
                🗑️
              </button>
            </>
          ) : (
            // Desktop: Full text buttons
            <>
              <Button variant="secondary" actionName={`Edit ${itemName || 'Item'}`} onClick={onEdit}>
                Edit
              </Button>
              <Button variant="danger" actionName={`Delete ${itemName || 'Item'}`} onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
          {/* Reorder buttons - on right side after edit/delete */}
          {showReorderButtons && (
            <div style={reorderButtonGroup}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  logUserAction('CLICK', `Move Up ${itemName || 'Item'}`)
                  onMoveUp?.()
                }}
                disabled={!canMoveUp}
                style={{
                  ...reorderButton,
                  opacity: canMoveUp ? 0.6 : 0.2,
                  cursor: canMoveUp ? 'pointer' : 'default',
                }}
                title="Move up"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  logUserAction('CLICK', `Move Down ${itemName || 'Item'}`)
                  onMoveDown?.()
                }}
                disabled={!canMoveDown}
                style={{
                  ...reorderButton,
                  opacity: canMoveDown ? 0.6 : 0.2,
                  cursor: canMoveDown ? 'pointer' : 'default',
                }}
                title="Move down"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
