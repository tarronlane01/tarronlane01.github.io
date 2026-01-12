/**
 * Delete Expense Hook
 *
 * Deletes an expense transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

export function useDeleteExpense() {
  const { writeData } = useWriteMonthData()

  const deleteExpense = async (
    budgetId: string,
    year: number,
    month: number,
    expenseId: string
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

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
