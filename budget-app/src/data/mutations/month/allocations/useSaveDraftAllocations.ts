/**
 * Save Draft Allocations Hook
 *
 * Saves allocations as a draft (does NOT affect category balances in budget).
 * Draft allocations are stored in category_balances but with `are_allocations_finalized = false`.
 *
 * Uses writeMonthData which handles optimistic updates.
 * Draft allocations skip cascade recalculation since they don't affect balances.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import { useWriteMonthData } from '..'
import type { AllocationData } from '.'
import { roundCurrency } from '@utils'

export function useSaveDraftAllocations() {
  const { writeData } = useWriteMonthData()

  const saveDraftAllocations = async (
    budgetId: string,
    year: number,
    month: number,
    allocations: AllocationData
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Update category_balances with draft allocations
    // Recalculate all calculated fields (spent, transfers, adjustments, end_balance) from transactions
    // to ensure they're fresh, even though end_balance doesn't affect balances until finalized
    const { calculateCategoryBalances } = await import('@utils/calculations/balances/calculateCategoryBalancesFromTransactions')
    
    // Get stored balances (start_balance, allocated) and recalculate calculated fields
    const storedBalances = monthData.category_balances.map(cb => ({
      category_id: cb.category_id,
      start_balance: cb.start_balance,
      // Round allocated to ensure 2 decimal precision
      allocated: roundCurrency(allocations[cb.category_id] ?? cb.allocated),
    }))
    
    const updatedCategoryBalances = calculateCategoryBalances(
      storedBalances,
      monthData.expenses || [],
      monthData.transfers || [],
      monthData.adjustments || []
    )

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: updatedCategoryBalances,
      updated_at: new Date().toISOString(),
    }

    // Draft allocations don't affect balances, skip cascade
    await writeData.mutateAsync({ budgetId, month: updatedMonth, updateMonthMap: false })

    return { updatedMonth }
  }

  return {
    saveDraftAllocations,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
