import { MONTH_NAMES } from '../../../constants'
import type { DatabaseCleanupStatus, DatabaseCleanupResult } from '../../../hooks/migrations/useDatabaseCleanup'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface DatabaseCleanupCardProps {
  hasData: boolean
  status: DatabaseCleanupStatus | null
  hasIssues: boolean
  totalIssues: number
  isRunning: boolean
  result: DatabaseCleanupResult | null
  onRunCleanup: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function DatabaseCleanupCard({
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
}: DatabaseCleanupCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0 && (
      result.accountsFixed > 0 ||
      result.categoriesFixed > 0 ||
      result.groupsFixed > 0 ||
      result.futureMonthsDeleted > 0 ||
      result.monthsFixed > 0
    )) return 'complete'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  const totalFixed = result ? (
    result.accountsFixed +
    result.categoriesFixed +
    result.groupsFixed +
    result.futureMonthsDeleted +
    result.monthsFixed
  ) : 0

  return (
    <MigrationCard
      title="🗄️ Database Cleanup"
      description="Validates and fixes all budget and month documents to match the expected schema. Converts legacy formats, adds missing default values, and removes invalid future months."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Running database cleanup...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Cleanup complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.arraysConverted > 0 && (
                <li>{result.arraysConverted} array{result.arraysConverted !== 1 ? 's' : ''} converted to maps</li>
              )}
              {result.accountsFixed > 0 && (
                <li>{result.accountsFixed} account{result.accountsFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.categoriesFixed > 0 && (
                <li>{result.categoriesFixed} categor{result.categoriesFixed !== 1 ? 'ies' : 'y'} fixed</li>
              )}
              {result.groupsFixed > 0 && (
                <li>{result.groupsFixed} group{result.groupsFixed !== 1 ? 's' : ''} fixed</li>
              )}
              {result.futureMonthsDeleted > 0 && (
                <li>{result.futureMonthsDeleted} future month{result.futureMonthsDeleted !== 1 ? 's' : ''} deleted</li>
              )}
              {result.monthsFixed > 0 && (
                <li>{result.monthsFixed} month{result.monthsFixed !== 1 ? 's' : ''} schema fixed</li>
              )}
              {totalFixed === 0 && <li>No changes needed</li>}
            </ul>
            {result.errors.length > 0 && (
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
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalIssues} issue{totalIssues !== 1 ? 's' : ''} to fix:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {status!.budgetsWithArrays > 0 && (
                  <li>
                    {status!.budgetsWithArrays} budget{status!.budgetsWithArrays !== 1 ? 's' : ''} using legacy array format
                  </li>
                )}
                {status!.accountsNeedingDefaults > 0 && (
                  <li>
                    {status!.accountsNeedingDefaults} account{status!.accountsNeedingDefaults !== 1 ? 's' : ''} missing default values
                  </li>
                )}
                {status!.categoriesNeedingDefaults > 0 && (
                  <li>
                    {status!.categoriesNeedingDefaults} categor{status!.categoriesNeedingDefaults !== 1 ? 'ies' : 'y'} missing default values
                  </li>
                )}
                {status!.groupsNeedingDefaults > 0 && (
                  <li>
                    {status!.groupsNeedingDefaults} account group{status!.groupsNeedingDefaults !== 1 ? 's' : ''} missing default values
                  </li>
                )}
                {status!.futureMonthsToDelete.length > 0 && (
                  <li>
                    {status!.futureMonthsToDelete.length} future month{status!.futureMonthsToDelete.length !== 1 ? 's' : ''} to delete
                    <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                      {status!.futureMonthsToDelete.slice(0, 3).map((m) => (
                        <li key={m.docId}>
                          {MONTH_NAMES[m.month - 1]} {m.year}
                        </li>
                      ))}
                      {status!.futureMonthsToDelete.length > 3 && (
                        <li style={{ opacity: 0.7 }}>...and {status!.futureMonthsToDelete.length - 3} more</li>
                      )}
                    </ul>
                  </li>
                )}
                {status!.monthsWithSchemaIssues > 0 && (
                  <li>
                    {status!.monthsWithSchemaIssues} month{status!.monthsWithSchemaIssues !== 1 ? 's' : ''} with schema issues
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
            actionName="Run Database Cleanup"
          >
            🔧 Fix {totalIssues} Issue{totalIssues !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ Database is clean
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              All {status!.totalBudgets} budgets and {status!.totalMonths} months match expected schema.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

