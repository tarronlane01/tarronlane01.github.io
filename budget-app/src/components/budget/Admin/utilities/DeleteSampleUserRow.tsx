/**
 * Delete Sample User Row
 *
 * Compact row for deleting the sample@sample.com user's budget.
 */

import { useState } from 'react'
import type {
  DeleteSampleUserBudgetStatus,
  DeleteSampleUserBudgetResult,
  DeleteSampleProgress,
} from '@hooks/migrations/useDeleteSampleUserBudget'
import { MigrationRow, type MigrationRowStatus } from '../common'
import { Modal, Button } from '../../../ui'

interface DeleteSampleUserRowProps {
  status: DeleteSampleUserBudgetStatus | null
  hasData: boolean
  totalBudgets: number
  totalMonths: number
  isChecking: boolean
  isDeleting: boolean
  deleteResult: DeleteSampleUserBudgetResult | null
  deleteProgress: DeleteSampleProgress | null // Reserved for future progress overlay
  onCheck: () => void
  onDelete: () => void
  disabled: boolean
}

export function DeleteSampleUserRow({
  status,
  hasData,
  totalBudgets,
  totalMonths,
  isChecking,
  isDeleting,
  deleteResult,
  onCheck,
  onDelete,
  disabled,
}: DeleteSampleUserRowProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const staleBudgetIds = status?.staleBudgetIds ?? []
  const hasStaleRefs = staleBudgetIds.length > 0

  const getStatus = (): MigrationRowStatus => {
    if (isDeleting) return 'running'
    if (!hasData) return 'unknown'
    if (deleteResult && deleteResult.errors.length === 0) return 'complete'
    if (totalBudgets === 0 && !hasStaleRefs) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string => {
    if (deleteResult && deleteResult.errors.length === 0) {
      return `Deleted ${deleteResult.budgetsDeleted}`
    }
    if (totalBudgets === 0 && !hasStaleRefs) return 'Clean'
    if (hasStaleRefs) return `${staleBudgetIds.length} stale ref(s)`
    return `${totalBudgets} budget(s)`
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
            {deleteResult.budgetsDeleted > 0 && <li>{deleteResult.budgetsDeleted} budget(s) deleted</li>}
            {deleteResult.monthsDeleted > 0 && <li>{deleteResult.monthsDeleted} month(s) deleted</li>}
            {deleteResult.payeesDeleted > 0 && <li>{deleteResult.payeesDeleted} payee doc(s) deleted</li>}
          </ul>
          {deleteResult.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: 'var(--color-error)' }}>
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
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for sample user budget.</div>
    }

    if (totalBudgets === 0 && !hasStaleRefs) {
      return <div style={{ fontSize: '0.85rem' }}>✅ No budget found for sample@sample.com — user is in "new user" state.</div>
    }

    if (hasStaleRefs) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>🔗 Found stale budget references:</div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {staleBudgetIds.slice(0, 3).map((id) => (
              <li key={id} style={{ opacity: 0.8 }}>{id}</li>
            ))}
            {staleBudgetIds.length > 3 && <li style={{ opacity: 0.6 }}>...and {staleBudgetIds.length - 3} more</li>}
          </ul>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>🧪 Sample user budget found:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>{totalBudgets} budget(s)</li>
          <li>{totalMonths} month(s)</li>
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.7 }}>
          Deleting will reset sample@sample.com to a new user state.
        </div>
      </div>
    )
  }

  const needsAction = totalBudgets > 0 || hasStaleRefs

  return (
    <>
      <MigrationRow
        name="Delete Sample User Budget"
        description="Reset sample@sample.com to new user state"
        status={getStatus()}
        statusText={getStatusText()}
        onCheck={onCheck}
        isChecking={isChecking}
        onRun={needsAction ? handleDeleteClick : undefined}
        isRunning={isDeleting}
        actionText="Delete"
        disabled={disabled}
        itemCount={needsAction ? (totalBudgets || staleBudgetIds.length) : undefined}
        details={renderDetails()}
        isDestructive
      />

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="🧪 Delete Sample User Budget?"
      >
        <div style={{
          background: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <p style={{ margin: 0, color: 'var(--color-warning-light)', fontWeight: 500, fontSize: '0.95rem' }}>
            ⚠️ This will delete all data for sample@sample.com!
          </p>
        </div>

        {totalBudgets > 0 && (
          <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
            This will permanently delete <strong style={{ color: 'var(--color-warning)' }}>{totalBudgets} budget(s)</strong> and{' '}
            <strong style={{ color: 'var(--color-warning)' }}>{totalMonths} month(s)</strong>.
          </p>
        )}

        {hasStaleRefs && (
          <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
            This will remove <strong style={{ color: 'var(--color-warning)' }}>{staleBudgetIds.length} stale reference(s)</strong> from the user document.
          </p>
        )}

        <ul style={{ margin: '0 0 1.5rem', paddingLeft: '1.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
          <li>Budget document deleted</li>
          <li>All month documents deleted</li>
          <li>Payees document deleted</li>
          <li>User will see onboarding flow</li>
        </ul>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            actionName="Cancel Delete Sample User Budget"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            actionName="Confirm Delete Sample User Budget"
            onClick={handleConfirmDelete}
          >
            🗑️ Delete Sample User Data
          </Button>
        </div>
      </Modal>
    </>
  )
}

