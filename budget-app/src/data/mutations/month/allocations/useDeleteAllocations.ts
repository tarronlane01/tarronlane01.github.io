/**
 * Delete Allocations Hook
 *
 * Deletes all allocations (clears allocations and sets unfinalized).
 * Uses writeMonthData which automatically marks future months and budget
 * as needing recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'

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
      is_needs_recalculation: false,
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
