/**
 * Repair Month Map Row
 *
 * Maintenance migration to update and repair month_map for all budgets.
 */

import type { RepairMonthMapMigrationStatus, RepairMonthMapMigrationResult } from '@hooks/migrations/useRepairMonthMapMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface RepairMonthMapRowProps {
  status: RepairMonthMapMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: RepairMonthMapMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function RepairMonthMapRow({
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
}: RepairMonthMapRowProps) {
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
      const totalFixed = result.monthsAdded + result.orphanedEntriesRemoved
      return totalFixed > 0 ? `Fixed ${totalFixed} issue(s)` : 'Complete'
    }
    return undefined
  }

  const renderDetails = () => {
    if (result) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Repair complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
            {result.budgetsUpdated > 0 && <li>{result.budgetsUpdated} budget(s) updated</li>}
            {result.monthsAdded > 0 && <li>{result.monthsAdded} month(s) added to month_map</li>}
            {result.orphanedEntriesRemoved > 0 && <li>{result.orphanedEntriesRemoved} orphaned entry(ies) removed</li>}
            {result.monthsAdded === 0 && result.orphanedEntriesRemoved === 0 && <li>No changes needed</li>}
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
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for month_map issues.</div>
    }

    if (!needsMigration) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All month_map entries are up to date.
          <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
            Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>Month_map issues found:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {status!.totalMissingMonths > 0 && (
            <li>{status!.totalMissingMonths} month(s) missing from month_map</li>
          )}
          {status!.totalOrphanedEntries > 0 && (
            <li>{status!.totalOrphanedEntries} orphaned entry(ies) in month_map</li>
          )}
          {status!.budgetsNeedingRepair > 0 && (
            <li>{status!.budgetsNeedingRepair} budget(s) need repair</li>
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
      name="Repair Month Map"
      description="Updates month_map for all budgets by adding missing months and removing orphaned entries"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={needsMigration ? `Repair ${totalItemsToFix}` : undefined}
      disabled={disabled}
      itemCount={needsMigration ? totalItemsToFix : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}
