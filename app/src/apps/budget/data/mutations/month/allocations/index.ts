/**
 * Allocation Mutations
 *
 * Individual hooks for each allocation mutation:
 * - useSaveDraftAllocations - Save allocations as draft (no balance changes)
 * - useFinalizeAllocations - Finalize allocations (applies to balances, triggers recalc)
 * - useDeleteAllocations - Delete all allocations (triggers recalc)
 */

// Shared type for allocation data (category_id -> amount)
export type AllocationData = Record<string, number>

// Helpers
export { calculateCategoryBalancesForMonth } from './calculateCategoryBalances'

// Hooks
export { useSaveDraftAllocations } from './useSaveDraftAllocations'
export {
  useFinalizeAllocations,
  type FinalizeAllocationsParams,
  type AllocationProgress,
  type AllocationProgressPhase,
} from './useFinalizeAllocations'
export { useDeleteAllocations, type DeleteAllocationsParams } from './useDeleteAllocations'

