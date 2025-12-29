/**
 * Delete Expense Hook
 *
 * Deletes an expense transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'

export function useDeleteExpense() {
  const { writeData } = useWriteMonthData()

  const deleteExpense = async (
    budgetId: string,
    year: number,
    month: number,
    expenseId: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'delete expense')

    const updatedExpensesList = (monthData.expenses || []).filter(exp => exp.id !== expenseId)

    const updatedMonth: MonthDocument = {
      ...monthData,
      expenses: updatedExpensesList,
      total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete expense' })

    return { updatedMonth }
  }

  return {
    deleteExpense,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

