/**
 * Finalize Allocations Hook
 *
 * Finalizes allocations (applies to category balances).
 * Sets `are_allocations_finalized = true` and recalculates category balances.
 *
 * Uses writeMonthData which automatically marks future months and budget
 * as needing recalculation.
 *
 * Also updates budget's category balances and total_available for immediate UI feedback.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { calculateCategoryBalancesForMonth, type AllocationData } from '.'
import { updateBudgetCategoryBalances } from '../../budget/categories'

export interface FinalizeAllocationsParams {
  budgetId: string
  year: number
  month: number
  allocations: AllocationData
}

export function useFinalizeAllocations() {
  const { writeData } = useWriteMonthData()

  const finalizeAllocations = async (params: FinalizeAllocationsParams) => {
    const { budgetId, year, month, allocations } = params

    const monthData = await readMonthForEdit(budgetId, year, month, 'finalize allocations')

    // Get category IDs from existing balances or allocations
    const categoryIds = monthData.category_balances?.map(cb => cb.category_id)
      ?? Object.keys(allocations)

    // Calculate how much was already allocated (if previously finalized)
    const previousAllocations: Record<string, number> = {}
    if (monthData.are_allocations_finalized && monthData.category_balances) {
      for (const cb of monthData.category_balances) {
        previousAllocations[cb.category_id] = cb.allocated
      }
    }

    const categoryBalances = categoryIds.length > 0
      ? calculateCategoryBalancesForMonth(monthData, categoryIds, allocations, true)
      : monthData.category_balances

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: categoryBalances,
      are_allocations_finalized: true,
      updated_at: new Date().toISOString(),
    }

    // writeData handles:
    // - Writing to Firestore
    // - Optimistic cache updates for month
    // - Marking future months as needing recalculation
    // - Marking budget as needing recalculation
    await writeData.mutateAsync({
      budgetId,
      month: updatedMonth,
      description: 'finalize allocations',
    })

    // Calculate deltas for budget category balances
    // delta = newAllocation - previousAllocation
    const categoryDeltas = categoryIds.map(catId => ({
      categoryId: catId,
      delta: (allocations[catId] ?? 0) - (previousAllocations[catId] ?? 0),
    }))

    // Update budget's category balances and total_available for immediate UI feedback
    await updateBudgetCategoryBalances(budgetId, categoryDeltas)

    return { updatedMonth }
  }

  return {
    finalizeAllocations,
    // Expose mutation state for UI loading indicators
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
