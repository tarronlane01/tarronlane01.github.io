/**
 * Delete Expense Hook
 *
 * Deletes an expense transaction from the month.
 * Uses writeMonthData which handles optimistic updates and updates the month_map.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'

export function useDeleteExpense() {
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const deleteExpense = async (
    budgetId: string,
    year: number,
    month: number,
    expenseId: string
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    const updatedExpensesList = (monthData.expenses || []).filter(exp => exp.id !== expenseId)

    // Update month with removed transaction - retotalling and recalculation happens in recalculateMonthAndCascade
    const updatedMonth: MonthDocument = {
      ...monthData,
      expenses: updatedExpensesList,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Recalculate month, all future months, and budget - all in one call
    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useDeleteExpense] Failed to recalculate month and cascade:', error)
      // Continue even if recalculation fails
    }

    // Save current document immediately if it's the one being viewed
    const isCurrentDocument = currentViewingDocument.type === 'month' &&
      currentViewingDocument.year === year &&
      currentViewingDocument.month === month

    if (isCurrentDocument) {
      try {
        await saveCurrentDocument(budgetId, 'month', year, month)
      } catch (error) {
        console.warn('[useDeleteExpense] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    return { updatedMonth }
  }

  return {
    deleteExpense,
    isPending: false,
    isError: false,
    error: null,
  }
}
