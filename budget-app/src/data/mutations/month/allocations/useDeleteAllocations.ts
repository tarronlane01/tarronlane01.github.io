/**
 * Delete Allocations Hook
 *
 * Deletes all allocations (clears allocations and sets unfinalized).
 * Uses writeMonthData which automatically marks future months and budget
 * as needing recalculation.
 *
 * Also updates budget's category balances and total_available for immediate UI feedback.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { updateBudgetCategoryBalances } from '../../budget/categories'

export interface DeleteAllocationsParams {
  budgetId: string
  year: number
  month: number
}

export function useDeleteAllocations() {
  const { writeData } = useWriteMonthData()

  const deleteAllocations = async (params: DeleteAllocationsParams) => {
    const { budgetId, year, month } = params

    const monthData = await readMonthForEdit(budgetId, year, month, 'delete allocations')

    // Capture previous allocations before clearing (for budget update)
    const previousAllocations: { categoryId: string; allocated: number }[] = []
    if (monthData.are_allocations_finalized && monthData.category_balances) {
      for (const cb of monthData.category_balances) {
        if (cb.allocated > 0) {
          previousAllocations.push({ categoryId: cb.category_id, allocated: cb.allocated })
        }
      }
    }

    // Clear allocations from category_balances
    const clearedCategoryBalances = monthData.category_balances.map(cb => ({
      ...cb,
      allocated: 0,
      end_balance: cb.start_balance - cb.spent,
    }))

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: clearedCategoryBalances,
      are_allocations_finalized: false,
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
      description: 'delete allocations',
    })

    // Update budget's category balances (negative delta to remove allocations)
    if (previousAllocations.length > 0) {
      const categoryDeltas = previousAllocations.map(({ categoryId, allocated }) => ({
        categoryId,
        delta: -allocated, // Remove the allocation (negative delta)
      }))
      await updateBudgetCategoryBalances(budgetId, categoryDeltas)
    }

    return { updatedMonth }
  }

  return {
    deleteAllocations,
    // Expose mutation state for UI loading indicators
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
