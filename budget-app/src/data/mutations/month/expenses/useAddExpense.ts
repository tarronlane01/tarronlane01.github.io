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
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

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

    // Re-total to update all derived values (totals, account_balances, category spent, etc.)
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      expenses: updatedExpenses,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'add expense' })

    // Update budget's account balance
    // Amount is signed: negative for expense (decreases balance), positive for refund (increases balance)
    await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])

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

