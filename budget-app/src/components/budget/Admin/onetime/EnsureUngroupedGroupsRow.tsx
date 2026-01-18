/**
 * Ensure Ungrouped Groups Migration Row
 *
 * Ensures all budgets have the default ungrouped groups for accounts and categories.
 */

import type { EnsureUngroupedGroupsStatus, EnsureUngroupedGroupsResult } from '@hooks/migrations/useEnsureUngroupedGroups'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface EnsureUngroupedGroupsRowProps {
  status: EnsureUngroupedGroupsStatus | null
  hasData: boolean
  needsMigration: boolean
  totalBudgetsToUpdate: number
  isChecking: boolean
  isRunning: boolean
  result: EnsureUngroupedGroupsResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function EnsureUngroupedGroupsRow({
  status,
  hasData,
  needsMigration,
  totalBudgetsToUpdate,
  isChecking,
  isRunning,
  result,
  onCheck,
  onRun,
  disabled,
}: EnsureUngroupedGroupsRowProps) {
  const getStatus = (): MigrationRowStatus => {
    if (isRunning) return 'running'
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (result && result.errors.length > 0) return 'error'
    if (!needsMigration) return 'clean'
    return 'needs-action'
  }

    const getStatusText = (): string | undefined => {
      if (result && result.errors.length === 0 && result.budgetsUpdated > 0) {
        return `Updated ${result.budgetsUpdated} budget(s)`
      }
      if (result && result.budgetsUpdated === 0) {
        return 'Complete (all budgets already have ungrouped groups)'
      }
      return undefined
    }

  const renderDetails = () => {
    if (result) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Migration complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) processed</li>}
            {result.budgetsUpdated > 0 && <li>{result.budgetsUpdated} budget(s) had ungrouped groups added</li>}
            {result.budgetsUpdated === 0 && <li>All budgets already have ungrouped groups</li>}
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
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for budgets missing ungrouped groups.</div>
    }

    if (!needsMigration) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All budgets have ungrouped groups.
          <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
            Scanned {status!.totalBudgets} budget(s).
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: '#fbbf24' }}>Budgets to update:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          <li>{status!.budgetsNeedingUpdate} budget(s) missing ungrouped groups</li>
        </ul>
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budget(s).
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Ensure Ungrouped Groups"
      description="Ensures all budgets have the default ungrouped groups for accounts and categories. This prevents errors when accounts or categories don't have a group assigned."
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={`Update ${totalBudgetsToUpdate} budget(s)`}
      disabled={disabled}
      itemCount={needsMigration ? totalBudgetsToUpdate : undefined}
      details={renderDetails()}
      isDestructive={false}
    />
  )
}

