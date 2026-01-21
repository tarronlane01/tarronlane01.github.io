/**
 * Update Adjustment Hook
 *
 * Updates an existing adjustment transaction.
 * Uses writeMonthData which handles optimistic updates and updates the month_map.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import type { MonthDocument, AdjustmentTransaction } from '@types'
import { readMonth } from '@data/queries/month'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

/**
 * Check if adjustment values have actually changed (no-op detection)
 */
function hasAdjustmentChanges(
  oldAdjustment: AdjustmentTransaction | undefined,
  amount: number,
  accountId: string,
  categoryId: string,
  date: string,
  payee?: string,
  description?: string,
  cleared?: boolean
): boolean {
  if (!oldAdjustment) return true // New adjustment, always save

  const oldPayee = oldAdjustment.payee || undefined
  const newPayee = payee?.trim() || undefined
  const oldDescription = oldAdjustment.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldAdjustment.amount ||
    accountId !== oldAdjustment.account_id ||
    categoryId !== oldAdjustment.category_id ||
    date !== oldAdjustment.date ||
    newPayee !== oldPayee ||
    newDescription !== oldDescription ||
    cleared !== oldAdjustment.cleared
  )
}

export function useUpdateAdjustment() {
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const updateAdjustment = async (
    budgetId: string,
    year: number,
    month: number,
    adjustmentId: string,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Find old adjustment to calculate delta and check for changes
    const oldAdjustment = (monthData.adjustments || []).find(a => a.id === adjustmentId)

    // No-op detection: skip write if nothing changed
    if (!hasAdjustmentChanges(oldAdjustment, amount, accountId, categoryId, date, payee, description, cleared)) {
      return { updatedMonth: monthData, noOp: true }
    }

    // Note: oldAmount and oldAccountId are not needed since we recalculate from full state

    const updatedAdjustment: AdjustmentTransaction = {
      id: adjustmentId,
      // Round amount to ensure 2 decimal precision before storing
      amount: roundCurrency(amount),
      account_id: accountId,
      category_id: categoryId,
      date,
      created_at: monthData.adjustments?.find(a => a.id === adjustmentId)?.created_at || new Date().toISOString(),
    }
    if (payee?.trim()) updatedAdjustment.payee = payee.trim()
    if (description) updatedAdjustment.description = description
    if (cleared !== undefined) updatedAdjustment.cleared = cleared

    const updatedAdjustmentsList = (monthData.adjustments || []).map(a => a.id === adjustmentId ? updatedAdjustment : a)

    // Update month with updated transaction - retotalling and recalculation happens in recalculateMonthAndCascade
    const updatedMonth: MonthDocument = {
      ...monthData,
      adjustments: updatedAdjustmentsList,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Recalculate month, all future months, and budget - all in one call
    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useUpdateAdjustment] Failed to recalculate month and cascade:', error)
      // Continue even if recalculation fails
    }

    // Save current document immediately if it's the one being viewed
    const isCurrentDocument = currentViewingDocument.type === 'month' &&
      currentViewingDocument.year === year &&
      currentViewingDocument.month === month

    if (isCurrentDocument) {
      try {
        await saveCurrentDocument(budgetId, 'month', year, month)
      } catch (error) {
        console.warn('[useUpdateAdjustment] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    return { updatedMonth }
  }

  return {
    updateAdjustment,
    isPending: false,
    isError: false,
    error: null,
  }
}
