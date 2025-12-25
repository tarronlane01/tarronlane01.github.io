import { MONTH_NAMES } from '../../../constants'
import type { FutureMonthInfo } from '../../../hooks/migrations/useFutureMonthsCleanup'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface FutureMonthsCleanupCardProps {
  hasData: boolean
  futureMonthsCount: number
  futureMonthsToDelete: FutureMonthInfo[]
  isCleaningFutureMonths: boolean
  onCleanup: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
  cleanupResult: {
    deleted: number
    errors: string[]
  } | null
}

export function FutureMonthsCleanupCard({
  hasData,
  futureMonthsCount,
  futureMonthsToDelete,
  isCleaningFutureMonths,
  onCleanup,
  onRefresh,
  isRefreshing,
  disabled,
  cleanupResult,
}: FutureMonthsCleanupCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (cleanupResult && cleanupResult.deleted > 0) return 'complete'
    if (futureMonthsCount === 0) return 'clean'
    return 'needs-action'
  }

  return (
    <MigrationCard
      title="🗑️ Clean Up Future Months"
      description="Deletes month documents that are more than 2 months in the future. These can be created accidentally when navigating too far ahead."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isCleaningFutureMonths}
    >
      {isCleaningFutureMonths ? (
        <StatusBox type="running">
          Deleting future months...
        </StatusBox>
      ) : cleanupResult ? (
        <StatusBox type={cleanupResult.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {cleanupResult.errors.length > 0 ? '⚠️' : '✅'} Deleted {cleanupResult.deleted} month{cleanupResult.deleted !== 1 ? 's' : ''}
            {cleanupResult.errors.length > 0 && (
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.85rem' }}>
                {cleanupResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to check for future months
        </StatusBox>
      ) : futureMonthsCount > 0 ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {futureMonthsCount} month{futureMonthsCount !== 1 ? 's' : ''} to delete:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {futureMonthsToDelete.slice(0, 10).map((m) => (
                  <li key={m.docId}>
                    {MONTH_NAMES[m.month - 1]} {m.year} (budget: {m.budgetId.slice(0, 8)}...)
                  </li>
                ))}
                {futureMonthsCount > 10 && (
                  <li style={{ opacity: 0.7 }}>...and {futureMonthsCount - 10} more</li>
                )}
              </ul>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onCleanup}
            disabled={disabled}
            isBusy={isCleaningFutureMonths}
            busyText="Deleting..."
          >
            🗑️ Delete {futureMonthsCount} Future Month{futureMonthsCount !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          ✅ No future months found beyond 2 months from now.
        </StatusBox>
      )}
    </MigrationCard>
  )
}
