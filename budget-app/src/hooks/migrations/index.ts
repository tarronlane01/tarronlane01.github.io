/**
 * Migration Hooks
 *
 * Each migration is in its own file for easy addition/removal.
 * Import individual hooks as needed in the migrations page.
 *
 * All migrations use direct Firestore operations - no React Query caching.
 */

export { useBudgetDataMigration, type DataMigrationStatus } from './useBudgetDataMigration'
export { useFutureMonthsCleanup, type FutureMonthsCleanupResult, type FutureMonthsStatus, type FutureMonthInfo } from './useFutureMonthsCleanup'
export { useFeedbackMigration, type FeedbackMigrationResult, type FeedbackMigrationStatus } from './useFeedbackMigration'

