/**
 * Update Expense Hook
 *
 * Updates an existing expense transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data'
import { readMonth } from '@data/queries/month'
import type { MonthDocument, ExpenseTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

/**
 * Check if expense values have actually changed (no-op detection)
 */
function hasExpenseChanges(
  oldExpense: ExpenseTransaction | undefined,
  amount: number,
  categoryId: string,
  accountId: string,
  date: string,
  payee?: string,
  description?: string,
  cleared?: boolean
): boolean {
  if (!oldExpense) return true // New expense, always save

  // Normalize payee/description for comparison (undefined vs empty string)
  const oldPayee = oldExpense.payee || undefined
  const newPayee = payee?.trim() || undefined
  const oldDescription = oldExpense.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldExpense.amount ||
    categoryId !== oldExpense.category_id ||
    accountId !== oldExpense.account_id ||
    date !== oldExpense.date ||
    newPayee !== oldPayee ||
    newDescription !== oldDescription ||
    cleared !== oldExpense.cleared
  )
}

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
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Find old expense to calculate delta and check for changes
    const oldExpense = (monthData.expenses || []).find(e => e.id === expenseId)

    // No-op detection: skip write if nothing changed
    if (!hasExpenseChanges(oldExpense, amount, categoryId, accountId, date, payee, description, cleared)) {
      return { updatedMonth: monthData, noOp: true }
    }

    const oldAmount = oldExpense?.amount ?? 0
    const oldAccountId = oldExpense?.account_id ?? accountId

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

    // Re-total to update all derived values (totals, account_balances, category spent, etc.)
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      expenses: updatedExpensesList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update expense' })

    // Update budget's account balance
    // Amounts are signed: negative = expense (money out), positive = refund (money in)
    // To update: reverse old effect (-oldAmount) and apply new effect (+amount)
    // Delta = amount - oldAmount
    if (oldAccountId === accountId) {
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount - oldAmount }])
    } else {
      await updateBudgetAccountBalances(budgetId, [
        { accountId: oldAccountId, delta: -oldAmount },  // Reverse old account effect
        { accountId, delta: amount },                     // Apply new account effect
      ])
    }

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
