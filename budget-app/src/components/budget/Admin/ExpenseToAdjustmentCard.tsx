import type { ExpenseToAdjustmentStatus, ExpenseToAdjustmentResult } from '@hooks/migrations/useExpenseToAdjustmentMigration'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface ExpenseToAdjustmentCardProps {
  hasData: boolean
  status: ExpenseToAdjustmentStatus | null
  hasItemsToMigrate: boolean
  isRunning: boolean
  result: ExpenseToAdjustmentResult | null
  onRunMigration: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function ExpenseToAdjustmentCard({
  hasData,
  status,
  hasItemsToMigrate,
  isRunning,
  result,
  onRunMigration,
  onRefresh,
  isRefreshing,
  disabled,
}: ExpenseToAdjustmentCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0 && result.expensesMigrated > 0) return 'complete'
    if (!hasItemsToMigrate) return 'clean'
    return 'needs-action'
  }

  return (
    <MigrationCard
      title="📦 Expense to Adjustment Migration"
      description="Migrates expense entries with 'No Account' or 'No Category' to the new Adjustments tab. Also fixes invalid account/category IDs like 'unknown' by converting them to proper no-account/no-category values. After this migration, the Spend tab will require both a real account AND category."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Running expense to adjustment migration...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Migration complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} scanned</li>
              )}
              {result.monthsProcessed > 0 && (
                <li>{result.monthsProcessed} month{result.monthsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.expensesMigrated > 0 && (
                <li>{result.expensesMigrated} expense{result.expensesMigrated !== 1 ? 's' : ''} migrated to adjustments</li>
              )}
              {result.invalidAccountsFixed > 0 && (
                <li>{result.invalidAccountsFixed} invalid account ID{result.invalidAccountsFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.invalidCategoriesFixed > 0 && (
                <li>{result.invalidCategoriesFixed} invalid category ID{result.invalidCategoriesFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.expensesMigrated === 0 && <li>No changes needed</li>}
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
                💾 All data migrated successfully. Run "Database Cleanup" to recalculate balances.
              </p>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan the database
        </StatusBox>
      ) : hasItemsToMigrate ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {status!.expensesToMigrate} expense{status!.expensesToMigrate !== 1 ? 's' : ''} to migrate:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                <li>{status!.expensesToMigrate} expense{status!.expensesToMigrate !== 1 ? 's' : ''} with No Account or No Category</li>
                {status!.invalidAccountsToFix > 0 && (
                  <li>{status!.invalidAccountsToFix} invalid account ID{status!.invalidAccountsToFix !== 1 ? 's' : ''} (e.g., "unknown")</li>
                )}
                {status!.invalidCategoriesToFix > 0 && (
                  <li>{status!.invalidCategoriesToFix} invalid category ID{status!.invalidCategoriesToFix !== 1 ? 's' : ''} (e.g., "unknown")</li>
                )}
              </ul>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} and {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''}.
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onRunMigration}
            disabled={disabled}
            isBusy={isRunning}
            busyText="Migrating..."
            actionName="Run Expense to Adjustment Migration"
          >
            📦 Migrate {status!.expensesToMigrate} Expense{status!.expensesToMigrate !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ No expenses need migration
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              All {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''} across {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} have valid expense data.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

