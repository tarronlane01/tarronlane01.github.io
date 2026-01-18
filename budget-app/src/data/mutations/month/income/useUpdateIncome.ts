/**
 * Update Income Hook
 *
 * Updates an existing income transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data'
import { readMonth } from '@data/queries/month'
import type { MonthDocument, IncomeTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'

/**
 * Check if income values have actually changed (no-op detection)
 */
function hasIncomeChanges(
  oldIncome: IncomeTransaction | undefined,
  amount: number,
  accountId: string,
  date: string,
  payee?: string,
  description?: string
): boolean {
  if (!oldIncome) return true // New income, always save

  // Normalize payee/description for comparison (undefined vs empty string)
  const oldPayee = oldIncome.payee || undefined
  const newPayee = payee?.trim() || undefined
  const oldDescription = oldIncome.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldIncome.amount ||
    accountId !== oldIncome.account_id ||
    date !== oldIncome.date ||
    newPayee !== oldPayee ||
    newDescription !== oldDescription
  )
}

export function useUpdateIncome() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade, trackChange } = useMonthMutationHelpers()

  const updateIncome = async (
    budgetId: string,
    year: number,
    month: number,
    incomeId: string,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Find old income to calculate delta and check for changes
    const oldIncome = (monthData.income || []).find(i => i.id === incomeId)

    // No-op detection: skip write if nothing changed
    if (!hasIncomeChanges(oldIncome, amount, accountId, date, payee, description)) {
      return { updatedMonth: monthData, noOp: true }
    }

    const updatedIncome: IncomeTransaction = {
      id: incomeId,
      amount,
      account_id: accountId,
      date,
      created_at: (monthData.income || []).find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
    }
    if (payee?.trim()) updatedIncome.payee = payee.trim()
    if (description) updatedIncome.description = description

    const updatedIncomeList = (monthData.income || []).map(inc => inc.id === incomeId ? updatedIncome : inc)

    // Update month with new transaction - retotalling and recalculation happens in recalculateMonthAndCascade
    const updatedMonth: MonthDocument = {
      ...monthData,
      income: updatedIncomeList,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Recalculate month, all future months, and budget - all in one call
    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useUpdateIncome] Failed to recalculate month and cascade:', error)
      // Continue even if recalculation fails
    }

    // Save payee if new (this still writes immediately since it's just adding to a list)
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
        trackChange({ type: 'payees', budgetId })
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
        console.warn('[useUpdateIncome] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    return { updatedMonth }
  }

  return {
    updateIncome,
    isPending: false, // No longer using mutation, so no pending state
    isError: false,
    error: null,
  }
}
