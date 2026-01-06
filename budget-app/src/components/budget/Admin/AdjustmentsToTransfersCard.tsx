import type { AdjustmentsToTransfersStatus, AdjustmentsToTransfersResult } from '@hooks/migrations/useAdjustmentsToTransfersMigration'
import { MigrationCard, StatusBox, ActionButton, type MigrationCardStatus } from './MigrationComponents'

interface AdjustmentsToTransfersCardProps {
  hasData: boolean
  status: AdjustmentsToTransfersStatus | null
  hasPairsToConvert: boolean
  isRunning: boolean
  result: AdjustmentsToTransfersResult | null
  onRunMigration: () => void
  onRefresh: () => void
  isRefreshing: boolean
  disabled: boolean
}

export function AdjustmentsToTransfersCard({
  hasData,
  status,
  hasPairsToConvert,
  isRunning,
  result,
  onRunMigration,
  onRefresh,
  isRefreshing,
  disabled,
}: AdjustmentsToTransfersCardProps) {
  const getStatus = (): MigrationCardStatus => {
    if (!hasData) return 'unknown'
    if (result && result.errors.length === 0 && result.transfersCreated > 0) return 'complete'
    if (!hasPairsToConvert) return 'clean'
    return 'needs-action'
  }

  return (
    <MigrationCard
      title="🔄 Adjustments to Transfers"
      description="Finds pairs of adjustments with exact opposite amounts on the same date and converts them to transfers. Only converts valid pairs: account-to-account (both No Category) or category-to-category (both No Account)."
      status={getStatus()}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      isBusy={isRunning}
    >
      {isRunning ? (
        <StatusBox type="running">
          Converting adjustment pairs to transfers...
        </StatusBox>
      ) : result ? (
        <StatusBox type={result.errors.length > 0 ? 'warning' : 'success'}>
          <div>
            {result.errors.length > 0 ? '⚠️' : '✅'} Migration complete
            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
              {result.budgetsProcessed > 0 && (
                <li>{result.budgetsProcessed} budget{result.budgetsProcessed !== 1 ? 's' : ''} scanned</li>
              )}
              {result.monthsProcessed > 0 && (
                <li>{result.monthsProcessed} month{result.monthsProcessed !== 1 ? 's' : ''} updated</li>
              )}
              {result.transfersCreated > 0 && (
                <li>{result.transfersCreated} transfer{result.transfersCreated !== 1 ? 's' : ''} created</li>
              )}
              {result.adjustmentsRemoved > 0 && (
                <li>{result.adjustmentsRemoved} adjustment{result.adjustmentsRemoved !== 1 ? 's' : ''} removed</li>
              )}
              {result.transfersCreated === 0 && <li>No changes needed</li>}
            </ul>
            {result.errors.length > 0 ? (
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
            ) : (
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                💾 Adjustment pairs converted to transfers successfully.
              </p>
            )}
          </div>
        </StatusBox>
      ) : !hasData ? (
        <StatusBox type="unknown">
          ❓ Status unknown — click Refresh to scan the database
        </StatusBox>
      ) : hasPairsToConvert ? (
        <>
          <StatusBox type="warning">
            <div>
              <div style={{ marginBottom: '0.5rem' }}>⚠️ Found {status!.pairsFound} adjustment pair{status!.pairsFound !== 1 ? 's' : ''} to convert:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                {status!.accountTransferPairs > 0 && (
                  <li>{status!.accountTransferPairs} account-to-account transfer{status!.accountTransferPairs !== 1 ? 's' : ''}</li>
                )}
                {status!.categoryTransferPairs > 0 && (
                  <li>{status!.categoryTransferPairs} category-to-category transfer{status!.categoryTransferPairs !== 1 ? 's' : ''}</li>
                )}
              </ul>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
                Scanned {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} and {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''}.
              </p>
            </div>
          </StatusBox>
          <ActionButton
            onClick={onRunMigration}
            disabled={disabled}
            isBusy={isRunning}
            busyText="Converting..."
            actionName="Run Adjustments to Transfers Migration"
          >
            🔄 Convert {status!.pairsFound} Pair{status!.pairsFound !== 1 ? 's' : ''} to Transfer{status!.pairsFound !== 1 ? 's' : ''}
          </ActionButton>
        </>
      ) : (
        <StatusBox type="clean">
          <div>
            ✅ No adjustment pairs found to convert
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              All {status!.totalMonths} month{status!.totalMonths !== 1 ? 's' : ''} across {status!.totalBudgets} budget{status!.totalBudgets !== 1 ? 's' : ''} checked.
            </p>
          </div>
        </StatusBox>
      )}
    </MigrationCard>
  )
}

