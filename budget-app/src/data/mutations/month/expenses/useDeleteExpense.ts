/**
 * Delete Expense Hook
 *
 * Deletes an expense transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 *
 * CACHE-AWARE PATTERN:
 * - If cache is fresh: uses cached data (0 reads)
 * - If cache is stale: fetches fresh data (1 read)
 */

import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isMonthCacheFresh, getMonthForMutation } from '../cacheAwareMonthRead'

export function useDeleteExpense() {
  const { writeData } = useWriteMonthData()

  const deleteExpense = async (
    budgetId: string,
    year: number,
    month: number,
    expenseId: string
  ) => {
    // Use cache if fresh, fetch if stale
    const cacheIsFresh = isMonthCacheFresh(budgetId, year, month)
    const monthData = await getMonthForMutation(budgetId, year, month, cacheIsFresh)

    // Find expense being deleted to get amount and account
    const deletedExpense = (monthData.expenses || []).find(exp => exp.id === expenseId)
    const deletedAmount = deletedExpense?.amount ?? 0
    const deletedAccountId = deletedExpense?.account_id

    const updatedExpensesList = (monthData.expenses || []).filter(exp => exp.id !== expenseId)

    // Re-total to update all derived values (totals, account_balances, category spent, etc.)
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      expenses: updatedExpensesList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete expense' })

    // Update budget's account balance - reverse the deleted expense's effect
    // Amounts are signed: negative = expense, positive = refund
    // Reversing: delta = -deletedAmount
    if (deletedAccountId && deletedAmount !== 0) {
      await updateBudgetAccountBalances(budgetId, [{ accountId: deletedAccountId, delta: -deletedAmount }])
    }

    return { updatedMonth }
  }

  return {
    deleteExpense,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

