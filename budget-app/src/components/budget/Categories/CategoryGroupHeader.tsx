/**
 * CategoryGroupHeader - Header for category group cards
 */

import type { DragEvent } from 'react'
import type { CategoryGroup } from '../../../contexts/budget_context'
import { Button } from '../../ui'
import { sectionHeader, reorderButton, reorderButtonGroup } from '../../../styles/shared'
import { logUserAction } from '@utils'

interface CategoryGroupHeaderProps {
  group: CategoryGroup
  categoryCount: number
  canMoveUp: boolean
  canMoveDown: boolean
  isMobile: boolean
  createForGroupId: string | null
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddCategory: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}

export function CategoryGroupHeader({
  group,
  categoryCount,
  canMoveUp,
  canMoveDown,
  isMobile,
  createForGroupId,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddCategory,
  onDragStart,
  onDragEnd,
}: CategoryGroupHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '0.5rem' : '0.75rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      gap: '0.5rem',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
        {!isMobile && (
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            style={{
              cursor: 'grab',
              opacity: 0.4,
              padding: '0.25rem',
              margin: '-0.25rem',
              borderRadius: '4px',
              userSelect: 'none',
            }}
            title="Drag to reorder group"
          >
            ⋮⋮
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {group.name}
        </span>
        <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem', flexShrink: 0 }}>
          ({categoryCount})
        </span>
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
        {!isMobile && (
          <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={onAddCategory} disabled={createForGroupId !== null}>
            + Category
          </Button>
        )}
        <button
          onClick={() => { logUserAction('CLICK', 'Edit Category Group', { details: group.name }); onEdit() }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Edit group"
        >
          ✏️
        </button>
        <button
          onClick={() => { logUserAction('CLICK', 'Delete Category Group', { details: group.name }); onDelete() }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Delete group"
        >
          🗑️
        </button>
        <div style={reorderButtonGroup}>
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            style={{
              ...reorderButton,
              opacity: canMoveUp ? 0.6 : 0.2,
              cursor: canMoveUp ? 'pointer' : 'default',
            }}
            title="Move group up"
            aria-label="Move group up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            style={{
              ...reorderButton,
              opacity: canMoveDown ? 0.6 : 0.2,
              cursor: canMoveDown ? 'pointer' : 'default',
            }}
            title="Move group down"
            aria-label="Move group down"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  )
}

