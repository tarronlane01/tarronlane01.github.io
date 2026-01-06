// Re-export all hooks
export { default as useFirebaseAuth } from './useFirebaseAuth'
export { useIsMobile } from './useIsMobile'
export { useScreenWidth } from './useScreenWidth'

// Budget data hooks - import these directly in components
export { useBudgetData } from './useBudgetData'
export { useBudgetMonth } from './useBudgetMonth'

// Page/Section-specific hooks
export { useAccountsPage, type AccountWithId } from './useAccountsPage'
export { useAllocationsPage } from './useAllocationsPage'
export { useCategoriesPage, type CategoryEntry, type CategoryWithId, type CategoryBalance } from './useCategoriesPage'
export { useMonthNavigationError } from './useMonthNavigationError'

// Migration hooks
export {
  // Progress system - REQUIRED for all migrations
  MigrationProgressProvider,
  useMigrationProgress,
  type ProgressReporter,
  type MigrationProgressState,
  // Individual migration hooks
  useDatabaseCleanup,
  useFeedbackMigration,
  useDeleteAllMonths,
  usePrecisionCleanup,
  useExpenseToAdjustmentMigration,
  useOrphanedIdCleanup,
  type DatabaseCleanupStatus,
  type DatabaseCleanupResult,
  type FeedbackMigrationResult,
  type DeleteAllMonthsResult,
  type PrecisionCleanupStatus,
  type PrecisionCleanupResult,
  type ExpenseToAdjustmentStatus,
  type ExpenseToAdjustmentResult,
  type OrphanedIdCleanupStatus,
  type OrphanedIdCleanupResult,
  useAdjustmentsToTransfersMigration,
  type AdjustmentsToTransfersStatus,
  type AdjustmentsToTransfersResult,
  useAccountCategoryValidation,
  type ValidationStatus,
  type TransactionViolation,
  useHiddenFieldMigration,
  type HiddenFieldMigrationStatus,
  type HiddenFieldMigrationResult,
  useDiagnosticDownload,
  type DownloadProgress,
} from './migrations'

