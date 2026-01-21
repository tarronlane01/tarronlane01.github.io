/**
 * Update Transfer Hook
 *
 * Updates an existing transfer transaction.
 * Uses writeMonthData which handles optimistic updates and updates the month_map.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import type { MonthDocument, TransferTransaction } from '@types'
import { readMonth } from '@data/queries/month'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

/**
 * Check if transfer values have actually changed (no-op detection)
 */
function hasTransferChanges(
  oldTransfer: TransferTransaction | undefined,
  amount: number,
  fromAccountId: string,
  toAccountId: string,
  fromCategoryId: string,
  toCategoryId: string,
  date: string,
  description?: string,
  cleared?: boolean
): boolean {
  if (!oldTransfer) return true // New transfer, always save

  const oldDescription = oldTransfer.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldTransfer.amount ||
    fromAccountId !== oldTransfer.from_account_id ||
    toAccountId !== oldTransfer.to_account_id ||
    fromCategoryId !== oldTransfer.from_category_id ||
    toCategoryId !== oldTransfer.to_category_id ||
    date !== oldTransfer.date ||
    newDescription !== oldDescription ||
    cleared !== oldTransfer.cleared
  )
}

export function useUpdateTransfer() {
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const updateTransfer = async (
    budgetId: string,
    year: number,
    month: number,
    transferId: string,
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Find old transfer to calculate delta and check for changes
    const oldTransfer = (monthData.transfers || []).find(t => t.id === transferId)

    // No-op detection: skip write if nothing changed
    if (!hasTransferChanges(oldTransfer, amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared)) {
      return { updatedMonth: monthData, noOp: true }
    }

    const updatedTransfer: TransferTransaction = {
      id: transferId,
      // Round amount to ensure 2 decimal precision before storing
      amount: roundCurrency(amount),
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      from_category_id: fromCategoryId,
      to_category_id: toCategoryId,
      date,
      created_at: monthData.transfers?.find(t => t.id === transferId)?.created_at || new Date().toISOString(),
    }
    if (description) updatedTransfer.description = description
    if (cleared !== undefined) updatedTransfer.cleared = cleared

    const updatedTransfersList = (monthData.transfers || []).map(t => t.id === transferId ? updatedTransfer : t)

    // Update month with updated transaction - retotalling and recalculation happens in recalculateMonthAndCascade
    const updatedMonth: MonthDocument = {
      ...monthData,
      transfers: updatedTransfersList,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Recalculate month, all future months, and budget - all in one call
    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useUpdateTransfer] Failed to recalculate month and cascade:', error)
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
        console.warn('[useUpdateTransfer] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    return { updatedMonth }
  }

  return {
    updateTransfer,
    isPending: false,
    isError: false,
    error: null,
  }
}
