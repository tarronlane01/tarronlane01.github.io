/**
 * Migration Hooks
 *
 * Each migration is in its own file for easy addition/removal.
 * Import individual hooks as needed in the migrations page.
 *
 * ARCHITECTURE:
 * All migrations MUST use these frameworks to ensure correctness:
 *
 * 1. CACHE INVALIDATION (migrationRunner):
 *    - Use `runMigration()` to wrap migration logic (auto-clears cache after)
 *    - Use `clearAllCaches()` for explicit cache clearing when progress tracking is needed
 *
 * 2. BATCH READ/WRITE (migrationDataHelpers):
 *    - Use `readAllBudgetsAndMonths()` for batch reading
 *    - Use `batchWriteBudgets()` and `batchWriteMonths()` for batch writing
 *    - Use `recalculateAndWriteBudget()` to properly handle needs_recalculation flags
 *
 * These ensure:
 * - Cache is always invalidated after migrations
 * - Data is read/written efficiently in batches
 * - Recalculation flags are properly set/cleared
 */

// Migration Runner Framework - REQUIRED for all migrations
export { runMigration, clearAllCaches, type MigrationResultBase, type MigrationHookOptions } from './migrationRunner'

// Migration Data Helpers - REQUIRED for batch read/write and recalculation
export {
  // Batch read helpers
  readAllBudgets,
  readAllMonthsForBudget,
  readAllBudgetsAndMonths,
  // Batch write helpers
  batchWriteMonths,
  batchWriteBudgets,
  // Recalculation helpers (handles needs_recalculation flags)
  recalculateAndWriteBudget,
  writeMonthUpdatesAndRecalculate,
  // High-level processing helper
  processBudgetsWithMonths,
  // Types
  type BudgetReadResult,
  type MonthReadResult,
  type BudgetUpdate,
  type MonthUpdate,
  type AllDataReadResult,
} from './migrationDataHelpers'

// Main database cleanup - consolidated migration for budget/month schema validation
export {
  useDatabaseCleanup,
  type DatabaseCleanupStatus,
  type DatabaseCleanupResult,
  type FutureMonthInfo,
} from './useDatabaseCleanup'

// Special-purpose migrations
export { useFeedbackMigration, type FeedbackMigrationResult, type FeedbackMigrationStatus } from './useFeedbackMigration'
export { useDeleteAllMonths, type DeleteAllMonthsResult, type DeleteAllMonthsStatus, type MonthInfo, type DeleteProgress, type DeletePhase } from './useDeleteAllMonths'
export { usePrecisionCleanup, type PrecisionCleanupStatus, type PrecisionCleanupResult } from './usePrecisionCleanup'

// Seed data import
export {
  useSeedImport,
  type SeedRecordType,
  type SeedImportStatus,
  type ParsedSeedRow,
  type MappingEntry,
  type ImportDataMap,
  type SeedImportResult,
  type ImportProgress,
} from './useSeedImport'

