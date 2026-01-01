/**
 * Action buttons for the balances section sticky header.
 * Includes view toggle, save/apply buttons, and edit/delete buttons.
 */

import type { BalancesView } from '../../../../contexts/budget_context'
import { Button } from '../../../ui'
import { colors } from '../../../../styles/shared'

interface BalancesActionButtonsProps {
  currentView: BalancesView
  onViewChange: (view: BalancesView) => void
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
  currentView,
  onViewChange,
  isDraftMode,
  isEditingAppliedAllocations,
  allocationsFinalized,
  onSave,
  onApply,
  onEdit,
  onCancel,
  onDelete,
}: BalancesActionButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
      {/* View toggle button */}
      <Button
        actionName={currentView === 'categories' ? 'Switch to Account Balances' : 'Switch to Category Balances'}
        onClick={() => onViewChange(currentView === 'categories' ? 'accounts' : 'categories')}
        variant="secondary"
        style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
      >
        {currentView === 'categories' ? '🏦 Accounts' : '📊 Categories'}
      </Button>

      {/* Draft mode buttons (not editing applied) */}
      {currentView === 'categories' && isDraftMode && !isEditingAppliedAllocations && (
        <>
          <Button
            actionName="Save Draft Allocations"
            onClick={onSave}
            variant="secondary"
            style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
          >
            💾 Save
          </Button>
          <Button
            actionName="Apply Allocations"
            onClick={onApply}
            variant="secondary"
            style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
          >
            ✓ Apply
          </Button>
        </>
      )}

      {/* Finalized mode - Edit button */}
      {currentView === 'categories' && !isDraftMode && allocationsFinalized && (
        <Button
          actionName="Edit Allocations"
          onClick={onEdit}
          variant="secondary"
          style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
        >
          ✏️ Edit
        </Button>
      )}

      {/* Editing applied allocations buttons */}
      {currentView === 'categories' && isEditingAppliedAllocations && (
        <>
          <Button
            actionName="Apply Allocations"
            onClick={onApply}
            variant="secondary"
            style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
          >
            ✓ Apply
          </Button>
          <Button
            actionName="Cancel Edit Allocations"
            onClick={onCancel}
            variant="secondary"
            style={{ fontSize: '0.8rem', padding: '0.4em 0.8em' }}
          >
            ✕
          </Button>
          <Button
            actionName="Open Delete Allocations Modal"
            onClick={onDelete}
            variant="secondary"
            style={{ fontSize: '0.8rem', padding: '0.4em 0.8em', color: colors.error }}
          >
            🗑️
          </Button>
        </>
      )}
    </div>
  )
}

