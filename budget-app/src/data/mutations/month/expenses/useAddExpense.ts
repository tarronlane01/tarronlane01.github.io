/**
 * Add Expense Hook
 *
 * Adds a new expense transaction to the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, readMonthForEdit } from '@data'
import type { MonthDocument, ExpenseTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'

export function useAddExpense() {
  const queryClient = useQueryClient()
  const { writeData } = useWriteMonthData()

  const addExpense = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'add expense')

    const newExpense: ExpenseTransaction = {
      id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      category_id: categoryId,
      account_id: accountId,
      date,
      created_at: new Date().toISOString(),
    }
    if (payee?.trim()) newExpense.payee = payee.trim()
    if (description) newExpense.description = description
    if (cleared !== undefined) newExpense.cleared = cleared

    const updatedExpenses = [...(monthData.expenses || []), newExpense]
    const updatedMonth: MonthDocument = {
      ...monthData,
      expenses: updatedExpenses,
      total_expenses: updatedExpenses.reduce((sum, exp) => sum + exp.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'add expense' })

    // Save payee if new
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
      }
    }

    return { updatedMonth, newExpense }
  }

  return {
    addExpense,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

