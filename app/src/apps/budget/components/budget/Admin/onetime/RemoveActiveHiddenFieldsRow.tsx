/**
 * Remove Active/Hidden Fields Migration Row
 *
 * Displays status and controls for removing is_active and is_hidden fields
 * from accounts and account groups, migrating their semantics to on_budget.
 */

import type {
  RemoveActiveHiddenFieldsMigrationStatus,
  RemoveActiveHiddenFieldsMigrationResult,
} from '@budget/hooks/migrations/useRemoveActiveHiddenFieldsMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'
import type React from 'react'

interface RemoveActiveHiddenFieldsRowProps {
  status: RemoveActiveHiddenFieldsMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: RemoveActiveHiddenFieldsMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

function getStatus(
  _status: RemoveActiveHiddenFieldsMigrationStatus | null,
  hasData: boolean,
  needsMigration: boolean,
  isRunning: boolean,
  result: RemoveActiveHiddenFieldsMigrationResult | null
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
  status: RemoveActiveHiddenFieldsMigrationStatus | null,
  hasData: boolean,
  needsMigration: boolean,
  totalItemsToFix: number
): string {
  if (!hasData) return 'No data scanned'
  if (needsMigration) {
    const details: string[] = []
    if (status!.accountsWithIsHidden > 0) details.push(`${status!.accountsWithIsHidden} hidden`)
    if (status!.accountsWithIsActiveFalse > 0) details.push(`${status!.accountsWithIsActiveFalse} inactive`)
    if (status!.groupsWithIsActive > 0) details.push(`${status!.groupsWithIsActive} group overrides`)
    return `${totalItemsToFix} budget(s): ${details.join(', ')}`
  }
  return 'No legacy fields found'
}

function renderDetails(
  result: RemoveActiveHiddenFieldsMigrationResult | null,
  hasData: boolean,
  needsMigration: boolean,
  status: RemoveActiveHiddenFieldsMigrationStatus | null,
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
          {result.accountsMigratedToOffBudget > 0 && <li>{result.accountsMigratedToOffBudget} account(s) moved to off-budget</li>}
          {result.groupFieldsRemoved > 0 && <li>{result.groupFieldsRemoved} group is_active field(s) removed</li>}
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
        Click check to scan for accounts with is_active or is_hidden fields.
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
        Found {totalItemsToFix} budget(s) with legacy active/hidden fields.
      </div>
      {status && (
        <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', opacity: 0.7, fontSize: '0.8rem' }}>
          {status.accountsWithIsHidden > 0 && <li>{status.accountsWithIsHidden} hidden account(s) → will set off-budget</li>}
          {status.accountsWithIsActiveFalse > 0 && <li>{status.accountsWithIsActiveFalse} inactive account(s) → will set off-budget</li>}
          {status.groupsWithIsActive > 0 && <li>{status.groupsWithIsActive} group is_active override(s) → will remove</li>}
        </ul>
      )}
    </div>
  )
}

export function RemoveActiveHiddenFieldsRow({
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
}: RemoveActiveHiddenFieldsRowProps) {
  return (
    <MigrationRow
      name="Remove Active/Hidden Fields"
      description="Removes is_active and is_hidden from accounts/groups, migrating hidden/inactive accounts to off-budget."
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
