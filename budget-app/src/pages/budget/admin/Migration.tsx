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
  useDatabaseCleanup,
  useFeedbackMigration,
  useDeleteAllMonths,
  useDeleteSampleUserBudget,
  usePrecisionCleanup,
  useExpenseToAdjustmentMigration,
  useOrphanedIdCleanup,
  useAdjustmentsToTransfersMigration,
  useAccountCategoryValidation,
  useHiddenFieldMigration,
  useDownloadBudget,
  useUploadBudget,
} from '@hooks'
import { MigrationProgressModal, Spinner } from '../../../components/budget/Admin'
import { OnetimeSection } from '../../../components/budget/Admin/onetime'
import { MaintenanceSection } from '../../../components/budget/Admin/maintenance'
import { UtilitySection } from '../../../components/budget/Admin/utilities'
import { logUserAction } from '@utils/actionLogger'

/** Clear ALL React Query caches and reload */
function handleClearAllCachesAndReload() {
  try { localStorage.removeItem('BUDGET_APP_QUERY_CACHE') } catch { /* ignore */ }
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
  const databaseCleanup = useDatabaseCleanup({ currentUser: current_user })
  const hiddenFieldMigration = useHiddenFieldMigration({ currentUser: current_user })
  const feedbackMigration = useFeedbackMigration({ currentUser: current_user })

  // Maintenance migrations
  const accountCategoryValidation = useAccountCategoryValidation({ currentUser: current_user })
  const orphanedIdCleanup = useOrphanedIdCleanup({ currentUser: current_user })
  const expenseToAdjustment = useExpenseToAdjustmentMigration({ currentUser: current_user })
  const adjustmentsToTransfers = useAdjustmentsToTransfersMigration({ currentUser: current_user })
  const precisionCleanup = usePrecisionCleanup({ currentUser: current_user })

  // Utilities
  const budgetDownload = useDownloadBudget({ currentUser: current_user, budgetId: selectedBudgetId })
  const budgetUpload = useUploadBudget({ currentUser: current_user })
  const deleteAllMonths = useDeleteAllMonths({ currentUser: current_user })
  const deleteSampleUserBudget = useDeleteSampleUserBudget({ currentUser: current_user })

  // =========================================================================
  // AGGREGATE STATE
  // =========================================================================

  const isAnyScanning =
    databaseCleanup.isScanning ||
    hiddenFieldMigration.isScanning ||
    feedbackMigration.isScanning ||
    accountCategoryValidation.isScanning ||
    orphanedIdCleanup.isScanning ||
    expenseToAdjustment.isScanning ||
    adjustmentsToTransfers.isScanning ||
    precisionCleanup.isScanning ||
    deleteAllMonths.isScanning ||
    deleteSampleUserBudget.isScanning

  const isAnyRunning =
    databaseCleanup.isRunning ||
    hiddenFieldMigration.isRunning ||
    feedbackMigration.isMigratingFeedback ||
    orphanedIdCleanup.isRunning ||
    expenseToAdjustment.isRunning ||
    adjustmentsToTransfers.isRunning ||
    precisionCleanup.isRunning ||
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
      // One-time
      databaseCleanup.scanStatus(),
      hiddenFieldMigration.scanStatus(),
      feedbackMigration.scanStatus(),
      // Maintenance
      accountCategoryValidation.scan(),
      orphanedIdCleanup.scanStatus(),
      expenseToAdjustment.scanStatus(),
      adjustmentsToTransfers.scanStatus(),
      precisionCleanup.scan(),
      // Utilities (that have scan)
      deleteAllMonths.scanStatus(),
      deleteSampleUserBudget.scanStatus(),
    ])
  }

  // =========================================================================
  // COMPUTED VALUES FOR FEEDBACK
  // =========================================================================

  const feedbackHasIssues = feedbackMigration.status && (
    feedbackMigration.status.sanitizedDocuments.length > 0 ||
    feedbackMigration.status.corruptedDocuments.length > 0
  )
  const feedbackTotalIssues = feedbackMigration.status
    ? feedbackMigration.status.sanitizedDocuments.length + feedbackMigration.status.corruptedDocuments.length
    : 0

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
            background: '#646cff',
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
        databaseCleanup={{
          status: databaseCleanup.status,
          hasData: !!databaseCleanup.status,
          hasIssues: databaseCleanup.hasIssues,
          totalIssues: databaseCleanup.totalIssues,
          isScanning: databaseCleanup.isScanning,
          isRunning: databaseCleanup.isRunning,
          result: databaseCleanup.result,
          scanStatus: databaseCleanup.scanStatus,
          runCleanup: databaseCleanup.runCleanup,
        }}
        hiddenField={{
          status: hiddenFieldMigration.status,
          hasData: !!hiddenFieldMigration.status,
          needsMigration: hiddenFieldMigration.needsMigration,
          totalItemsToFix: hiddenFieldMigration.totalItemsToFix,
          isScanning: hiddenFieldMigration.isScanning,
          isRunning: hiddenFieldMigration.isRunning,
          result: hiddenFieldMigration.result,
          scanStatus: hiddenFieldMigration.scanStatus,
          runMigration: hiddenFieldMigration.runMigration,
        }}
        feedback={{
          status: feedbackMigration.status,
          hasData: !!feedbackMigration.status,
          hasIssues: !!feedbackHasIssues,
          totalIssues: feedbackTotalIssues,
          isScanning: feedbackMigration.isScanning,
          isMigrating: feedbackMigration.isMigratingFeedback,
          result: feedbackMigration.feedbackMigrationResult,
          scanStatus: feedbackMigration.scanStatus,
          migrateFeedbackDocuments: feedbackMigration.migrateFeedbackDocuments,
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
