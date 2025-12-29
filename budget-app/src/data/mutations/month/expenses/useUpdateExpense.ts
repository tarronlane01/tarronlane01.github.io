/**
 * Update Expense Hook
 *
 * Updates an existing expense transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, readMonthForEdit } from '@data'
import type { MonthDocument, ExpenseTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  const { writeData } = useWriteMonthData()

  const updateExpense = async (
    budgetId: string,
    year: number,
    month: number,
    expenseId: string,
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'update expense')

    const updatedExpense: ExpenseTransaction = {
      id: expenseId,
      amount,
      category_id: categoryId,
      account_id: accountId,
      date,
      created_at: monthData.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
    }
    if (payee?.trim()) updatedExpense.payee = payee.trim()
    if (description) updatedExpense.description = description
    if (cleared !== undefined) updatedExpense.cleared = cleared

    const updatedExpensesList = (monthData.expenses || []).map(exp => exp.id === expenseId ? updatedExpense : exp)
    const updatedMonth: MonthDocument = {
      ...monthData,
      expenses: updatedExpensesList,
      total_expenses: updatedExpensesList.reduce((sum, exp) => sum + exp.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update expense' })

    // Save payee if new
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
      }
    }

    return { updatedMonth }
  }

  return {
    updateExpense,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

