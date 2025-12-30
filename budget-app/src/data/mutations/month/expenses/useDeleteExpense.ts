/**
 * Delete Expense Hook
 *
 * Deletes an expense transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
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
    const monthData = await readMonthForEdit(budgetId, year, month, 'delete expense')

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

    // Update budget's account balance (deleting expense increases balance)
    if (deletedAccountId && deletedAmount > 0) {
      await updateBudgetAccountBalances(budgetId, [{ accountId: deletedAccountId, delta: deletedAmount }])
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

