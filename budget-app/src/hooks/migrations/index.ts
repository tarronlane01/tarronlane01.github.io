/**
 * Migration Hooks
 *
 * Each migration is in its own file for easy addition/removal.
 * Import individual hooks as needed in the migrations page.
 *
 * All migrations use direct Firestore operations - no React Query caching.
 */

// Main database cleanup - consolidated migration for budget/month schema validation
export {
  useDatabaseCleanup,
  type DatabaseCleanupStatus,
  type DatabaseCleanupResult,
  type FutureMonthInfo,
} from './useDatabaseCleanup'

// Special-purpose migrations
export { useFeedbackMigration, type FeedbackMigrationResult, type FeedbackMigrationStatus } from './useFeedbackMigration'
export { useDeleteAllMonths, type DeleteAllMonthsResult, type DeleteAllMonthsStatus, type MonthInfo } from './useDeleteAllMonths'

