import { useState } from 'react'
import { Modal, Button, ErrorAlert } from '../../ui'
import { useApp } from '../../../contexts/app_context'
import { useBudget } from '../../../contexts/budget_context'
import { useDeleteAllocations } from '../../../data/mutations/month/allocations'

interface DeleteAllocationsModalProps {
  isOpen: boolean
  onClose: () => void
  onDeleted?: () => void
}

export function DeleteAllocationsModal({ isOpen, onClose, onDeleted }: DeleteAllocationsModalProps) {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { deleteAllocations } = useDeleteAllocations()
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!selectedBudgetId) return
    setError(null)
    addLoadingHold('allocations-delete', 'Deleting allocations...')
    try {
      await deleteAllocations({
        budgetId: selectedBudgetId,
        year: currentYear,
        month: currentMonthNumber,
      })
      onClose()
      onDeleted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete allocations')
    } finally {
      removeLoadingHold('allocations-delete')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Allocations"
    >
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
      <p style={{ margin: '0 0 1.5rem 0' }}>
        Are you sure you want to delete all allocations for this month? This will remove all allocated amounts and reset the month to unfinalized.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Button actionName="Cancel Delete Allocations" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          actionName="Confirm Delete Allocations"
          variant="danger"
          onClick={handleDelete}
        >
          Delete Allocations
        </Button>
      </div>
    </Modal>
  )
}

