/**
 * Update Expense Hook
 *
 * Updates an existing expense transaction.
 * Uses writeMonthData which handles optimistic updates and updates the month_map.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data'
import { readMonth } from '@data/queries/month'
import type { MonthDocument, ExpenseTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

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
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

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

    const updatedExpense: ExpenseTransaction = {
      id: expenseId,
      // Round amount to ensure 2 decimal precision before storing
      amount: roundCurrency(amount),
      category_id: categoryId,
      account_id: accountId,
      date,
      created_at: monthData.expenses?.find(e => e.id === expenseId)?.created_at || new Date().toISOString(),
    }
    if (payee?.trim()) updatedExpense.payee = payee.trim()
    if (description) updatedExpense.description = description
    if (cleared !== undefined) updatedExpense.cleared = cleared

    const updatedExpensesList = (monthData.expenses || []).map(exp => exp.id === expenseId ? updatedExpense : exp)

    // Update month with updated transaction - retotalling and recalculation happens in recalculateMonthAndCascade
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
      console.warn('[useUpdateExpense] Failed to recalculate month and cascade:', error)
      // Continue even if recalculation fails
    }

    // Save payee if new (this still writes immediately since it's just adding to a list)
    // Note: payee changes are tracked separately since they're a different document type
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
        // Payee changes need to be tracked separately - this is handled by savePayeeIfNew or we need to track it
        // For now, we'll leave this as-is since payees are a special case
      }
    }

    // Save current document immediately if it's the one being viewed
    const isCurrentDocument = currentViewingDocument.type === 'month' &&
      currentViewingDocument.year === year &&
      currentViewingDocument.month === month

    if (isCurrentDocument) {
      try {
        await saveCurrentDocument(budgetId, 'month', year, month)
      } catch (error) {
        console.warn('[useUpdateExpense] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    return { updatedMonth }
  }

  return {
    updateExpense,
    isPending: false, // No longer using mutation, so no pending state
    isError: false,
    error: null,
  }
}
