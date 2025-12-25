import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useBudgetDataMigration, useFutureMonthsCleanup, useFeedbackMigration } from '../../hooks'
import { queryClient } from '../../data'
import {
  MigrationStatusCard,
  MigrationResults,
  Spinner,
  FutureMonthsCleanupCard,
  FeedbackMigrationCard,
} from '../../components/budget/Admin'

/**
 * Clear ALL React Query caches (in-memory and localStorage) and reload page.
 * This ensures the app fetches fresh data from Firestore for everything.
 */
function handleClearAllCachesAndReload() {
  // Clear all queries from in-memory cache
  queryClient.clear()

  // Clear localStorage persistence entirely
  try {
    localStorage.removeItem('BUDGET_APP_QUERY_CACHE')
    console.log('[Cache] Cleared all React Query caches from memory and localStorage')
  } catch (err) {
    console.warn('Failed to clear localStorage cache:', err)
  }

  // Reload page to get fresh data
  window.location.reload()
}

function SettingsMigration() {
  const firebase_auth_hook = useFirebaseAuth()
  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Individual migration hooks - each manages its own status via direct Firestore calls
  const budgetDataMigration = useBudgetDataMigration({
    currentUser: current_user,
  })

  const futureMonthsCleanup = useFutureMonthsCleanup({
    currentUser: current_user,
  })

  const feedbackMigration = useFeedbackMigration({
    currentUser: current_user,
  })

  // Compute derived state from hooks
  const needsMigration = budgetDataMigration.status?.categoriesArrayMigrationNeeded || budgetDataMigration.status?.accountsArrayMigrationNeeded
  const totalBudgetsToMigrate = Math.max(
    budgetDataMigration.status?.budgetsToMigrateCategories ?? 0,
    budgetDataMigration.status?.budgetsToMigrateAccounts ?? 0
  )

  // Scanning state for all
  const isAnyScanning = budgetDataMigration.isScanning || futureMonthsCleanup.isScanning || feedbackMigration.isScanning
  const isAnyMigrating = budgetDataMigration.isMigrating || futureMonthsCleanup.isCleaningFutureMonths || feedbackMigration.isMigratingFeedback

  // Refresh all - scans all migration statuses
  const handleRefreshAll = async () => {
    await Promise.all([
      budgetDataMigration.scanStatus(),
      futureMonthsCleanup.scanStatus(),
      feedbackMigration.scanStatus(),
    ])
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Data Migrations</h2>
        <button
          onClick={handleRefreshAll}
          disabled={isAnyScanning || isAnyMigrating}
          style={{
            background: '#646cff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: isAnyScanning || isAnyMigrating ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isAnyScanning || isAnyMigrating ? 0.7 : 1,
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
        Run migrations to update your budget data structure. Click "Refresh All" to scan Firestore directly.
      </p>

      <MigrationStatusCard
        title="Migrate Data to Map Structure"
        description="Converts categories, accounts, and account groups from array format to map structure. This improves performance and enables direct lookup by ID."
        isComplete={budgetDataMigration.status ? !needsMigration : false}
        isMigrating={budgetDataMigration.isMigrating}
        needsMigration={budgetDataMigration.status ? !!needsMigration : false}
        totalBudgetsToMigrate={totalBudgetsToMigrate}
        budgetsToMigrateCategories={budgetDataMigration.status?.budgetsToMigrateCategories ?? 0}
        budgetsToMigrateAccounts={budgetDataMigration.status?.budgetsToMigrateAccounts ?? 0}
        onRunMigration={budgetDataMigration.runMigration}
        onRefresh={budgetDataMigration.scanStatus}
        isRefreshing={budgetDataMigration.isScanning}
        disabled={!current_user}
        isUnknown={!budgetDataMigration.status}
      >
        {budgetDataMigration.migrationResults && <MigrationResults results={budgetDataMigration.migrationResults} />}
      </MigrationStatusCard>

      <FutureMonthsCleanupCard
        hasData={!!futureMonthsCleanup.status}
        futureMonthsCount={futureMonthsCleanup.status?.futureMonthsCount ?? 0}
        futureMonthsToDelete={futureMonthsCleanup.status?.futureMonthsToDelete ?? []}
        isCleaningFutureMonths={futureMonthsCleanup.isCleaningFutureMonths}
        onCleanup={futureMonthsCleanup.cleanupFutureMonths}
        onRefresh={futureMonthsCleanup.scanStatus}
        isRefreshing={futureMonthsCleanup.isScanning}
        disabled={!current_user}
        cleanupResult={futureMonthsCleanup.futureMonthsCleanupResult}
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

      {/* Info about migration scope */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
      }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> This migration will process <strong>all {budgetDataMigration.status?.totalBudgetsChecked ?? '?'} budgets</strong> in the system,
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
        <button
          onClick={handleClearAllCachesAndReload}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          🔄 Clear All Caches & Reload
        </button>
      </div>
    </div>
  )
}

export default SettingsMigration
