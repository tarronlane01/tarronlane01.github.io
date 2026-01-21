/**
 * Migration Hooks
 *
 * Each migration is in its own file for easy addition/removal.
 * Import individual hooks as needed in the migrations page.
 *
 * ARCHITECTURE:
 * All migrations MUST use these frameworks to ensure correctness:
 *
 * 1. PROGRESS REPORTING (migrationProgress) - PRIMARY:
 *    - Use `useMigrationProgress()` hook and `runMigrationWithProgress()` for ALL migrations
 *    - This automatically shows a progress modal that cannot be dismissed while running
 *    - Migrations MUST use the ProgressReporter to report their progress
 *
 * 2. CACHE INVALIDATION (migrationRunner) - LEGACY:
 *    - `runMigration()` is now deprecated - use runMigrationWithProgress instead
 *    - `clearAllCaches()` is still available but called automatically by progress system
 *
 * 3. BATCH READ/WRITE (migrationDataHelpers):
 *    - Use `readAllBudgetsAndMonths()` for batch reading
 *    - Use `batchWriteBudgets()` and `batchWriteMonths()` for batch writing
 *    - Use `recalculateAndWriteBudget()` to properly recalculate months
 *
 * These ensure:
 * - Progress is ALWAYS shown to users during migrations
 * - Cache is always invalidated after migrations
 * - Data is read/written efficiently in batches
 * - Recalculations are properly performed
 */

// Migration Progress System - REQUIRED for all migrations (shows progress modal)
export {
  MigrationProgressProvider,
  useMigrationProgress,
  type ProgressReporter,
  type MigrationProgressState,
} from './migrationProgress'

// Migration Runner Framework - DEPRECATED: Use useMigrationProgress instead
// Still exported for backwards compatibility during transition
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
  // Recalculation helpers
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
// Export migration hooks here when adding new migrations
// Example: export { useMyNewMigration, type MyNewMigrationStatus, type MyNewMigrationResult } from './useMyNewMigration'
//
// See useEnsureUngroupedGroups.ts as an example of how to structure a migration hook
// Note: useEnsureUngroupedGroups is kept as an example but not exported since it's not currently active
export { useDeleteAllMonths, type DeleteAllMonthsResult, type DeleteAllMonthsStatus, type MonthInfo, type DeleteProgress, type DeletePhase } from './useDeleteAllMonths'
export { useDeleteSampleUserBudget, type DeleteSampleUserBudgetStatus, type DeleteSampleUserBudgetResult, type SampleBudgetInfo, type DeleteSampleProgress, type DeleteSamplePhase } from './useDeleteSampleUserBudget'
export { usePrecisionCleanup, type PrecisionCleanupStatus, type PrecisionCleanupResult } from './usePrecisionCleanup'
export { useExpenseToAdjustmentMigration, type ExpenseToAdjustmentStatus, type ExpenseToAdjustmentResult } from './useExpenseToAdjustmentMigration'
export { useOrphanedIdCleanup, type OrphanedIdCleanupStatus, type OrphanedIdCleanupResult } from './useOrphanedIdCleanup'
export { useAdjustmentsToTransfersMigration, type AdjustmentsToTransfersStatus, type AdjustmentsToTransfersResult } from './useAdjustmentsToTransfersMigration'
export { useAccountCategoryValidation, type ValidationStatus, type TransactionViolation } from './useAccountCategoryValidation'
export { useRemoveTotalFieldsMigration, type RemoveTotalFieldsMigrationStatus, type RemoveTotalFieldsMigrationResult } from './useRemoveTotalFieldsMigration'
export { useRemovePreviousMonthIncomeMigration, type RemovePreviousMonthIncomeMigrationStatus, type RemovePreviousMonthIncomeMigrationResult } from './useRemovePreviousMonthIncomeMigration'
export { useRecalculateStartBalancesMigration, type RecalculateStartBalancesMigrationStatus, type RecalculateStartBalancesMigrationResult } from './useRecalculateStartBalancesMigration'
export { useRepairMonthMapMigration, type RepairMonthMapMigrationStatus, type RepairMonthMapMigrationResult } from './useRepairMonthMapMigration'
export { useDiagnosticDownload, type DownloadProgress } from './useDiagnosticDownload'
export { useRestoreFromDiagnostic, type RestoreStatus, type RestoreResult } from './useRestoreFromDiagnostic'
export { useDownloadBudget, type DownloadBudgetProgress } from './useDownloadBudget'
export { useUploadBudget, type UploadBudgetProgress, type UploadBudgetStatus, type UploadBudgetResult } from './useUploadBudget'

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

