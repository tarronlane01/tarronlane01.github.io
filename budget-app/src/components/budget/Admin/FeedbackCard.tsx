import type { DragEvent } from 'react'
import type { FlattenedFeedbackItem } from '@data'
import { formatDate } from '@utils'
import { card, dragHandle, dropIndicator, colors } from '@styles/shared'
import { feedbackTypeConfig, type FeedbackType } from './feedbackTypes'

export function FeedbackTypeBadge({ type, onClick }: { type?: FeedbackType | string; onClick?: () => void }) {
  // Handle legacy 'feature' type by mapping to 'new_feature'
  const normalizedType = type === 'feature' ? 'new_feature' : type
  const feedbackType = (normalizedType && normalizedType in feedbackTypeConfig ? normalizedType : 'bug') as FeedbackType
  const config = feedbackTypeConfig[feedbackType]
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        background: config.bgColor,
        color: config.color,
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.025em',
        flexShrink: 0,
        border: 'none',
        cursor: 'pointer',
        transition: 'opacity 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
      title="Click to change type"
    >
      {config.label}
    </button>
  )
}

export interface FeedbackCardProps {
  item: FlattenedFeedbackItem
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDragEnd: () => void
  onDrop: (e: DragEvent) => void
  onToggleDone: () => void
  onTypeClick: () => void
}

export function FeedbackCard({
  item,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onToggleDone,
  onTypeClick,
}: FeedbackCardProps) {
  return (
    <div
      onDragOver={(e) => { e.stopPropagation(); onDragOver(e) }}
      onDragLeave={(e) => { e.stopPropagation(); onDragLeave() }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e) }}
      style={{ position: 'relative' }}
    >
      <div style={{ ...dropIndicator, opacity: isDragOver ? 1 : 0, boxShadow: isDragOver ? '0 0 8px var(--shadow-primary)' : 'none' }} />
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ ...card, cursor: 'grab', opacity: isDragging ? 0.5 : 1, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ ...dragHandle }}>⋮⋮</span>
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={onToggleDone}
            style={{
              width: '1.25rem',
              height: '1.25rem',
              cursor: 'pointer',
              accentColor: colors.primary,
              flexShrink: 0,
            }}
          />
          <FeedbackTypeBadge type={item.feedback_type} onClick={onTypeClick} />
        </div>
        <div style={{ marginLeft: '3.25rem' }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{item.text}</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
            {item.user_email} • {formatDate(item.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

// Completed feedback item display (simpler, no drag)
export function CompletedFeedbackItem({
  item,
  onToggleDone,
  onTypeClick,
}: {
  item: FlattenedFeedbackItem
  onToggleDone: () => void
  onTypeClick: () => void
}) {
  return (
    <div style={{ ...card, opacity: 0.6, flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="checkbox"
          checked={item.is_done}
          onChange={onToggleDone}
          style={{
            width: '1.25rem',
            height: '1.25rem',
            cursor: 'pointer',
            accentColor: colors.primary,
            flexShrink: 0,
          }}
        />
        <FeedbackTypeBadge type={item.feedback_type} onClick={onTypeClick} />
      </div>
      <div style={{ marginLeft: '2rem' }}>
        <p style={{ margin: 0, lineHeight: 1.5, textDecoration: 'line-through' }}>{item.text}</p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          {item.user_email} • Created: {formatDate(item.created_at)}
        </p>
        {item.completed_at && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: colors.success }}>
            ✓ Completed: {formatDate(item.completed_at)}
          </p>
        )}
      </div>
    </div>
  )
}

