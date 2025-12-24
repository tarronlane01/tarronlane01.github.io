import useFirebaseAuth from '../../hooks/useFirebaseAuth'
import { useMigrationActions } from '../../hooks'
import { useSettingsMigrationQuery, queryClient } from '../../data'
import type { FutureMonthInfo } from '../../data/queries/useSettingsMigrationQuery'
import {
  MigrationStatusCard,
  MigrationResults,
  Spinner,
  FutureMonthsCleanupCard,
} from '../../components/budget/Admin'

function SettingsMigration() {
  const firebase_auth_hook = useFirebaseAuth()

  const current_user = firebase_auth_hook.get_current_firebase_user()

  // Use React Query for migration status - does NOT auto-refetch
  const migrationQuery = useSettingsMigrationQuery()

  // Derive status from query
  const hasData = migrationQuery.data !== undefined
  const isStale = migrationQuery.isStale
  const migrationStatus = migrationQuery.data ?? {
    categoriesArrayMigrationNeeded: false,
    accountsArrayMigrationNeeded: false,
    budgetsToMigrateCategories: 0,
    budgetsToMigrateAccounts: 0,
    budgetsNeedingCategoryBalance: 0,
    totalBudgetsChecked: 0,
    futureMonthsToDelete: [] as FutureMonthInfo[],
    futureMonthsCount: 0,
  }
  const isLoading = migrationQuery.isLoading
  const isRefreshing = migrationQuery.isFetching && !migrationQuery.isLoading
  const lastUpdated = migrationQuery.dataUpdatedAt
    ? new Date(migrationQuery.dataUpdatedAt).toLocaleString()
    : null

  // Refresh migration status - invalidate cache first to ensure fresh Firebase read
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['settingsMigration'] })
    migrationQuery.refetch()
  }

  // Use the migration actions hook
  const {
    isMigrating,
    migrationResults,
    isCleaningFutureMonths,
    futureMonthsCleanupResult,
    runMigration,
    cleanupFutureMonths,
  } = useMigrationActions({
    currentUser: current_user,
    futureMonthsToDelete: migrationStatus.futureMonthsToDelete,
    onRefetch: handleRefresh,
  })

  const needsMigration = migrationStatus.categoriesArrayMigrationNeeded || migrationStatus.accountsArrayMigrationNeeded
  const totalBudgetsToMigrate = Math.max(migrationStatus.budgetsToMigrateCategories, migrationStatus.budgetsToMigrateAccounts)

  if (isLoading) {
    return (
      <div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ marginTop: 0 }}>Data Migrations</h2>
        <p style={{ opacity: 0.7 }}>Checking migration status...</p>
      </div>
    )
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Data Migrations</h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isMigrating}
          style={{
            background: '#646cff',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: isRefreshing || isMigrating ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            opacity: isRefreshing || isMigrating ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            minWidth: '130px',
            minHeight: '36px',
          }}
        >
          <span style={{ width: '18px', height: '18px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
            {isRefreshing ? <Spinner noMargin /> : '🔄'}
          </span>
          Refresh All
        </button>
      </div>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Run migrations to update your budget data structure. Status is cached and won't auto-refresh.
        <span style={{ display: 'block', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {!hasData ? (
            <span style={{ color: '#a5b4fc' }}>Status: Unknown (click Refresh to check)</span>
          ) : isStale ? (
            <span style={{ color: '#fbbf24' }}>⚠️ Status may be stale — Last checked: {lastUpdated}</span>
          ) : (
            <span>Last checked: {lastUpdated}</span>
          )}
        </span>
      </p>

      <MigrationStatusCard
        title="Migrate Data to Map Structure"
        description="Converts categories, accounts, and account groups from array format to map structure. This improves performance and enables direct lookup by ID."
        isComplete={hasData ? !needsMigration : false}
        isMigrating={isMigrating}
        needsMigration={hasData ? needsMigration : false}
        totalBudgetsToMigrate={totalBudgetsToMigrate}
        budgetsToMigrateCategories={migrationStatus.budgetsToMigrateCategories}
        budgetsToMigrateAccounts={migrationStatus.budgetsToMigrateAccounts}
        onRunMigration={runMigration}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        disabled={!current_user}
        isUnknown={!hasData}
      >
        {migrationResults && <MigrationResults results={migrationResults} />}
      </MigrationStatusCard>

      <FutureMonthsCleanupCard
        hasData={hasData}
        futureMonthsCount={migrationStatus.futureMonthsCount}
        futureMonthsToDelete={migrationStatus.futureMonthsToDelete}
        isCleaningFutureMonths={isCleaningFutureMonths}
        onCleanup={cleanupFutureMonths}
        disabled={!current_user}
        cleanupResult={futureMonthsCleanupResult}
      />

      {/* Info about migration scope */}
      <div style={{
        background: 'color-mix(in srgb, currentColor 3%, transparent)',
        padding: '1rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
      }}>
        <p style={{ margin: 0, opacity: 0.7 }}>
          <strong>Note:</strong> This migration will process <strong>all {hasData ? migrationStatus.totalBudgetsChecked : '?'} budgets</strong> in the system,
          not just the ones you own or are invited to.
        </p>
      </div>
    </div>
  )
}

export default SettingsMigration
