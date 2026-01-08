/**
 * DeleteMonthModal - Confirmation modal for deleting a month
 */

import { MONTH_NAMES } from '@constants'
import { Modal, Button } from '@components/ui'

interface DeleteMonthModalProps {
  isOpen: boolean
  onClose: () => void
  year: number
  month: number
  isDeleting: boolean
  onConfirm: () => void
}

export function DeleteMonthModal({
  isOpen,
  onClose,
  year,
  month,
  isDeleting,
  onConfirm,
}: DeleteMonthModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🗑️ Delete Month?"
    >
      <div style={{
        background: 'color-mix(in srgb, #ef4444 15%, transparent)',
        border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <p style={{ margin: 0, color: '#fca5a5', fontWeight: 500, fontSize: '0.95rem' }}>
          ⚠️ This will permanently delete {MONTH_NAMES[month - 1]} {year}!
        </p>
      </div>

      <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
        This month document and all its data (income, expenses, allocations) will be permanently deleted.
      </p>

      <p style={{ margin: '0 0 1rem', opacity: 0.8, fontSize: '0.9rem' }}>
        After deletion, you will be navigated to the previous month.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          actionName="Cancel Delete Month"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          actionName="Confirm Delete Month"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : '🗑️ Delete Month'}
        </Button>
      </div>
    </Modal>
  )
}

