import { useState } from 'react'
import { MONTH_NAMES } from '@constants'
import type { MonthInfo, DeleteProgress } from '@hooks/migrations/useDeleteAllMonths'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'
import { LoadingOverlay, ProgressBar, StatItem, StatGrid, PercentLabel } from '../../app/LoadingOverlay'
import { Modal, Button } from '../../ui'

interface DeleteAllMonthsCardProps {
  hasData: boolean
  monthsCount: number
  budgetCount: number
  monthsToDelete: MonthInfo[]
  isDeleting: boolean
  onDelete: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
  deleteResult: {
    deleted: number
    errors: string[]
    budgetsRecalculated: number
  } | null
  deleteProgress: DeleteProgress | null
}

export function DeleteAllMonthsCard({
  hasData,
  monthsCount,
  budgetCount,
  monthsToDelete,
  isDeleting,
  onDelete,
  onRefresh,
  isRefreshing,
  disabled,
  deleteResult,
  deleteProgress,
}: DeleteAllMonthsCardProps) {
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
    if (deleteResult && deleteResult.deleted > 0 && deleteResult.errors.length === 0) return 'complete'
    if (monthsCount === 0) return 'clean'
    return 'needs-action'
  }

  // Group months by budget for display
  const monthsByBudget = monthsToDelete.reduce<Record<string, MonthInfo[]>>((acc, m) => {
    const key = m.budgetId
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <MigrationCard
      title="⚠️ Delete ALL Months"
      description="DESTRUCTIVE: Deletes ALL month documents from Firebase for ALL budgets. This will reset all income, expenses, and allocations. Use with extreme caution!"
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isDeleting}
    >
      {isDeleting ? (
        <StatusBox type="running">
          Deleting all months...
        </StatusBox>
      ) : deleteResult ? (
        <StatusBox type={deleteResult.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {deleteResult.errors.length > 0 ? '⚠️' : '✅'} Deleted {deleteResult.deleted} month{deleteResult.deleted !== 1 ? 's' : ''}
            {deleteResult.budgetsRecalculated > 0 && (
              <span>, reset {deleteResult.budgetsRecalculated} budget{deleteResult.budgetsRecalculated !== 1 ? 's' : ''}</span>
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
          ❓ Status unknown — click Refresh to scan for months
        </StatusBox>
      ) : monthsCount > 0 ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>
                🚨 Found <strong>{monthsCount}</strong> month{monthsCount !== 1 ? 's' : ''} across <strong>{budgetCount}</strong> budget{budgetCount !== 1 ? 's' : ''}:
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {Object.entries(monthsByBudget).slice(0, 5).map(([budgetId, months]) => (
                  <div key={budgetId} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                      Budget: {budgetId.slice(0, 12)}...
                    </div>
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                      {months.slice(0, 3).map((m) => (
                        <li key={m.docId}>
                          {MONTH_NAMES[m.month - 1]} {m.year}
                        </li>
                      ))}
                      {months.length > 3 && (
                        <li style={{ opacity: 0.7 }}>...and {months.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                ))}
                {Object.keys(monthsByBudget).length > 5 && (
                  <div style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    ...and {Object.keys(monthsByBudget).length - 5} more budgets
                  </div>
                )}
              </div>
            </div>
          </StatusBox>
          <ActionButton
            onClick={handleDeleteClick}
            disabled={disabled}
            isBusy={isDeleting}
            busyText="Deleting..."
            actionName="Delete All Months"
          >
            🗑️ Delete ALL {monthsCount} Month{monthsCount !== 1 ? 's' : ''}
          </ActionButton>
          <p style={{
            fontSize: '0.8rem',
            color: '#ef4444',
            marginTop: '0.5rem',
            fontWeight: 500,
          }}>
            ⚠️ This action cannot be undone!
          </p>
        </>
      ) : (
        <StatusBox type="clean">
          ✅ No month documents found in Firebase.
        </StatusBox>
      )}

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
          This will permanently delete <strong style={{ color: '#ef4444' }}>{monthsCount} month{monthsCount !== 1 ? 's' : ''}</strong> across{' '}
          <strong style={{ color: '#ef4444' }}>{budgetCount} budget{budgetCount !== 1 ? 's' : ''}</strong>.
        </p>

        <p style={{ margin: '0 0 1rem', opacity: 0.8, fontSize: '0.9rem' }}>
          After deletion, all affected budgets will be reset:
        </p>
        <ul style={{ margin: '0 0 1.5rem', paddingLeft: '1.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
          <li>All account balances → $0</li>
          <li>All category balances → $0</li>
          <li>Month history cleared</li>
          <li>Cache cleared automatically</li>
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

      {/* Progress Overlay */}
      {isDeleting && deleteProgress && (
        <DeleteProgressOverlay progress={deleteProgress} />
      )}
    </MigrationCard>
  )
}

// =============================================================================
// DELETE PROGRESS OVERLAY
// =============================================================================

interface DeleteProgressOverlayProps {
  progress: DeleteProgress
}

function DeleteProgressOverlay({ progress }: DeleteProgressOverlayProps) {
  const getMessage = () => {
    switch (progress.phase) {
      case 'deleting':
        return progress.currentMonth
          ? `Deleting ${progress.currentMonth}...`
          : 'Deleting months...'
      case 'resetting-budgets':
        return progress.currentMonth
          ? `Resetting ${progress.currentMonth}...`
          : 'Resetting budgets...'
      case 'clearing-cache':
        return 'Clearing cache...'
      case 'complete':
        return 'Complete!'
      default:
        return 'Processing...'
    }
  }

  // Red gradient for destructive operation, green for reset/complete
  const getGradient = () => {
    if (progress.phase === 'resetting-budgets' || progress.phase === 'clearing-cache') {
      return 'linear-gradient(90deg, #22c55e, #10b981)'
    }
    return 'linear-gradient(90deg, #ef4444, #dc2626)'
  }

  const getSpinnerColor = () => {
    if (progress.phase === 'resetting-budgets' || progress.phase === 'clearing-cache') {
      return '#22c55e'
    }
    return '#ef4444'
  }

  return (
    <LoadingOverlay message={getMessage()} spinnerColor={getSpinnerColor()}>
      <ProgressBar percent={progress.percentComplete} gradient={getGradient()} />

      {progress.phase === 'deleting' && (
        <StatGrid columns={2}>
          <StatItem
            value={`${progress.deleted}/${progress.total}`}
            label="Months Deleted"
            color="#ef4444"
          />
          <StatItem
            value={progress.total - progress.deleted}
            label="Remaining"
            color="rgba(255, 255, 255, 0.6)"
          />
        </StatGrid>
      )}

      {progress.phase === 'resetting-budgets' && (
        <StatGrid columns={2}>
          <StatItem
            value={progress.deleted}
            label="Months Deleted"
            color="#ef4444"
          />
          <StatItem
            value={`${progress.budgetsRecalculated}/${progress.totalBudgets}`}
            label="Budgets Reset"
            color="#22c55e"
          />
        </StatGrid>
      )}

      {(progress.phase === 'clearing-cache' || progress.phase === 'complete') && (
        <StatGrid columns={2}>
          <StatItem
            value={progress.deleted}
            label="Months Deleted"
            color="#ef4444"
          />
          <StatItem
            value={progress.budgetsRecalculated}
            label="Budgets Reset"
            color="#22c55e"
          />
        </StatGrid>
      )}

      <PercentLabel percent={progress.percentComplete} />
    </LoadingOverlay>
  )
}

