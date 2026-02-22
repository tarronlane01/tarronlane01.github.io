/**
 * Remove Legacy Balance Fields Migration Row
 *
 * Displays status and controls for the legacy balance fields cleanup migration.
 */

import type { RemoveLegacyBalanceFieldsMigrationStatus, RemoveLegacyBalanceFieldsMigrationResult } from '@hooks/migrations/useRemoveLegacyBalanceFieldsMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'
import type React from 'react'

interface RemoveLegacyBalanceFieldsRowProps {
  status: RemoveLegacyBalanceFieldsMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: RemoveLegacyBalanceFieldsMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

function getStatus(
  _status: RemoveLegacyBalanceFieldsMigrationStatus | null,
  hasData: boolean,
  needsMigration: boolean,
  isRunning: boolean,
  result: RemoveLegacyBalanceFieldsMigrationResult | null
): MigrationRowStatus {
  if (isRunning) return 'running'
  if (result) {
    if (result.errors.length > 0) return 'error'
    return 'complete'
  }
  if (!hasData) return 'unknown'
  if (needsMigration) return 'needs-action'
  return 'clean'
}

function getStatusText(
  _status: RemoveLegacyBalanceFieldsMigrationStatus | null,
  hasData: boolean,
  needsMigration: boolean,
  totalItemsToFix: number
): string {
  if (!hasData) return 'No data scanned'
  if (needsMigration) return `${totalItemsToFix} budget(s) need migration`
  return 'No legacy fields found'
}

function renderDetails(
  result: RemoveLegacyBalanceFieldsMigrationResult | null,
  hasData: boolean,
  needsMigration: boolean,
  status: RemoveLegacyBalanceFieldsMigrationStatus | null,
  totalItemsToFix: number
): React.ReactNode {
  if (result) {
    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
          {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Migration complete'}
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
          {result.budgetsUpdated > 0 && <li>{result.budgetsUpdated} budget(s) updated</li>}
          {result.budgetsUpdated === 0 && result.budgetsProcessed > 0 && <li>No budgets needed updates</li>}
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
    return (
      <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
        Click check to scan for budgets with category_balances_cache or category_balances_snapshot fields.
      </div>
    )
  }

  if (!needsMigration) {
    return (
      <div style={{ fontSize: '0.85rem' }}>
        ✅ All budgets are clean.
        <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budget(s).
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontSize: '0.85rem' }}>
      <div style={{ marginBottom: '0.25rem' }}>
        Found {totalItemsToFix} budget(s) with legacy balance fields.
      </div>
      {status && (
        <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>
          {status.budgetsWithLegacyFields} with legacy fields to remove
        </div>
      )}
    </div>
  )
}

export function RemoveLegacyBalanceFieldsRow({
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
}: RemoveLegacyBalanceFieldsRowProps) {
  return (
    <MigrationRow
      name="Remove Legacy Balance Fields"
      description="Removes deprecated category_balances_cache and category_balances_snapshot fields from budgets."
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
