import type { OrphanedIdCleanupStatus, OrphanedIdCleanupResult } from '@hooks/migrations/useOrphanedIdCleanup'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface OrphanedIdCleanupCardProps {
  hasData: boolean
  status: OrphanedIdCleanupStatus | null
  hasItemsToFix: boolean
  isRunning: boolean
  result: OrphanedIdCleanupResult | null
  onRunMigration: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function OrphanedIdCleanupCard({
  hasData,
  status,
  hasItemsToFix,
  isRunning,
  result,
  onRunMigration,
  onRefresh,
  isRefreshing,
  disabled,
}: OrphanedIdCleanupCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0 && (result.categoryIdsFixed > 0 || result.accountIdsFixed > 0)) return 'complete'
    if (!hasItemsToFix) return 'clean'
    return 'needs-action'
  }

  const totalOrphaned = status ? status.orphanedCategoryIds + status.orphanedAccountIds : 0
  const totalFixed = result ? result.categoryIdsFixed + result.accountIdsFixed : 0

  return (
    <MigrationCard
      title="🔗 Orphaned ID Cleanup"
      description="Finds transactions referencing deleted or non-existent categories/accounts and converts them to 'No Category' / 'No Account'. Run this BEFORE the Expense to Adjustment migration."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Running orphaned ID cleanup...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Cleanup complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} scanned</li>
              )}
              {result.monthsProcessed > 0 && (
                <li>{result.monthsProcessed} month{result.monthsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.categoryIdsFixed > 0 && (
                <li>{result.categoryIdsFixed} orphaned category ID{result.categoryIdsFixed !== 1 ? 's' : ''} → No Category</li>
              )}
              {result.accountIdsFixed > 0 && (
                <li>{result.accountIdsFixed} orphaned account ID{result.accountIdsFixed !== 1 ? 's' : ''} → No Account</li>
              )}
              {totalFixed === 0 && <li>No changes needed</li>}
            </ul>
            {result.errors.length > 0 ? (
              <>
                <p style={{ margin: '0.75rem 0 0.25rem 0', fontWeight: 500, color: '#ef4444' }}>Errors:</p>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.85rem', color: '#ef4444' }}>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li style={{ opacity: 0.7 }}>...and {result.errors.length - 5} more errors</li>
                  )}
                </ul>
              </>
            ) : (
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                💾 Now run "Expense to Adjustment Migration" to move these to the Adjustments tab.
              </p>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan the database
        </StatusBox>
      ) : hasItemsToFix ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalOrphaned} orphaned ID{totalOrphaned !== 1 ? 's' : ''} to fix:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {status!.orphanedCategoryIds > 0 && (
                  <li>{status!.orphanedCategoryIds} orphaned category ID{status!.orphanedCategoryIds !== 1 ? 's' : ''}</li>
                )}
                {status!.orphanedAccountIds > 0 && (
                  <li>{status!.orphanedAccountIds} orphaned account ID{status!.orphanedAccountIds !== 1 ? 's' : ''}</li>
                )}
              </ul>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Affected transactions: {status!.affectedExpenses} expense{status!.affectedExpenses !== 1 ? 's' : ''}, {status!.affectedIncome} income, {status!.affectedTransfers} transfer{status!.affectedTransfers !== 1 ? 's' : ''}, {status!.affectedAdjustments} adjustment{status!.affectedAdjustments !== 1 ? 's' : ''}
              </p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} and {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''}.
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onRunMigration}
            disabled={disabled}
            isBusy={isRunning}
            busyText="Cleaning up..."
            actionName="Run Orphaned ID Cleanup"
          >
            🔗 Fix {totalOrphaned} Orphaned ID{totalOrphaned !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ No orphaned IDs found
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              All {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''} across {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} have valid category/account references.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

