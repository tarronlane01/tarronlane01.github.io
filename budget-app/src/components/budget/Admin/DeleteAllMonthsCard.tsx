import { MONTH_NAMES } from '../../../constants'
import type { MonthInfo } from '../../../hooks/migrations/useDeleteAllMonths'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

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
  } | null
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
}: DeleteAllMonthsCardProps) {
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
            onClick={onDelete}
            disabled={disabled}
            isBusy={isDeleting}
            busyText="Deleting..."
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
    </MigrationCard>
  )
}

