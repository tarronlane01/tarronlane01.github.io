/**
 * Migration Page
 *
 * Reorganized into three main sections:
 * 1. One-time Migrations - Run once to fix/update schema
 * 2. Maintenance - Re-runnable validation and cleanup scripts
 * 3. Utilities - Downloads, deletions, cache management
 *
 * Architecture:
 * - Each section is in its own folder with a file per migration
 * - Common components enforce consistent behavior
 * - Backup prompts are baked into the architecture
 */

import { useFirebaseAuth } from '@hooks'
import { useBudget } from '@contexts'
import {
  useDeleteAllMonths,
  useDeleteSampleUserBudget,
  usePrecisionCleanup,
  useExpenseToAdjustmentMigration,
  useOrphanedIdCleanup,
  useAdjustmentsToTransfersMigration,
  useAccountCategoryValidation,
  useRemoveTotalFieldsMigration,
  useRemovePreviousMonthIncomeMigration,
  usePercentageIncomeMonthsBackMigration,
  useRecalculateStartBalancesMigration,
  useRepairMonthMapMigration,
  useDownloadBudget,
  useUploadBudget,
} from '@hooks'
import { MigrationProgressModal, Spinner } from '../../../components/budget/Admin'
import { OnetimeSection } from '../../../components/budget/Admin/onetime'
import { MaintenanceSection } from '../../../components/budget/Admin/maintenance'
import { UtilitySection } from '../../../components/budget/Admin/utilities'
import { logUserAction } from '@utils/actionLogger'
import { queryClient } from '@data/queryClient'

/** Clear ALL React Query caches and reload */
function handleClearAllCachesAndReload() {
  queryClient.clear()
  window.location.reload()
}

function Migration() {
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()
  const { selectedBudgetId } = useBudget()

  // =========================================================================
  // MIGRATION HOOKS
  // =========================================================================

  // One-time migrations
  const removeTotalFieldsMigration = useRemoveTotalFieldsMigration({ currentUser: current_user })
  const removePreviousMonthIncomeMigration = useRemovePreviousMonthIncomeMigration({ currentUser: current_user })
  const percentageIncomeMonthsBackMigration = usePercentageIncomeMonthsBackMigration({ currentUser: current_user })

  // Maintenance migrations
  const accountCategoryValidation = useAccountCategoryValidation({ currentUser: current_user })
  const orphanedIdCleanup = useOrphanedIdCleanup({ currentUser: current_user })
  const expenseToAdjustment = useExpenseToAdjustmentMigration({ currentUser: current_user })
  const adjustmentsToTransfers = useAdjustmentsToTransfersMigration({ currentUser: current_user })
  const precisionCleanup = usePrecisionCleanup({ currentUser: current_user })
  const recalculateStartBalances = useRecalculateStartBalancesMigration({ currentUser: current_user })
  const repairMonthMap = useRepairMonthMapMigration({ currentUser: current_user })

  // Utilities
  const budgetDownload = useDownloadBudget({ currentUser: current_user, budgetId: selectedBudgetId })
  const budgetUpload = useUploadBudget({ currentUser: current_user })
  const deleteAllMonths = useDeleteAllMonths({ currentUser: current_user })
  const deleteSampleUserBudget = useDeleteSampleUserBudget({ currentUser: current_user })

  // =========================================================================
  // AGGREGATE STATE
  // =========================================================================

  const isAnyScanning =
    // One-time migrations
    removeTotalFieldsMigration.isScanning ||
    removePreviousMonthIncomeMigration.isScanning ||
    percentageIncomeMonthsBackMigration.isScanning ||
    // Maintenance migrations
    accountCategoryValidation.isScanning ||
    orphanedIdCleanup.isScanning ||
    expenseToAdjustment.isScanning ||
    adjustmentsToTransfers.isScanning ||
    precisionCleanup.isScanning ||
    recalculateStartBalances.isScanning ||
    repairMonthMap.isScanning ||
    deleteAllMonths.isScanning ||
    deleteSampleUserBudget.isScanning

  const isAnyRunning =
    // One-time migrations
    removeTotalFieldsMigration.isRunning ||
    removePreviousMonthIncomeMigration.isRunning ||
    percentageIncomeMonthsBackMigration.isRunning ||
    // Maintenance migrations
    orphanedIdCleanup.isRunning ||
    expenseToAdjustment.isRunning ||
    adjustmentsToTransfers.isRunning ||
    precisionCleanup.isRunning ||
    recalculateStartBalances.isRunning ||
    repairMonthMap.isRunning ||
    deleteAllMonths.isDeleting ||
    deleteSampleUserBudget.isDeleting ||
    budgetDownload.isDownloading ||
    budgetUpload.isUploading

  // =========================================================================
  // REFRESH ALL
  // =========================================================================

  const handleRefreshAll = async () => {
    logUserAction('CLICK', 'Refresh All Migrations')
    await Promise.all([
      // One-time migrations
      removeTotalFieldsMigration.scanStatus(),
      removePreviousMonthIncomeMigration.scanStatus(),
      percentageIncomeMonthsBackMigration.scanStatus(),
      // Maintenance migrations
      accountCategoryValidation.scan(),
      orphanedIdCleanup.scanStatus(),
      expenseToAdjustment.scanStatus(),
      adjustmentsToTransfers.scanStatus(),
      precisionCleanup.scan(),
      recalculateStartBalances.scanStatus(),
      repairMonthMap.scanStatus(),
      // Utilities (that have scan)
      deleteAllMonths.scanStatus(),
      deleteSampleUserBudget.scanStatus(),
    ])
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Data Migrations</h2>
        <button
          onClick={handleRefreshAll}
          disabled={isAnyScanning || isAnyRunning}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: isAnyScanning || isAnyRunning ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isAnyScanning || isAnyRunning ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            minWidth: '130px',
            minHeight: '36px',
          }}
        >
          <span style={{ width: '18px', height: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
            {isAnyScanning ? <Spinner noMargin /> : '🔄'}
          </span>
          Refresh All
        </button>
      </div>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Run migrations to validate and fix your database. Click "Refresh All" to scan Firestore directly.
      </p>

      {/* One-time Migrations Section */}
      <OnetimeSection
        disabled={!current_user}
        onDownloadBackup={budgetDownload.downloadBudget}
        isDownloadingBackup={budgetDownload.isDownloading}
        removeTotalFieldsMigration={{
          status: removeTotalFieldsMigration.status,
          hasData: !!removeTotalFieldsMigration.status,
          needsMigration: removeTotalFieldsMigration.needsMigration,
          totalItemsToFix: removeTotalFieldsMigration.totalItemsToFix,
          isScanning: removeTotalFieldsMigration.isScanning,
          isRunning: removeTotalFieldsMigration.isRunning,
          result: removeTotalFieldsMigration.result,
          scanStatus: removeTotalFieldsMigration.scanStatus,
          runMigration: removeTotalFieldsMigration.runMigration,
        }}
        removePreviousMonthIncomeMigration={{
          status: removePreviousMonthIncomeMigration.status,
          hasData: !!removePreviousMonthIncomeMigration.status,
          needsMigration: removePreviousMonthIncomeMigration.needsMigration,
          totalItemsToFix: removePreviousMonthIncomeMigration.totalItemsToFix,
          isScanning: removePreviousMonthIncomeMigration.isScanning,
          isRunning: removePreviousMonthIncomeMigration.isRunning,
          result: removePreviousMonthIncomeMigration.result,
          scanStatus: removePreviousMonthIncomeMigration.scanStatus,
          runMigration: removePreviousMonthIncomeMigration.runMigration,
        }}
        percentageIncomeMonthsBackMigration={{
          status: percentageIncomeMonthsBackMigration.status,
          hasData: !!percentageIncomeMonthsBackMigration.status,
          needsMigration: percentageIncomeMonthsBackMigration.needsMigration,
          totalItemsToFix: percentageIncomeMonthsBackMigration.totalItemsToFix,
          isScanning: percentageIncomeMonthsBackMigration.isScanning,
          isRunning: percentageIncomeMonthsBackMigration.isRunning,
          result: percentageIncomeMonthsBackMigration.result,
          scanStatus: percentageIncomeMonthsBackMigration.scanStatus,
          runMigration: percentageIncomeMonthsBackMigration.runMigration,
        }}
      />

      {/* Maintenance Section */}
      <MaintenanceSection
        disabled={!current_user}
        onDownloadBackup={budgetDownload.downloadBudget}
        isDownloadingBackup={budgetDownload.isDownloading}
        accountCategoryValidation={{
          status: accountCategoryValidation.status,
          hasData: !!accountCategoryValidation.status,
          hasViolations: accountCategoryValidation.hasViolations,
          violationCount: accountCategoryValidation.violationCount,
          isScanning: accountCategoryValidation.isScanning,
          report: accountCategoryValidation.report,
          scan: accountCategoryValidation.scan,
        }}
        orphanedIdCleanup={{
          status: orphanedIdCleanup.status,
          hasData: !!orphanedIdCleanup.status,
          hasItemsToFix: orphanedIdCleanup.hasItemsToFix,
          totalOrphaned: orphanedIdCleanup.status
            ? orphanedIdCleanup.status.orphanedCategoryIds + orphanedIdCleanup.status.orphanedAccountIds
            : 0,
          isScanning: orphanedIdCleanup.isScanning,
          isRunning: orphanedIdCleanup.isRunning,
          result: orphanedIdCleanup.result,
          scanStatus: orphanedIdCleanup.scanStatus,
          runMigration: orphanedIdCleanup.runMigration,
        }}
        expenseToAdjustment={{
          status: expenseToAdjustment.status,
          hasData: !!expenseToAdjustment.status,
          hasItemsToMigrate: expenseToAdjustment.hasItemsToMigrate,
          totalToMigrate: expenseToAdjustment.status?.expensesToMigrate ?? 0,
          isScanning: expenseToAdjustment.isScanning,
          isRunning: expenseToAdjustment.isRunning,
          result: expenseToAdjustment.result,
          scanStatus: expenseToAdjustment.scanStatus,
          runMigration: expenseToAdjustment.runMigration,
        }}
        adjustmentsToTransfers={{
          status: adjustmentsToTransfers.status,
          hasData: !!adjustmentsToTransfers.status,
          hasPairsToConvert: adjustmentsToTransfers.hasPairsToConvert,
          totalPairs: adjustmentsToTransfers.status?.pairsFound ?? 0,
          isScanning: adjustmentsToTransfers.isScanning,
          isRunning: adjustmentsToTransfers.isRunning,
          result: adjustmentsToTransfers.result,
          scanStatus: adjustmentsToTransfers.scanStatus,
          runMigration: adjustmentsToTransfers.runMigration,
        }}
        precisionCleanup={{
          status: precisionCleanup.status,
          hasData: precisionCleanup.hasData,
          hasIssues: precisionCleanup.hasIssues,
          totalIssues: precisionCleanup.totalIssues,
          isScanning: precisionCleanup.isScanning,
          isRunning: precisionCleanup.isRunning,
          result: precisionCleanup.result,
          scan: precisionCleanup.scan,
          runCleanup: precisionCleanup.runCleanup,
        }}
        recalculateStartBalances={{
          status: recalculateStartBalances.status,
          hasData: !!recalculateStartBalances.status,
          needsMigration: recalculateStartBalances.needsMigration,
          totalItemsToFix: recalculateStartBalances.totalItemsToFix,
          isScanning: recalculateStartBalances.isScanning,
          isRunning: recalculateStartBalances.isRunning,
          result: recalculateStartBalances.result,
          scanStatus: recalculateStartBalances.scanStatus,
          runMigration: recalculateStartBalances.runMigration,
        }}
        repairMonthMap={{
          status: repairMonthMap.status,
          hasData: !!repairMonthMap.status,
          needsMigration: repairMonthMap.needsMigration,
          totalItemsToFix: repairMonthMap.totalItemsToFix,
          isScanning: repairMonthMap.isScanning,
          isRunning: repairMonthMap.isRunning,
          result: repairMonthMap.result,
          scanStatus: repairMonthMap.scanStatus,
          runMigration: repairMonthMap.runMigration,
        }}
      />

      {/* Utilities Section */}
      <UtilitySection
        disabled={!current_user}
        onDownloadBackup={budgetDownload.downloadBudget}
        isDownloadingBackup={budgetDownload.isDownloading}
        budgetDownloadUpload={{
          isDownloading: budgetDownload.isDownloading,
          downloadProgress: budgetDownload.progress,
          downloadError: budgetDownload.error,
          downloadBudget: budgetDownload.downloadBudget,
          isScanning: budgetUpload.isScanning,
          isUploading: budgetUpload.isUploading,
          uploadStatus: budgetUpload.status,
          uploadProgress: budgetUpload.progress,
          uploadError: budgetUpload.error,
          uploadResult: budgetUpload.result,
          scanZipFile: budgetUpload.scanZipFile,
          uploadBudget: budgetUpload.uploadBudget,
        }}
        deleteAllMonths={{
          status: deleteAllMonths.status,
          hasData: !!deleteAllMonths.status,
          monthsCount: deleteAllMonths.status?.monthsCount ?? 0,
          budgetCount: deleteAllMonths.status?.budgetCount ?? 0,
          isScanning: deleteAllMonths.isScanning,
          isDeleting: deleteAllMonths.isDeleting,
          deleteResult: deleteAllMonths.deleteResult,
          deleteProgress: deleteAllMonths.deleteProgress,
          scanStatus: deleteAllMonths.scanStatus,
          deleteAllMonths: deleteAllMonths.deleteAllMonths,
        }}
        deleteSampleUserBudget={{
          status: deleteSampleUserBudget.status,
          hasData: !!deleteSampleUserBudget.status,
          totalBudgets: deleteSampleUserBudget.status?.totalBudgets ?? 0,
          totalMonths: deleteSampleUserBudget.status?.totalMonths ?? 0,
          isScanning: deleteSampleUserBudget.isScanning,
          isDeleting: deleteSampleUserBudget.isDeleting,
          deleteResult: deleteSampleUserBudget.deleteResult,
          deleteProgress: deleteSampleUserBudget.deleteProgress,
          scanStatus: deleteSampleUserBudget.scanStatus,
          deleteSampleUserBudget: deleteSampleUserBudget.deleteSampleUserBudget,
        }}
        onClearCache={handleClearAllCachesAndReload}
      />

      {/* Info Note */}
      <div style={{ background: 'color-mix(in srgb, currentColor 3%, transparent)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> These migrations will process <strong>all budgets and months</strong> in the system, not just the ones you own or are invited to.
        </p>
      </div>

      {/* Migration Progress Modal (auto-shown during migrations) */}
      <MigrationProgressModal />
    </div>
  )
}

export default Migration
