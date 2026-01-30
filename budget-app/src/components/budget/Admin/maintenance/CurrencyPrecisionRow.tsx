/**
 * Currency Precision Row
 *
 * Compact row for fixing floating-point precision issues.
 */

import type { PrecisionCleanupStatus, PrecisionCleanupResult } from '@hooks/migrations/usePrecisionCleanup'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface CurrencyPrecisionRowProps {
  status: PrecisionCleanupStatus | null
  hasData: boolean
  hasIssues: boolean
  totalIssues: number
  isChecking: boolean
  isRunning: boolean
  result: PrecisionCleanupResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function CurrencyPrecisionRow({
  status,
  hasData,
  hasIssues,
  totalIssues,
  isChecking,
  isRunning,
  result,
  onCheck,
  onRun,
  disabled,
}: CurrencyPrecisionRowProps) {
  const getStatus = (): MigrationRowStatus => {
    if (isRunning) return 'running'
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (result && result.errors.length > 0) return 'error'
    if (!hasIssues) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string | undefined => {
    if (result && result.errors.length === 0) {
      const totalFixed = (
        result.accountsFixed +
        result.categoriesFixed +
        result.totalAvailableFixed +
        result.incomeValuesFixed +
        result.expenseValuesFixed +
        result.categoryBalancesFixed +
        result.accountBalancesFixed
      )
      return totalFixed > 0 ? `Fixed ${totalFixed}` : 'Complete'
    }
    return undefined
  }

  const renderDetails = () => {
    if (result) {
      const totalFixed = (
        result.accountsFixed +
        result.categoriesFixed +
        result.totalAvailableFixed +
        result.incomeValuesFixed +
        result.expenseValuesFixed +
        result.categoryBalancesFixed +
        result.accountBalancesFixed
      )

      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Cleanup complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) updated</li>}
            {result.accountsFixed > 0 && <li>{result.accountsFixed} account balance(s) fixed</li>}
            {result.categoriesFixed > 0 && <li>{result.categoriesFixed} category value(s) fixed</li>}
            {result.totalAvailableFixed > 0 && <li>{result.totalAvailableFixed} total_available value(s) fixed</li>}
            {result.monthsProcessed > 0 && <li>{result.monthsProcessed} month(s) updated</li>}
            {result.incomeValuesFixed > 0 && <li>{result.incomeValuesFixed} income amount(s) fixed</li>}
            {result.expenseValuesFixed > 0 && <li>{result.expenseValuesFixed} expense amount(s) fixed</li>}
            {result.categoryBalancesFixed > 0 && <li>{result.categoryBalancesFixed} category balance(s) fixed</li>}
            {result.accountBalancesFixed > 0 && <li>{result.accountBalancesFixed} account balance(s) fixed</li>}
            {totalFixed === 0 && <li>No changes needed</li>}
          </ul>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '0.5rem', color: 'var(--color-error)' }}>
              <div>Errors ({result.errors.length}):</div>
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
                {result.errors.slice(0, 3).map((err, i) => <li key={i}>{err}</li>)}
                {result.errors.length > 3 && <li>...and {result.errors.length - 3} more</li>}
              </ul>
            </div>
          )}
        </div>
      )
    }

    if (!hasData) {
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for precision issues.</div>
    }

    if (!hasIssues) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All currency values have proper precision (2 decimal places).
          <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
            Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>Precision issues found:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {status!.budgetsWithPrecisionIssues > 0 && (
            <li>
              {status!.budgetsWithPrecisionIssues} budget(s) with issues:
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', opacity: 0.8 }}>
                {status!.accountsWithPrecisionIssues > 0 && (
                  <li>{status!.accountsWithPrecisionIssues} account balance(s)</li>
                )}
                {status!.categoriesWithPrecisionIssues > 0 && (
                  <li>{status!.categoriesWithPrecisionIssues} category value(s)</li>
                )}
                {status!.totalAvailableWithPrecisionIssues > 0 && (
                  <li>{status!.totalAvailableWithPrecisionIssues} total_available value(s)</li>
                )}
              </ul>
            </li>
          )}
          {status!.monthsWithPrecisionIssues > 0 && (
            <li>
              {status!.monthsWithPrecisionIssues} month(s) with issues:
              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem', opacity: 0.8 }}>
                {status!.incomeValuesWithPrecisionIssues > 0 && (
                  <li>{status!.incomeValuesWithPrecisionIssues} income amount(s)</li>
                )}
                {status!.expenseValuesWithPrecisionIssues > 0 && (
                  <li>{status!.expenseValuesWithPrecisionIssues} expense amount(s)</li>
                )}
                {status!.categoryBalancesWithPrecisionIssues > 0 && (
                  <li>{status!.categoryBalancesWithPrecisionIssues} category balance(s)</li>
                )}
                {status!.accountBalancesWithPrecisionIssues > 0 && (
                  <li>{status!.accountBalancesWithPrecisionIssues} account balance(s)</li>
                )}
              </ul>
            </li>
          )}
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Currency Precision"
      description="Fixes floating-point precision by rounding all values to 2 decimal places"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={`Fix ${totalIssues}`}
      disabled={disabled}
      itemCount={hasIssues ? totalIssues : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}

