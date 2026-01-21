/**
 * Remove Previous Month Income Migration Row
 *
 * One-time migration to remove previous_month_income from month documents.
 */

import { MigrationRow, type MigrationRowStatus } from '../common'
import type { RemovePreviousMonthIncomeMigrationStatus, RemovePreviousMonthIncomeMigrationResult } from '@hooks/migrations/useRemovePreviousMonthIncomeMigration'
import type React from 'react'

interface RemovePreviousMonthIncomeRowProps {
  status: RemovePreviousMonthIncomeMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: RemovePreviousMonthIncomeMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

function getStatus(_status: RemovePreviousMonthIncomeMigrationStatus | null, hasData: boolean, needsMigration: boolean, isRunning: boolean, result: RemovePreviousMonthIncomeMigrationResult | null): MigrationRowStatus {
  if (isRunning) return 'running'
  if (result) {
    if (result.errors.length > 0) return 'error'
    return 'complete'
  }
  if (!hasData) return 'unknown'
  if (needsMigration) return 'needs-action'
  return 'clean'
}

function getStatusText(_status: RemovePreviousMonthIncomeMigrationStatus | null, hasData: boolean, needsMigration: boolean, totalItemsToFix: number): string {
  if (!hasData) return 'No data scanned'
  if (needsMigration) return `${totalItemsToFix} month(s) need migration`
  return 'No data to migrate'
}

function renderDetails(result: RemovePreviousMonthIncomeMigrationResult | null, hasData: boolean, needsMigration: boolean, status: RemovePreviousMonthIncomeMigrationStatus | null, totalItemsToFix: number): React.ReactNode {
  if (result) {
    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
          {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Migration complete'}
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
          {result.monthsProcessed > 0 && <li>{result.monthsProcessed} month(s) processed</li>}
          {result.monthsUpdated > 0 && <li>{result.monthsUpdated} month(s) updated</li>}
          {result.monthsUpdated === 0 && result.monthsProcessed > 0 && <li>No months needed updates</li>}
        </ul>
        {result.errors.length > 0 && (
          <div style={{ marginTop: '0.5rem', color: '#ef4444' }}>
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
    return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for months with previous_month_income field.</div>
  }

  if (!needsMigration) {
    return (
      <div style={{ fontSize: '0.85rem' }}>
        ✅ All months are clean.
        <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
          Scanned {status!.totalMonths} month(s) across {status!.totalBudgets} budget(s).
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontSize: '0.85rem' }}>
      <div style={{ marginBottom: '0.25rem' }}>
        Found {totalItemsToFix} month(s) with previous_month_income field.
      </div>
      <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>
        This field is now calculated from the previous month's income array.
      </div>
    </div>
  )
}

export function RemovePreviousMonthIncomeRow({
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
}: RemovePreviousMonthIncomeRowProps) {
  return (
    <MigrationRow
      name="Remove Previous Month Income Migration"
      description="Removes previous_month_income from month documents. This is calculated from the previous month's income array on-the-fly."
      status={getStatus(status, hasData, needsMigration, isRunning, result)}
      statusText={getStatusText(status, hasData, needsMigration, totalItemsToFix)}
      isChecking={isChecking}
      isRunning={isRunning}
      onCheck={onCheck}
      onRun={needsMigration ? onRun : undefined}
      actionText={needsMigration ? `Migrate ${totalItemsToFix}` : undefined}
      disabled={disabled}
      itemCount={totalItemsToFix}
      details={renderDetails(result, hasData, needsMigration, status, totalItemsToFix)}
    />
  )
}
