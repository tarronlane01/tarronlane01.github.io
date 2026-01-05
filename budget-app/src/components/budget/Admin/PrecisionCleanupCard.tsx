import type { PrecisionCleanupStatus, PrecisionCleanupResult } from '@hooks/migrations/usePrecisionCleanup'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface PrecisionCleanupCardProps {
  hasData: boolean
  status: PrecisionCleanupStatus | null
  hasIssues: boolean
  totalIssues: number
  isRunning: boolean
  result: PrecisionCleanupResult | null
  onRunCleanup: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function PrecisionCleanupCard({
  hasData,
  status,
  hasIssues,
  totalIssues,
  isRunning,
  result,
  onRunCleanup,
  onRefresh,
  isRefreshing,
  disabled,
}: PrecisionCleanupCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0 && (
      result.budgetsProcessed > 0 ||
      result.monthsProcessed > 0
    )) return 'complete'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  const totalFixed = result ? (
    result.accountsFixed +
    result.categoriesFixed +
    result.totalAvailableFixed +
    result.incomeValuesFixed +
    result.expenseValuesFixed +
    result.categoryBalancesFixed +
    result.accountBalancesFixed
  ) : 0

  return (
    <MigrationCard
      title="🔢 Currency Precision Cleanup"
      description="Fixes floating-point precision issues by rounding all currency values to exactly 2 decimal places. Processes all months in batches, recalculates budget balances, and clears all caches. This prevents display issues like '$0.00' showing as orange (slightly negative) or totals not summing correctly."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Running precision cleanup...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Cleanup complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.accountsFixed > 0 && (
                <li>{result.accountsFixed} account balance{result.accountsFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.categoriesFixed > 0 && (
                <li>{result.categoriesFixed} category value{result.categoriesFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.totalAvailableFixed > 0 && (
                <li>{result.totalAvailableFixed} total_available value{result.totalAvailableFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.monthsProcessed > 0 && (
                <li>{result.monthsProcessed} month{result.monthsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.incomeValuesFixed > 0 && (
                <li>{result.incomeValuesFixed} income amount{result.incomeValuesFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.expenseValuesFixed > 0 && (
                <li>{result.expenseValuesFixed} expense amount{result.expenseValuesFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.categoryBalancesFixed > 0 && (
                <li>{result.categoryBalancesFixed} category balance{result.categoryBalancesFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.accountBalancesFixed > 0 && (
                <li>{result.accountBalancesFixed} account balance{result.accountBalancesFixed !== 1 ? 's' : ''} fixed</li>
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
                💾 All budgets recalculated and cache cleared.
              </p>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan the database
        </StatusBox>
      ) : hasIssues ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalIssues} precision issue{totalIssues !== 1 ? 's' : ''} to fix:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {status!.budgetsWithPrecisionIssues > 0 && (
                  <li>
                    {status!.budgetsWithPrecisionIssues} budget{status!.budgetsWithPrecisionIssues !== 1 ? 's' : ''} with precision issues
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                      {status!.accountsWithPrecisionIssues > 0 && (
                        <li>{status!.accountsWithPrecisionIssues} account balance{status!.accountsWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                      {status!.categoriesWithPrecisionIssues > 0 && (
                        <li>{status!.categoriesWithPrecisionIssues} category value{status!.categoriesWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                      {status!.totalAvailableWithPrecisionIssues > 0 && (
                        <li>{status!.totalAvailableWithPrecisionIssues} total_available value{status!.totalAvailableWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                    </ul>
                  </li>
                )}
                {status!.monthsWithPrecisionIssues > 0 && (
                  <li>
                    {status!.monthsWithPrecisionIssues} month{status!.monthsWithPrecisionIssues !== 1 ? 's' : ''} with precision issues
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                      {status!.incomeValuesWithPrecisionIssues > 0 && (
                        <li>{status!.incomeValuesWithPrecisionIssues} income amount{status!.incomeValuesWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                      {status!.expenseValuesWithPrecisionIssues > 0 && (
                        <li>{status!.expenseValuesWithPrecisionIssues} expense amount{status!.expenseValuesWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                      {status!.categoryBalancesWithPrecisionIssues > 0 && (
                        <li>{status!.categoryBalancesWithPrecisionIssues} category balance value{status!.categoryBalancesWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                      {status!.accountBalancesWithPrecisionIssues > 0 && (
                        <li>{status!.accountBalancesWithPrecisionIssues} account balance value{status!.accountBalancesWithPrecisionIssues !== 1 ? 's' : ''}</li>
                      )}
                    </ul>
                  </li>
                )}
              </ul>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status!.totalBudgets} budgets and {status!.totalMonths} months.
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onRunCleanup}
            disabled={disabled}
            isBusy={isRunning}
            busyText="Running..."
            actionName="Run Precision Cleanup"
          >
            🔧 Fix {totalIssues} Issue{totalIssues !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ All currency values have proper precision
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              All {status!.totalBudgets} budgets and {status!.totalMonths} months have values rounded to 2 decimal places.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

