import { useState } from 'react'
import { useFirebaseAuth } from '@hooks'
import { useDatabaseCleanup, useFeedbackMigration, useDeleteAllMonths, usePrecisionCleanup, useExpenseToAdjustmentMigration, useOrphanedIdCleanup, useAdjustmentsToTransfersMigration, useAccountCategoryValidation, useHiddenFieldMigration, useDiagnosticDownload } from '@hooks'
import { useRestoreFromDiagnostic } from '../../../hooks/migrations/useRestoreFromDiagnostic'
import {
  Spinner,
  DatabaseCleanupCard,
  FeedbackMigrationCard,
  DeleteAllMonthsCard,
  SeedImportCard,
  PrecisionCleanupCard,
  ExpenseToAdjustmentCard,
  OrphanedIdCleanupCard,
  AdjustmentsToTransfersCard,
  AccountCategoryValidationCard,
  HiddenFieldMigrationCard,
  RestoreFromDiagnosticCard,
} from '../../../components/budget/Admin'
import { Modal, Button } from '../../../components/ui'
import { logUserAction } from '@utils/actionLogger'

/** Clear ALL React Query caches and reload. Clears localStorage FIRST to avoid race condition with persister. */
function handleClearAllCachesAndReload() {
  try { localStorage.removeItem('BUDGET_APP_QUERY_CACHE') } catch { /* ignore */ }
  window.location.reload()
}

function Migration() {
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()
  const [showReloadModal, setShowReloadModal] = useState(false)

  // Database cleanup - consolidated migration for budget/month schema validation
  const databaseCleanup = useDatabaseCleanup({
    currentUser: current_user,
  })

  // Feedback migration - special case for email document IDs
  const feedbackMigration = useFeedbackMigration({
    currentUser: current_user,
  })

  // Delete all months - destructive utility
  // Automatically recalculates budgets and clears cache after deletion
  const deleteAllMonths = useDeleteAllMonths({
    currentUser: current_user,
  })

  // Precision cleanup - fixes floating point rounding issues
  const precisionCleanup = usePrecisionCleanup({
    currentUser: current_user,
  })

  // Orphaned ID cleanup - fixes references to deleted categories/accounts
  const orphanedIdCleanup = useOrphanedIdCleanup({
    currentUser: current_user,
  })

  // Expense to adjustment migration - moves no-account/no-category expenses
  const expenseToAdjustment = useExpenseToAdjustmentMigration({
    currentUser: current_user,
  })

  // Adjustments to transfers migration - converts matching adjustment pairs to transfers
  const adjustmentsToTransfers = useAdjustmentsToTransfersMigration({
    currentUser: current_user,
  })

  // Account/category validation - scans for invalid account/category combinations
  const accountCategoryValidation = useAccountCategoryValidation({
    currentUser: current_user,
  })

  // Hidden field migration - adds is_hidden field and creates hidden accounts/categories
  const hiddenFieldMigration = useHiddenFieldMigration({
    currentUser: current_user,
  })

  // Diagnostic download - downloads all data for troubleshooting
  const diagnosticDownload = useDiagnosticDownload({
    currentUser: current_user,
  })

  // Restore from diagnostic - restores transfers/adjustments from diagnostic file
  const restoreFromDiagnostic = useRestoreFromDiagnostic()

  // Scanning state for all
  const isAnyScanning = databaseCleanup.isScanning || feedbackMigration.isScanning || deleteAllMonths.isScanning || precisionCleanup.isScanning || expenseToAdjustment.isScanning || orphanedIdCleanup.isScanning || adjustmentsToTransfers.isScanning || hiddenFieldMigration.isScanning
  const isAnyRunning = databaseCleanup.isRunning || feedbackMigration.isMigratingFeedback || deleteAllMonths.isDeleting || precisionCleanup.isRunning || expenseToAdjustment.isRunning || orphanedIdCleanup.isRunning || adjustmentsToTransfers.isRunning || hiddenFieldMigration.isRunning

  // Refresh all - scans all migration statuses
  const handleRefreshAll = async () => {
    logUserAction('CLICK', 'Refresh All Migrations')
    await Promise.all([
      databaseCleanup.scanStatus(),
      feedbackMigration.scanStatus(),
      deleteAllMonths.scanStatus(),
      precisionCleanup.scan(),
      orphanedIdCleanup.scanStatus(),
      expenseToAdjustment.scanStatus(),
      adjustmentsToTransfers.scanStatus(),
      hiddenFieldMigration.scanStatus(),
    ])
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

      <AccountCategoryValidationCard
        hasData={!!accountCategoryValidation.status}
        status={accountCategoryValidation.status}
        report={accountCategoryValidation.report}
        hasViolations={accountCategoryValidation.hasViolations}
        violationCount={accountCategoryValidation.violationCount}
        isScanning={accountCategoryValidation.isScanning}
        onScan={accountCategoryValidation.scan}
        disabled={!current_user}
      />

      <HiddenFieldMigrationCard
        hasData={!!hiddenFieldMigration.status}
        status={hiddenFieldMigration.status}
        needsMigration={hiddenFieldMigration.needsMigration}
        totalItemsToFix={hiddenFieldMigration.totalItemsToFix}
        isRunning={hiddenFieldMigration.isRunning}
        result={hiddenFieldMigration.result}
        onRunMigration={hiddenFieldMigration.runMigration}
        onRefresh={hiddenFieldMigration.scanStatus}
        isRefreshing={hiddenFieldMigration.isScanning}
        disabled={!current_user}
      />

      <OrphanedIdCleanupCard
        hasData={!!orphanedIdCleanup.status}
        status={orphanedIdCleanup.status}
        hasItemsToFix={orphanedIdCleanup.hasItemsToFix}
        isRunning={orphanedIdCleanup.isRunning}
        result={orphanedIdCleanup.result}
        onRunMigration={orphanedIdCleanup.runMigration}
        onRefresh={orphanedIdCleanup.scanStatus}
        isRefreshing={orphanedIdCleanup.isScanning}
        disabled={!current_user}
      />

      <ExpenseToAdjustmentCard
        hasData={!!expenseToAdjustment.status}
        status={expenseToAdjustment.status}
        hasItemsToMigrate={expenseToAdjustment.hasItemsToMigrate}
        isRunning={expenseToAdjustment.isRunning}
        result={expenseToAdjustment.result}
        onRunMigration={expenseToAdjustment.runMigration}
        onRefresh={expenseToAdjustment.scanStatus}
        isRefreshing={expenseToAdjustment.isScanning}
        disabled={!current_user}
      />

      <AdjustmentsToTransfersCard
        hasData={!!adjustmentsToTransfers.status}
        status={adjustmentsToTransfers.status}
        hasPairsToConvert={adjustmentsToTransfers.hasPairsToConvert}
        isRunning={adjustmentsToTransfers.isRunning}
        result={adjustmentsToTransfers.result}
        onRunMigration={adjustmentsToTransfers.runMigration}
        onRefresh={adjustmentsToTransfers.scanStatus}
        isRefreshing={adjustmentsToTransfers.isScanning}
        disabled={!current_user}
      />

      <PrecisionCleanupCard
        hasData={precisionCleanup.hasData}
        status={precisionCleanup.status}
        hasIssues={precisionCleanup.hasIssues}
        totalIssues={precisionCleanup.totalIssues}
        isRunning={precisionCleanup.isRunning}
        result={precisionCleanup.result}
        onRunCleanup={precisionCleanup.runCleanup}
        onRefresh={precisionCleanup.scan}
        isRefreshing={precisionCleanup.isScanning}
        disabled={!current_user}
      />

      <DatabaseCleanupCard
        hasData={!!databaseCleanup.status}
        status={databaseCleanup.status}
        hasIssues={databaseCleanup.hasIssues}
        totalIssues={databaseCleanup.totalIssues}
        isRunning={databaseCleanup.isRunning}
        result={databaseCleanup.result}
        onRunCleanup={databaseCleanup.runCleanup}
        onRefresh={databaseCleanup.scanStatus}
        isRefreshing={databaseCleanup.isScanning}
        disabled={!current_user}
      />

      <FeedbackMigrationCard
        hasData={!!feedbackMigration.status}
        status={feedbackMigration.status}
        isMigrating={feedbackMigration.isMigratingFeedback}
        onMigrate={feedbackMigration.migrateFeedbackDocuments}
        onRefresh={feedbackMigration.scanStatus}
        isRefreshing={feedbackMigration.isScanning}
        disabled={!current_user}
        migrationResult={feedbackMigration.feedbackMigrationResult}
      />

      <DeleteAllMonthsCard
        hasData={!!deleteAllMonths.status}
        monthsCount={deleteAllMonths.status?.monthsCount ?? 0}
        budgetCount={deleteAllMonths.status?.budgetCount ?? 0}
        monthsToDelete={deleteAllMonths.status?.monthsToDelete ?? []}
        isDeleting={deleteAllMonths.isDeleting}
        onDelete={deleteAllMonths.deleteAllMonths}
        onRefresh={deleteAllMonths.scanStatus}
        isRefreshing={deleteAllMonths.isScanning}
        disabled={!current_user}
        deleteResult={deleteAllMonths.deleteResult}
        deleteProgress={deleteAllMonths.deleteProgress}
      />

      <SeedImportCard
        disabled={!current_user}
      />

      {/* Diagnostic Download Card */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        border: '1px solid color-mix(in srgb, #17a2b8 30%, transparent)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#17a2b8' }}>
              📊 Diagnostic Download
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
              Downloads all budget and month data as JSON for troubleshooting balance discrepancies.
              Includes stored vs calculated balances, transfers, adjustments, and full month breakdowns.
            </p>
            {diagnosticDownload.error && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#dc3545' }}>
                Error: {diagnosticDownload.error}
              </p>
            )}
            {diagnosticDownload.progress && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  height: '6px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    background: '#17a2b8',
                    height: '100%',
                    width: `${diagnosticDownload.progress.percentComplete}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
                  {diagnosticDownload.progress.phase === 'reading' && 'Reading data from Firestore...'}
                  {diagnosticDownload.progress.phase === 'analyzing' && `Analyzing budget ${diagnosticDownload.progress.current}/${diagnosticDownload.progress.total}...`}
                  {diagnosticDownload.progress.phase === 'complete' && 'Download complete!'}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            actionName="Download Diagnostics"
            onClick={diagnosticDownload.downloadDiagnostics}
            disabled={!current_user || diagnosticDownload.isDownloading}
            style={{ flexShrink: 0 }}
          >
            {diagnosticDownload.isDownloading ? (
              <>
                <Spinner noMargin /> Downloading...
              </>
            ) : (
              '⬇️ Download JSON'
            )}
          </Button>
        </div>
      </div>

      {/* Restore from Diagnostic Card */}
      <RestoreFromDiagnosticCard
        status={restoreFromDiagnostic.status}
        result={restoreFromDiagnostic.result}
        isScanning={restoreFromDiagnostic.isScanning}
        isRunning={restoreFromDiagnostic.isRunning}
        onScan={restoreFromDiagnostic.scan}
        onRun={restoreFromDiagnostic.run}
        disabled={!current_user}
      />

      {/* Info about migration scope */}
      <div style={{ background: 'color-mix(in srgb, currentColor 3%, transparent)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> These migrations will process <strong>all budgets and months</strong> in the system, not just the ones you own or are invited to.
        </p>
      </div>

      {/* Clear all caches button */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'color-mix(in srgb, #ff6b6b 10%, transparent)', borderRadius: '8px', border: '1px solid color-mix(in srgb, #ff6b6b 30%, transparent)' }}>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
          <strong>🗑️ Clear All Caches</strong>
          <span style={{ opacity: 0.7, display: 'block', marginTop: '0.25rem' }}>If you're seeing stale data after running migrations, clear all cached data and reload to fetch fresh data from Firestore.</span>
        </p>
        <Button
          variant="danger"
          actionName="Open Clear Caches Modal"
          onClick={() => setShowReloadModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          🔄 Clear All Caches & Reload
        </Button>
      </div>

      {/* Confirmation modal for clearing caches and reloading */}
      <Modal
        isOpen={showReloadModal}
        onClose={() => setShowReloadModal(false)}
        title="Clear Caches & Reload?"
      >
        <p style={{ margin: '0 0 1rem 0', opacity: 0.8 }}>
          This will clear all cached data from localStorage and reload the page.
          The app will fetch fresh data from Firestore for everything.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            actionName="Cancel Clear Caches"
            onClick={() => setShowReloadModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            actionName="Confirm Clear Caches & Reload"
            onClick={handleClearAllCachesAndReload}
          >
            Clear & Reload
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Migration

