/**
 * Recalculate Start Balances Row
 *
 * Maintenance migration to recalculate and save start_balance for all months
 * from the first month in each budget up to the earliest month in the window.
 */

import type { RecalculateStartBalancesMigrationStatus, RecalculateStartBalancesMigrationResult } from '@hooks/migrations/useRecalculateStartBalancesMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface RecalculateStartBalancesRowProps {
  status: RecalculateStartBalancesMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: RecalculateStartBalancesMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function RecalculateStartBalancesRow({
  status,
  hasData,
  needsMigration,
  totalItemsToFix,
  isChecking,
  isRunning,
  result,
  onCheck,
  onRun,
  disabled,
}: RecalculateStartBalancesRowProps) {
  const getStatus = (): MigrationRowStatus => {
    if (isRunning) return 'running'
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (result && result.errors.length > 0) return 'error'
    if (!needsMigration) return 'clean'
    return 'needs-action'
  }

  const getStatusText = (): string | undefined => {
    if (result && result.errors.length === 0) {
      return result.monthsUpdated > 0 ? `Updated ${result.monthsUpdated} month(s)` : 'Complete'
    }
    return undefined
  }

  const renderDetails = () => {
    if (result) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Recalculation complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
            {result.monthsProcessed > 0 && <li>{result.monthsProcessed} month(s) processed</li>}
            {result.monthsUpdated > 0 && <li>{result.monthsUpdated} month(s) updated</li>}
            {result.monthsUpdated === 0 && <li>No changes needed</li>}
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
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for months needing recalculation.</div>
    }

    if (!needsMigration) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All start balances are up to date.
          <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
            Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>Months needing recalculation:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>{status!.monthsNeedingRecalculation} month(s) from first month up to earliest window month</li>
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Recalculate Start Balances"
      description="Recalculates and saves start_balance for all months from the first month up to the earliest month in the window"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={needsMigration ? `Recalculate ${totalItemsToFix}` : undefined}
      disabled={disabled}
      itemCount={needsMigration ? totalItemsToFix : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}
