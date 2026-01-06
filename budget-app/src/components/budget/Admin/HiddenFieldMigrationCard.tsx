import type { HiddenFieldMigrationStatus, HiddenFieldMigrationResult } from '@hooks/migrations/useHiddenFieldMigration'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface HiddenFieldMigrationCardProps {
  hasData: boolean
  status: HiddenFieldMigrationStatus | null
  needsMigration: boolean
  totalItemsToFix: number
  isRunning: boolean
  result: HiddenFieldMigrationResult | null
  onRunMigration: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function HiddenFieldMigrationCard({
  hasData,
  status,
  needsMigration,
  totalItemsToFix,
  isRunning,
  result,
  onRunMigration,
  onRefresh,
  isRefreshing,
  disabled,
}: HiddenFieldMigrationCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0) return 'complete'
    if (!needsMigration) return 'clean'
    return 'needs-action'
  }

  const totalFixed = result ? (
    result.accountsUpdated +
    result.categoriesUpdated +
    result.hiddenAccountsCreated +
    result.hiddenCategoriesCreated +
    result.adjustmentsFixed
  ) : 0

  return (
    <MigrationCard
      title="🙈 Hidden Field Migration"
      description="Adds is_hidden field to accounts/categories, creates hidden account 'Alerus 401K Eide Bailly' and category 'House', and fixes adjustment transactions missing both account and category."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Running hidden field migration...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Migration complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.accountsUpdated > 0 && (
                <li>{result.accountsUpdated} account{result.accountsUpdated !== 1 ? 's' : ''} got is_hidden field</li>
              )}
              {result.categoriesUpdated > 0 && (
                <li>{result.categoriesUpdated} categor{result.categoriesUpdated !== 1 ? 'ies' : 'y'} got is_hidden field</li>
              )}
              {result.hiddenAccountsCreated > 0 && (
                <li>{result.hiddenAccountsCreated} hidden account{result.hiddenAccountsCreated !== 1 ? 's' : ''} created</li>
              )}
              {result.hiddenCategoriesCreated > 0 && (
                <li>{result.hiddenCategoriesCreated} hidden categor{result.hiddenCategoriesCreated !== 1 ? 'ies' : 'y'} created</li>
              )}
              {result.adjustmentsFixed > 0 && (
                <li>{result.adjustmentsFixed} adjustment{result.adjustmentsFixed !== 1 ? 's' : ''} fixed</li>
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
      ) : needsMigration ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {totalItemsToFix} item{totalItemsToFix !== 1 ? 's' : ''} to migrate:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {status!.accountsNeedingField > 0 && (
                  <li>{status!.accountsNeedingField} account{status!.accountsNeedingField !== 1 ? 's' : ''} need is_hidden field</li>
                )}
                {status!.categoriesNeedingField > 0 && (
                  <li>{status!.categoriesNeedingField} categor{status!.categoriesNeedingField !== 1 ? 'ies' : 'y'} need is_hidden field</li>
                )}
                {status!.adjustmentsToFix > 0 && (
                  <li>{status!.adjustmentsToFix} adjustment{status!.adjustmentsToFix !== 1 ? 's' : ''} with missing account/category</li>
                )}
              </ul>
              {status!.adjustmentDetails.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                  <p style={{ margin: '0 0 0.25rem 0', fontWeight: 500 }}>Adjustments to fix:</p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {status!.adjustmentDetails.slice(0, 3).map((adj, i) => (
                      <li key={i}>
                        [{adj.monthKey}] ${adj.amount.toFixed(2)} - {adj.description || '(no description)'}
                      </li>
                    ))}
                    {status!.adjustmentDetails.length > 3 && (
                      <li style={{ opacity: 0.7 }}>...and {status!.adjustmentDetails.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} and {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''}.
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onRunMigration}
            disabled={disabled}
            isBusy={isRunning}
            busyText="Migrating..."
            actionName="Run Hidden Field Migration"
          >
            🙈 Run Migration ({totalItemsToFix} item{totalItemsToFix !== 1 ? 's' : ''})
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ All accounts and categories have is_hidden field
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              No adjustment transactions with missing account/category found.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

