import { useState } from 'react'
import type { DeleteSampleUserBudgetStatus, DeleteSampleUserBudgetResult, DeleteSampleProgress, SampleBudgetInfo } from '@hooks/migrations/useDeleteSampleUserBudget'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'
import { LoadingOverlay, ProgressBar, StatItem, StatGrid, PercentLabel } from '../../app/LoadingOverlay'
import { Modal, Button } from '../../ui'

interface DeleteSampleUserBudgetCardProps {
  hasData: boolean
  status: DeleteSampleUserBudgetStatus | null
  isDeleting: boolean
  onDelete: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
  deleteResult: DeleteSampleUserBudgetResult | null
  deleteProgress: DeleteSampleProgress | null
}

export function DeleteSampleUserBudgetCard({
  hasData,
  status,
  isDeleting,
  onDelete,
  onRefresh,
  isRefreshing,
  disabled,
  deleteResult,
  deleteProgress,
}: DeleteSampleUserBudgetCardProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const handleDeleteClick = () => {
    setShowConfirmModal(true)
  }

  const handleConfirmDelete = () => {
    setShowConfirmModal(false)
    onDelete()
  }

  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (deleteResult && (deleteResult.budgetsDeleted > 0 || status?.staleBudgetIds.length === 0) && deleteResult.errors.length === 0) return 'complete'
    // Show needs-action if there are budgets OR stale budget IDs to clean up
    if (!status || (status.totalBudgets === 0 && status.staleBudgetIds.length === 0)) return 'clean'
    return 'needs-action'
  }

  const totalBudgets = status?.totalBudgets ?? 0
  const totalMonths = status?.totalMonths ?? 0
  const budgets = status?.budgets ?? []
  const staleBudgetIds = status?.staleBudgetIds ?? []

  return (
    <MigrationCard
      title="🧪 Delete Sample User Budget"
      description="Deletes the budget for sample@sample.com user (budget document, all months, and payees). This resets the sample user to a brand new state for testing the new user flow."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isDeleting}
    >
      {isDeleting ? (
        <StatusBox type="running">
          Deleting sample user budget...
        </StatusBox>
      ) : deleteResult ? (
        <StatusBox type={deleteResult.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {deleteResult.errors.length > 0 ? '⚠️' : '✅'} Deleted {deleteResult.budgetsDeleted} budget{deleteResult.budgetsDeleted !== 1 ? 's' : ''}
            {deleteResult.monthsDeleted > 0 && (
              <span>, {deleteResult.monthsDeleted} month{deleteResult.monthsDeleted !== 1 ? 's' : ''}</span>
            )}
            {deleteResult.payeesDeleted > 0 && (
              <span>, {deleteResult.payeesDeleted} payee doc{deleteResult.payeesDeleted !== 1 ? 's' : ''}</span>
            )}
            <span style={{ opacity: 0.8 }}>, cache cleared</span>
            {deleteResult.errors.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                {deleteResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan for sample user budget
        </StatusBox>
      ) : totalBudgets > 0 ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                🧪 Found <strong>{totalBudgets}</strong> budget{totalBudgets !== 1 ? 's' : ''} with{' '}
                <strong>{totalMonths}</strong> month{totalMonths !== 1 ? 's' : ''} for sample@sample.com:
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {budgets.map((budget: SampleBudgetInfo) => (
                  <div key={budget.budgetId} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      "{budget.budgetName}" ({budget.monthCount} month{budget.monthCount !== 1 ? 's' : ''})
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      ID: {budget.budgetId.slice(0, 20)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StatusBox>
          <ActionButton
            onClick={handleDeleteClick}
            disabled={disabled}
            isBusy={isDeleting}
            busyText="Deleting..."
            actionName="Delete Sample User Budget"
          >
            🗑️ Delete Sample User Data
          </ActionButton>
          <p style={{
            fontSize: '0.8rem',
            color: '#f59e0b',
            marginTop: '0.5rem',
            fontWeight: 500,
          }}>
            ⚠️ This resets sample@sample.com to a new user state
          </p>
        </>
      ) : staleBudgetIds.length > 0 ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                🔗 Found <strong>{staleBudgetIds.length}</strong> stale budget reference{staleBudgetIds.length !== 1 ? 's' : ''} in user document:
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {staleBudgetIds.map((budgetId: string) => (
                  <div key={budgetId} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                      Budget document no longer exists but ID is still in user's budget_ids
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      ID: {budgetId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StatusBox>
          <ActionButton
            onClick={handleDeleteClick}
            disabled={disabled}
            isBusy={isDeleting}
            busyText="Cleaning up..."
            actionName="Clean Stale Budget Reference"
          >
            🧹 Remove Stale Reference
          </ActionButton>
          <p style={{
            fontSize: '0.8rem',
            color: '#f59e0b',
            marginTop: '0.5rem',
            fontWeight: 500,
          }}>
            ⚠️ This will remove the orphaned budget ID from the user document
          </p>
        </>
      ) : (
        <StatusBox type="clean">
          ✅ No budget found for sample@sample.com — user is already in "new user" state.
        </StatusBox>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="🧪 Delete Sample User Budget?"
      >
        <div style={{
          background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
          border: '1px solid color-mix(in srgb, #f59e0b 40%, transparent)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <p style={{ margin: 0, color: '#fcd34d', fontWeight: 500, fontSize: '0.95rem' }}>
            ⚠️ This will delete all data for sample@sample.com!
          </p>
        </div>

        <p style={{ margin: '0 0 0.75rem', opacity: 0.9 }}>
          This will permanently delete <strong style={{ color: '#f59e0b' }}>{totalBudgets} budget{totalBudgets !== 1 ? 's' : ''}</strong> and{' '}
          <strong style={{ color: '#f59e0b' }}>{totalMonths} month{totalMonths !== 1 ? 's' : ''}</strong>.
        </p>

        <p style={{ margin: '0 0 1rem', opacity: 0.8, fontSize: '0.9rem' }}>
          After deletion, sample@sample.com will be treated as a brand new user:
        </p>
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

      {/* Progress Overlay */}
      {isDeleting && deleteProgress && (
        <DeleteSampleProgressOverlay progress={deleteProgress} />
      )}
    </MigrationCard>
  )
}

// =============================================================================
// DELETE PROGRESS OVERLAY
// =============================================================================

interface DeleteSampleProgressOverlayProps {
  progress: DeleteSampleProgress
}

function DeleteSampleProgressOverlay({ progress }: DeleteSampleProgressOverlayProps) {
  const getMessage = () => {
    switch (progress.phase) {
      case 'deleting-months':
        return 'Deleting months...'
      case 'deleting-payees':
        return 'Deleting payees...'
      case 'deleting-budgets':
        return 'Deleting budgets...'
      case 'updating-user':
        return 'Updating user document...'
      case 'clearing-cache':
        return 'Clearing cache...'
      case 'complete':
        return 'Complete!'
      default:
        return 'Processing...'
    }
  }

  // Orange gradient for sample user, green for cleanup/complete
  const getGradient = () => {
    if (progress.phase === 'updating-user' || progress.phase === 'clearing-cache' || progress.phase === 'complete') {
      return 'linear-gradient(90deg, #22c55e, #10b981)'
    }
    return 'linear-gradient(90deg, #f59e0b, #d97706)'
  }

  const getSpinnerColor = () => {
    if (progress.phase === 'updating-user' || progress.phase === 'clearing-cache' || progress.phase === 'complete') {
      return '#22c55e'
    }
    return '#f59e0b'
  }

  return (
    <LoadingOverlay message={getMessage()} spinnerColor={getSpinnerColor()}>
      <ProgressBar percent={progress.percentComplete} gradient={getGradient()} />

      <StatGrid columns={2}>
        <StatItem
          value={`${progress.monthsDeleted}/${progress.totalMonths}`}
          label="Months Deleted"
          color="#f59e0b"
        />
        <StatItem
          value={`${progress.budgetsDeleted}/${progress.totalBudgets}`}
          label="Budgets Deleted"
          color="#f59e0b"
        />
      </StatGrid>

      <PercentLabel percent={progress.percentComplete} />
    </LoadingOverlay>
  )
}

