import { useState } from 'react'
import useFirebaseAuth from '../../../hooks/useFirebaseAuth'
import { useDatabaseCleanup, useFeedbackMigration, useDeleteAllMonths } from '../../../hooks'
import {
  Spinner,
  DatabaseCleanupCard,
  FeedbackMigrationCard,
  DeleteAllMonthsCard,
  SeedImportCard,
} from '../../../components/budget/Admin'
import { Modal, Button } from '../../../components/ui'
import { logUserAction } from '@utils/actionLogger'

/**
 * Clear ALL React Query caches (in-memory and localStorage) and reload page.
 * This ensures the app fetches fresh data from Firestore for everything.
 *
 * IMPORTANT: We clear localStorage FIRST and reload immediately.
 * Do NOT call queryClient.clear() before reload - the async persister might
 * write back to localStorage after we clear it, creating a race condition.
 */
function handleClearAllCachesAndReload() {
  // Clear localStorage persistence FIRST (before any async operations)
  try {
    localStorage.removeItem('BUDGET_APP_QUERY_CACHE')
    console.log('[Cache] Cleared React Query cache from localStorage')
  } catch (err) {
    console.warn('Failed to clear localStorage cache:', err)
  }

  // Reload immediately - in-memory cache is cleared on reload anyway
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

  // Scanning state for all
  const isAnyScanning = databaseCleanup.isScanning || feedbackMigration.isScanning || deleteAllMonths.isScanning
  const isAnyRunning = databaseCleanup.isRunning || feedbackMigration.isMigratingFeedback || deleteAllMonths.isDeleting

  // Refresh all - scans all migration statuses
  const handleRefreshAll = async () => {
    logUserAction('CLICK', 'Refresh All Migrations')
    await Promise.all([
      databaseCleanup.scanStatus(),
      feedbackMigration.scanStatus(),
      deleteAllMonths.scanStatus(),
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

      {/* Info about migration scope */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
      }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> These migrations will process <strong>all budgets and months</strong> in the system,
          not just the ones you own or are invited to.
        </p>
      </div>

      {/* Clear all caches button */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'color-mix(in srgb, #ff6b6b 10%, transparent)',
        borderRadius: '8px',
        border: '1px solid color-mix(in srgb, #ff6b6b 30%, transparent)',
      }}>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>
          <strong>🗑️ Clear All Caches</strong>
          <span style={{ opacity: 0.7, display: 'block', marginTop: '0.25rem' }}>
            If you're seeing stale data after running migrations, clear all cached data and reload to fetch fresh data from Firestore.
          </span>
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

