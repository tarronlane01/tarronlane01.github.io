/**
 * Hidden Field Migration Row
 *
 * Compact row for adding is_hidden field to accounts/categories.
 */

import type { HiddenFieldMigrationStatus, HiddenFieldMigrationResult } from '@hooks/migrations/useHiddenFieldMigration'
import { MigrationRow, type MigrationRowStatus } from '../common'

interface HiddenFieldRowProps {
  status: HiddenFieldMigrationStatus | null
  hasData: boolean
  needsMigration: boolean
  totalItemsToFix: number
  isChecking: boolean
  isRunning: boolean
  result: HiddenFieldMigrationResult | null
  onCheck: () => void
  onRun: () => void
  disabled: boolean
}

export function HiddenFieldRow({
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
}: HiddenFieldRowProps) {
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
      const totalFixed = (
        result.accountsUpdated +
        result.categoriesUpdated +
        result.hiddenAccountsCreated +
        result.hiddenCategoriesCreated +
        result.adjustmentsFixed
      )
      return totalFixed > 0 ? `Fixed ${totalFixed}` : 'Complete'
    }
    return undefined
  }

  const renderDetails = () => {
    if (result) {
      const totalFixed = (
        result.accountsUpdated +
        result.categoriesUpdated +
        result.hiddenAccountsCreated +
        result.hiddenCategoriesCreated +
        result.adjustmentsFixed
      )

      return (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
            {result.errors.length > 0 ? '⚠️ Completed with errors' : '✅ Migration complete'}
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {result.budgetsProcessed > 0 && <li>{result.budgetsProcessed} budget(s) updated</li>}
            {result.accountsUpdated > 0 && <li>{result.accountsUpdated} account(s) got is_hidden field</li>}
            {result.categoriesUpdated > 0 && <li>{result.categoriesUpdated} categor(ies) got is_hidden field</li>}
            {result.hiddenAccountsCreated > 0 && <li>{result.hiddenAccountsCreated} hidden account(s) created</li>}
            {result.hiddenCategoriesCreated > 0 && <li>{result.hiddenCategoriesCreated} hidden categor(ies) created</li>}
            {result.adjustmentsFixed > 0 && <li>{result.adjustmentsFixed} adjustment(s) fixed</li>}
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
      return <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Click check to scan for items needing is_hidden field.</div>
    }

    if (!needsMigration) {
      return (
        <div style={{ fontSize: '0.85rem' }}>
          ✅ All accounts and categories have is_hidden field. No adjustments with missing account/category.
          <div style={{ marginTop: '0.25rem', opacity: 0.6 }}>
            Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ marginBottom: '0.5rem', color: 'var(--color-warning)' }}>Items to migrate:</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {status!.accountsNeedingField > 0 && <li>{status!.accountsNeedingField} account(s) need is_hidden field</li>}
          {status!.categoriesNeedingField > 0 && <li>{status!.categoriesNeedingField} categor(ies) need is_hidden field</li>}
          {status!.adjustmentsToFix > 0 && <li>{status!.adjustmentsToFix} adjustment(s) with missing account/category</li>}
        </ul>
        {status!.adjustmentDetails.length > 0 && (
          <div style={{ marginTop: '0.5rem', opacity: 0.8 }}>
            <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>Adjustments to fix:</div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {status!.adjustmentDetails.slice(0, 3).map((adj, i) => (
                <li key={i}>[{adj.monthKey}] ${adj.amount.toFixed(2)} - {adj.description || '(no description)'}</li>
              ))}
              {status!.adjustmentDetails.length > 3 && (
                <li style={{ opacity: 0.7 }}>...and {status!.adjustmentDetails.length - 3} more</li>
              )}
            </ul>
          </div>
        )}
        <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
          Scanned {status!.totalBudgets} budget(s) and {status!.totalMonths} month(s).
        </div>
      </div>
    )
  }

  return (
    <MigrationRow
      name="Hidden Field Migration"
      description="Adds is_hidden field to accounts/categories and fixes missing references"
      status={getStatus()}
      statusText={getStatusText()}
      onCheck={onCheck}
      isChecking={isChecking}
      onRun={onRun}
      isRunning={isRunning}
      actionText={`Fix ${totalItemsToFix}`}
      disabled={disabled}
      itemCount={needsMigration ? totalItemsToFix : undefined}
      details={renderDetails()}
      isDestructive
    />
  )
}

