/**
 * Action buttons for the categories section sticky header.
 * Includes save/apply buttons, and edit/delete buttons.
 */

import { Button } from '../../../ui'
import { colors } from '@styles/shared'

interface BalancesActionButtonsProps {
  isDraftMode: boolean
  isEditingAppliedAllocations: boolean
  allocationsFinalized: boolean
  onSave: () => void
  onApply: () => void
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}

export function BalancesActionButtons({
  isDraftMode,
  isEditingAppliedAllocations,
  allocationsFinalized,
  onSave,
  onApply,
  onEdit,
  onCancel,
  onDelete,
}: BalancesActionButtonsProps) {
  const headerButtonStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    padding: '0.4em 0.8em',
    height: 32,
    minHeight: 32,
    boxSizing: 'border-box',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
      {/* Draft mode buttons (not editing applied) */}
      {isDraftMode && !isEditingAppliedAllocations && (
        <>
          <Button
            actionName="Save Draft Allocations"
            onClick={onSave}
            variant="secondary"
            style={headerButtonStyle}
          >
            💾 Save
          </Button>
          <Button
            actionName="Apply Allocations"
            onClick={onApply}
            variant="secondary"
            style={headerButtonStyle}
          >
            ✓ Apply
          </Button>
        </>
      )}

      {/* Finalized mode - Edit button */}
      {!isDraftMode && allocationsFinalized && (
        <Button
          actionName="Edit Allocations"
          onClick={onEdit}
          variant="secondary"
          style={headerButtonStyle}
        >
          ✏️ Edit Allocations
        </Button>
      )}

      {/* Editing applied allocations buttons */}
      {isEditingAppliedAllocations && (
        <>
          <Button
            actionName="Apply Allocations"
            onClick={onApply}
            variant="secondary"
            style={headerButtonStyle}
          >
            ✓ Apply
          </Button>
          <Button
            actionName="Cancel Edit Allocations"
            onClick={onCancel}
            variant="secondary"
            style={headerButtonStyle}
          >
            ✕
          </Button>
          <Button
            actionName="Open Delete Allocations Modal"
            onClick={onDelete}
            variant="secondary"
            style={{ ...headerButtonStyle, color: colors.error }}
          >
            🗑️
          </Button>
        </>
      )}
    </div>
  )
}

