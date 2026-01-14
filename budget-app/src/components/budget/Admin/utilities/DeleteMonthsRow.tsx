/**
 * Delete Months Row
 *
 * Compact row for deleting all month documents.
 */

import { useState } from 'react'
import type {
  DeleteAllMonthsStatus,
  DeleteAllMonthsResult,
  DeleteProgress,
} from '@hooks/migrations/useDeleteAllMonths'
import { MigrationRow, type MigrationRowStatus } from '../common'
import { Modal, Button } from '../../../ui'

interface DeleteMonthsRowProps {
  status: DeleteAllMonthsStatus | null
  hasData: boolean
  monthsCount: number
  budgetCount: number
  isChecking: boolean
  isDeleting: boolean
  deleteResult: DeleteAllMonthsResult | null
  deleteProgress: DeleteProgress | null // Reserved for future progress overlay
  onCheck: () => void
  onDelete: () => void
  disabled: boolean
}

export function DeleteMonthsRow({
  hasData,
  monthsCount,
  budgetCount,
  isChecking,
  isDeleting,
  deleteResult,
  onCheck,
  onDelete,
  disabled,
}: DeleteMonthsRowProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const getStatus = (): MigrationRowStatus => {
    if (isDeleting) return 'running'
    if (!hasData) return 'unknown'
    if (deleteResult && deleteResult.errors.length === 0) return 'complete'
    if (monthsCount === 0) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string => {
    if (deleteResult && deleteResult.errors.length === 0) {
      return `Deleted ${deleteResult.deleted}`
    }
    if (monthsCount === 0) return 'No months'
    return `${monthsCount} months`
  }

  const handleDeleteClick = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmDelete = () => {
    setShowConfirmModal(false)
    onDelete()
  }

  const renderDetails = () => {
    if (deleteResult) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {deleteResult.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Deletion complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li>{deleteResult.deleted} month(s) deleted</li>
            {deleteResult.budgetsRecalculated > 0 && (
              <li>{deleteResult.budgetsRecalculated} budget(s) reset</li>
            )}
          </ul>
          {deleteResult.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: '#ef4444' }}>
              <div>Errors ({deleteResult.errors.length}):</div>
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
                {deleteResult.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                {deleteResult.errors.length > 3 && <li>...and {deleteResult.errors.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (!hasData) {
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for months.</div>
    }

    if (monthsCount === 0) {
      return <div style={{ fontSize: '0.85rem' }}>✅ No month documents found in Firebase.</div>
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: '#ef4444' }}>⚠️ DESTRUCTIVE ACTION</div>
        <div>Found {monthsCount} month(s) across {budgetCount} budget(s).</div>
        <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
          This will permanently delete ALL month documents and reset all budgets.
        </div>
      </div>
    )
  }

  return (
    <>
      <MigrationRow
        name="Delete ALL Months"
        description="DESTRUCTIVE: Deletes all month documents from all budgets"
        status={getStatus()}
        statusText={getStatusText()}
        onCheck={onCheck}
        isChecking={isChecking}
        onRun={monthsCount > 0 ? handleDeleteClick : undefined}
        isRunning={isDeleting}
        actionText="Delete"
        disabled={disabled}
        itemCount={monthsCount > 0 ? monthsCount : undefined}
        details={renderDetails()}
        isDestructive
      />

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="🚨 Delete All Months?"
      >
        <div style={{
          background: 'color-mix(in srgb, #ef4444 15%, transparent)',
          border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <p style={{ margin: 0, color: '#fca5a5', fontWeight: 500, fontSize: '0.95rem' }}>
            ⚠️ This is a destructive operation that cannot be undone!
          </p>
        </div>

        <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
          This will permanently delete <strong style={{ color: '#ef4444' }}>{monthsCount} month(s)</strong> across{' '}
          <strong style={{ color: '#ef4444' }}>{budgetCount} budget(s)</strong>.
        </p>

        <ul style={{ margin: '0 0 1.5rem', paddingLeft: '1.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
          <li>All account balances → $0</li>
          <li>All category balances → $0</li>
          <li>Month history cleared</li>
        </ul>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            actionName="Cancel Delete All Months"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            actionName="Confirm Delete All Months"
            onClick={handleConfirmDelete}
          >
            🗑️ Delete All {monthsCount} Months
          </Button>
        </div>
      </Modal>
    </>
  )
}

