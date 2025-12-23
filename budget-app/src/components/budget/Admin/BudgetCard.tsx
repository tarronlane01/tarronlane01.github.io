import type { FormEvent } from 'react'
import type { BudgetSummary } from '../../../contexts/budget_context'

export interface BudgetCardProps {
  budget: BudgetSummary
  isCurrent: boolean
  isAccepting: boolean
  isSwitching: boolean
  isEditing: boolean
  editName: string
  isRenaming: boolean
  onAccept: () => void
  onSwitch: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onEditNameChange: (name: string) => void
  onSaveEdit: (e: FormEvent) => void
}

export function BudgetCard({
  budget,
  isCurrent,
  isAccepting,
  isSwitching,
  isEditing,
  editName,
  isRenaming,
  onAccept,
  onSwitch,
  onStartEdit,
  onCancelEdit,
  onEditNameChange,
  onSaveEdit,
}: BudgetCardProps) {
  const canEdit = isCurrent && budget.isOwner

  return (
    <div style={{
      background: isCurrent
        ? 'color-mix(in srgb, #646cff 15%, transparent)'
        : 'color-mix(in srgb, currentColor 8%, transparent)',
      border: isCurrent
        ? '2px solid color-mix(in srgb, #646cff 50%, transparent)'
        : '1px solid transparent',
      padding: '1rem',
      borderRadius: '8px',
    }}>
      {isEditing ? (
        <form onSubmit={onSaveEdit}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              placeholder="Budget name"
              autoFocus
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={isRenaming || !editName.trim()}
              style={{
                background: '#22c55e',
                color: 'white',
                border: 'none',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                cursor: isRenaming || !editName.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isRenaming || !editName.trim() ? 0.7 : 1,
                fontSize: '0.8rem',
              }}
            >
              {isRenaming ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isRenaming}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                cursor: isRenaming ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: isRenaming ? 0.7 : 0.8,
                fontSize: '0.8rem',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{budget.name}</span>
              {budget.isOwner && (
                <span style={{
                  background: 'color-mix(in srgb, #646cff 20%, transparent)',
                  color: '#a5b4fc',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  Owner
                </span>
              )}
              {isCurrent && (
                <span style={{
                  background: 'color-mix(in srgb, #22c55e 20%, transparent)',
                  color: '#4ade80',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  Active
                </span>
              )}
              {budget.isPending && (
                <span style={{
                  background: 'color-mix(in srgb, #f59e0b 20%, transparent)',
                  color: '#fbbf24',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  Pending
                </span>
              )}
              {canEdit && (
                <button
                  onClick={onStartEdit}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '0.15rem',
                    cursor: 'pointer',
                    opacity: 0.5,
                    fontSize: '0.8rem',
                    lineHeight: 1,
                  }}
                  title="Rename budget"
                >
                  ✏️
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>
              {budget.ownerEmail ? `Owner: ${budget.ownerEmail}` : `ID: ${budget.id}`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {budget.isPending ? (
              <button
                onClick={onAccept}
                disabled={isAccepting}
                style={{
                  background: '#22c55e',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: isAccepting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isAccepting ? 0.7 : 1,
                  fontSize: '0.85rem',
                }}
              >
                {isAccepting ? 'Accepting...' : 'Accept'}
              </button>
            ) : !isCurrent ? (
              <button
                onClick={onSwitch}
                disabled={isSwitching}
                style={{
                  background: '#646cff',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: isSwitching ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: isSwitching ? 0.7 : 1,
                  fontSize: '0.85rem',
                }}
              >
                {isSwitching ? 'Switching...' : 'Switch'}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

