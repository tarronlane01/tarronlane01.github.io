/**
 * Maintenance Section
 *
 * Contains re-runnable database validation scripts.
 * Includes a "Validate All" button to check all at once.
 */

import { MigrationSection } from '../common'
import { TransactionTypeAuditRow } from './TransactionTypeAuditRow'
import { CurrencyPrecisionRow } from './CurrencyPrecisionRow'
import { BackupPrompt, useBackupPrompt } from '../common'

// Import types
import type { ValidationStatus } from '@hooks/migrations/useAccountCategoryValidation'
import type { OrphanedIdCleanupStatus, OrphanedIdCleanupResult } from '@hooks/migrations/useOrphanedIdCleanup'
import type { ExpenseToAdjustmentStatus, ExpenseToAdjustmentResult } from '@hooks/migrations/useExpenseToAdjustmentMigration'
import type { AdjustmentsToTransfersStatus, AdjustmentsToTransfersResult } from '@hooks/migrations/useAdjustmentsToTransfersMigration'
import type { PrecisionCleanupStatus, PrecisionCleanupResult } from '@hooks/migrations/usePrecisionCleanup'

interface MaintenanceSectionProps {
  disabled: boolean
  onDownloadBackup: () => Promise<void>
  isDownloadingBackup: boolean

  // Account/Category Validation
  accountCategoryValidation: {
    status: ValidationStatus | null
    hasData: boolean
    hasViolations: boolean
    violationCount: number
    isScanning: boolean
    report: string | null
    scan: (seedCsvContent?: string) => void
  }

  // Orphaned ID Cleanup
  orphanedIdCleanup: {
    status: OrphanedIdCleanupStatus | null
    hasData: boolean
    hasItemsToFix: boolean
    totalOrphaned: number
    isScanning: boolean
    isRunning: boolean
    result: OrphanedIdCleanupResult | null
    scanStatus: () => void
    runMigration: () => void
  }

  // Expense to Adjustment
  expenseToAdjustment: {
    status: ExpenseToAdjustmentStatus | null
    hasData: boolean
    hasItemsToMigrate: boolean
    totalToMigrate: number
    isScanning: boolean
    isRunning: boolean
    result: ExpenseToAdjustmentResult | null
    scanStatus: () => void
    runMigration: () => void
  }

  // Adjustments to Transfers
  adjustmentsToTransfers: {
    status: AdjustmentsToTransfersStatus | null
    hasData: boolean
    hasPairsToConvert: boolean
    totalPairs: number
    isScanning: boolean
    isRunning: boolean
    result: AdjustmentsToTransfersResult | null
    scanStatus: () => void
    runMigration: () => void
  }

  // Currency Precision
  precisionCleanup: {
    status: PrecisionCleanupStatus | null
    hasData: boolean
    hasIssues: boolean
    totalIssues: number
    isScanning: boolean
    isRunning: boolean
    result: PrecisionCleanupResult | null
    scan: () => void
    runCleanup: () => void
  }
}

export function MaintenanceSection({
  disabled,
  onDownloadBackup,
  isDownloadingBackup,
  accountCategoryValidation,
  orphanedIdCleanup,
  expenseToAdjustment,
  adjustmentsToTransfers,
  precisionCleanup,
}: MaintenanceSectionProps) {
  const isAnyScanning =
    accountCategoryValidation.isScanning ||
    orphanedIdCleanup.isScanning ||
    expenseToAdjustment.isScanning ||
    adjustmentsToTransfers.isScanning ||
    precisionCleanup.isScanning

  const isAnyRunning =
    orphanedIdCleanup.isRunning ||
    expenseToAdjustment.isRunning ||
    adjustmentsToTransfers.isRunning ||
    precisionCleanup.isRunning

  // Validate all maintenance checks at once
  const handleValidateAll = async () => {
    await Promise.all([
      accountCategoryValidation.scan(),
      orphanedIdCleanup.scanStatus(),
      expenseToAdjustment.scanStatus(),
      adjustmentsToTransfers.scanStatus(),
      precisionCleanup.scan(),
    ])
  }

  // Backup prompts for transaction audit fixes
  const orphanedBackup = useBackupPrompt({
    migrationName: 'Orphaned ID Cleanup',
    isDestructive: true,
    onDownloadBackup,
  })

  const expenseBackup = useBackupPrompt({
    migrationName: 'Expense to Adjustment Migration',
    isDestructive: true,
    onDownloadBackup,
  })

  const transfersBackup = useBackupPrompt({
    migrationName: 'Adjustments to Transfers Migration',
    isDestructive: true,
    onDownloadBackup,
  })

  const precisionBackup = useBackupPrompt({
    migrationName: 'Currency Precision Cleanup',
    isDestructive: true,
    onDownloadBackup,
  })

  // Determine overall transaction audit status
  const transactionAuditNeedsAction =
    accountCategoryValidation.hasViolations ||
    orphanedIdCleanup.hasItemsToFix ||
    expenseToAdjustment.hasItemsToMigrate ||
    adjustmentsToTransfers.hasPairsToConvert

  const transactionAuditTotalIssues =
    (accountCategoryValidation.violationCount || 0) +
    (orphanedIdCleanup.totalOrphaned || 0) +
    (expenseToAdjustment.totalToMigrate || 0) +
    (adjustmentsToTransfers.totalPairs || 0)

  return (
    <>
      <MigrationSection
        title="Maintenance"
        icon="🔧"
        description="Re-runnable database validation scripts. Validate all to see which need resolution."
        type="maintenance"
        onValidateAll={handleValidateAll}
        isValidating={isAnyScanning}
        isAnyRunning={isAnyRunning}
      >
        <TransactionTypeAuditRow
          accountCategoryValidation={accountCategoryValidation}
          orphanedIdCleanup={orphanedIdCleanup}
          expenseToAdjustment={expenseToAdjustment}
          adjustmentsToTransfers={adjustmentsToTransfers}
          needsAction={transactionAuditNeedsAction}
          totalIssues={transactionAuditTotalIssues}
          isScanning={
            accountCategoryValidation.isScanning ||
            orphanedIdCleanup.isScanning ||
            expenseToAdjustment.isScanning ||
            adjustmentsToTransfers.isScanning
          }
          isRunning={
            orphanedIdCleanup.isRunning ||
            expenseToAdjustment.isRunning ||
            adjustmentsToTransfers.isRunning
          }
          disabled={disabled}
          onRunOrphaned={() => orphanedBackup.promptBeforeAction(orphanedIdCleanup.runMigration)}
          onRunExpense={() => expenseBackup.promptBeforeAction(expenseToAdjustment.runMigration)}
          onRunTransfers={() => transfersBackup.promptBeforeAction(adjustmentsToTransfers.runMigration)}
        />

        <CurrencyPrecisionRow
          status={precisionCleanup.status}
          hasData={precisionCleanup.hasData}
          hasIssues={precisionCleanup.hasIssues}
          totalIssues={precisionCleanup.totalIssues}
          isChecking={precisionCleanup.isScanning}
          isRunning={precisionCleanup.isRunning}
          result={precisionCleanup.result}
          onCheck={precisionCleanup.scan}
          onRun={() => precisionBackup.promptBeforeAction(precisionCleanup.runCleanup)}
          disabled={disabled}
        />
      </MigrationSection>

      {/* Backup Prompts */}
      <BackupPrompt {...orphanedBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...expenseBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...transfersBackup.promptProps} isDownloading={isDownloadingBackup} />
      <BackupPrompt {...precisionBackup.promptProps} isDownloading={isDownloadingBackup} />
    </>
  )
}

