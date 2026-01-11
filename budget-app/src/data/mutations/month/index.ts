/**
 * Month Mutations
 *
 * Centralized month mutation operations organized by feature:
 * - allocations/ - Allocation operations (save draft, finalize, delete)
 * - income/ - Income transaction operations (add, update, delete)
 * - expenses/ - Expense transaction operations (add, update, delete)
 * - transfers/ - Transfer transaction operations (add, update, delete)
 * - adjustments/ - Adjustment transaction operations (add, update, delete)
 *
 * Core utilities:
 * - useWriteMonthData - Core hook for writing month documents
 * - writeMonthData - Utility function for non-React contexts
 */

// ============================================================================
// CORE UTILITIES
// ============================================================================

// Utility functions (for non-React contexts like inside mutationFns)
export { writeMonthData } from './useWriteMonthData'

// Core hook
export { useWriteMonthData, type WriteMonthParams } from './useWriteMonthData'

// Month creation (called when viewing a month for the first time)
export { createMonth, type CreateMonthOptions } from './createMonth'

// Cache-aware month reading for mutations (use this instead of readMonthForEdit)
export {
  isMonthCacheFresh,
  getMonthForMutation,
  type CacheAwareMutationParams,
} from './cacheAwareMonthRead'

// ============================================================================
// FEATURE MUTATIONS
// ============================================================================

// Allocation mutations
export {
  useSaveDraftAllocations,
  useFinalizeAllocations,
  useDeleteAllocations,
} from './allocations'

// Income mutations
export {
  useAddIncome,
  useUpdateIncome,
  useDeleteIncome,
} from './income'

// Expense mutations
export {
  useAddExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './expenses'

// Transfer mutations
export {
  useAddTransfer,
  useUpdateTransfer,
  useDeleteTransfer,
} from './transfers'

// Adjustment mutations
export {
  useAddAdjustment,
  useUpdateAdjustment,
  useDeleteAdjustment,
} from './adjustments'
