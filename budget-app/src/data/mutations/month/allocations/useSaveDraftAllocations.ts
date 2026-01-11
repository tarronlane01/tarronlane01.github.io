/**
 * Save Draft Allocations Hook
 *
 * Saves allocations as a draft (does NOT affect category balances in budget).
 * Draft allocations are stored in category_balances but with `are_allocations_finalized = false`.
 *
 * Uses writeMonthData which handles optimistic updates.
 * Draft allocations skip cascade recalculation since they don't affect balances.
 *
 * CACHE-AWARE PATTERN:
 * - If cache is fresh: uses cached data (0 reads)
 * - If cache is stale: fetches fresh data (1 read)
 */

import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import type { AllocationData } from '.'
import { isMonthCacheFresh, getMonthForMutation } from '../cacheAwareMonthRead'

export function useSaveDraftAllocations() {
  const { writeData } = useWriteMonthData()

  const saveDraftAllocations = async (
    budgetId: string,
    year: number,
    month: number,
    allocations: AllocationData
  ) => {
    // Use cache if fresh, fetch if stale
    const cacheIsFresh = isMonthCacheFresh(budgetId, year, month)
    const monthData = await getMonthForMutation(budgetId, year, month, cacheIsFresh)

    // Update category_balances with draft allocations
    // Note: allocated amounts are stored but end_balance doesn't change until finalized
    const updatedCategoryBalances = monthData.category_balances.map(cb => ({
      ...cb,
      allocated: allocations[cb.category_id] ?? cb.allocated,
    }))

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: updatedCategoryBalances,
      updated_at: new Date().toISOString(),
    }

    // Draft allocations don't affect balances, skip cascade
    await writeData.mutateAsync({ budgetId, month: updatedMonth, cascadeRecalculation: false })

    return { updatedMonth }
  }

  return {
    saveDraftAllocations,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
