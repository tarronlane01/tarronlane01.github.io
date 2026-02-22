// Re-export all hooks
export { default as useFirebaseAuth } from './useFirebaseAuth'
export { useIsMobile } from './useIsMobile'
export { useScreenWidth } from './useScreenWidth'

// Budget data hooks - import these directly in components
export { useBudgetData } from './useBudgetData'
export { useMonthData } from './useMonthData'

// Page/Section-specific hooks
export { useAccountsPage, type AccountWithId } from './useAccountsPage'
export { useAllocationsPage } from './useAllocationsPage'
export { useCategoriesPage, type CategoryEntry, type CategoryWithId, type CategoryBalance } from './useCategoriesPage'
export { useCategoryValidation } from './useCategoryValidation'
export { useMonthNavigationError } from './useMonthNavigationError'
export { useInitialDataLoad } from './useInitialDataLoad'
export { useLocalRecalculation, recalculateMonthLocally, recalculateMonthsLocally } from './useLocalRecalculation'
export { useBackgroundSave } from './useBackgroundSave'
export { useNavigationSave } from './useNavigationSave'
export { useMonthPrefetch } from './useMonthPrefetch'
export { useEnsureBalancesFresh } from './useEnsureBalancesFresh'
export { useStaleDataRefresh } from './useStaleDataRefresh'

// Migration hooks
export {
  // Progress system - REQUIRED for all migrations
  MigrationProgressProvider,
  useMigrationProgress,
  type ProgressReporter,
  type MigrationProgressState,
  // Individual migration hooks
  // Add migration hooks here when adding new migrations
  // Example: useMyNewMigration, type MyNewMigrationStatus, type MyNewMigrationResult,
  // Note: useEnsureUngroupedGroups exists as an example but is not exported since it's not currently active
  useDeleteAllMonths,
  useDeleteSampleUserBudget,
  usePrecisionCleanup,
  useExpenseToAdjustmentMigration,
  useOrphanedIdCleanup,
  type DeleteAllMonthsResult,
  type DeleteSampleUserBudgetResult,
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
  useRemoveTotalFieldsMigration,
  type RemoveTotalFieldsMigrationStatus,
  type RemoveTotalFieldsMigrationResult,
  useRemovePreviousMonthIncomeMigration,
  type RemovePreviousMonthIncomeMigrationStatus,
  type RemovePreviousMonthIncomeMigrationResult,
  usePercentageIncomeMonthsBackMigration,
  type PercentageIncomeMonthsBackMigrationStatus,
  type PercentageIncomeMonthsBackMigrationResult,
  useRemoveLegacyBalanceFieldsMigration,
  type RemoveLegacyBalanceFieldsMigrationStatus,
  type RemoveLegacyBalanceFieldsMigrationResult,
  useRecalculateStartBalancesMigration,
  type RecalculateStartBalancesMigrationStatus,
  type RecalculateStartBalancesMigrationResult,
  useRepairMonthMapMigration,
  type RepairMonthMapMigrationStatus,
  type RepairMonthMapMigrationResult,
  useDiagnosticDownload,
  type DownloadProgress,
  useBudgetInspector,
  type BudgetInspectorResult,
  useDownloadBudget,
  type DownloadBudgetProgress,
  useUploadBudget,
  type UploadBudgetProgress,
  type UploadBudgetStatus,
  type UploadBudgetResult,
  useUploadSampleBudget,
  type UploadSampleBudgetProgress,
  type UploadSampleBudgetStatus,
  type UploadSampleBudgetResult,
  useUpdateSampleBudget,
  type UpdateSampleBudgetProgress,
  type UpdateSampleBudgetResult,
  type UseUpdateSampleBudgetReturn,
} from './migrations'

