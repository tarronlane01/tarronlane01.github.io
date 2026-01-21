/**
 * Delete Allocations Hook
 *
 * Deletes all allocations (clears allocations and sets unfinalized).
 * Triggers immediate recalculation when allocations are deleted.
 *
 * Progress callback allows the UI to show detailed status during the operation.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import type { AllocationProgress } from './useFinalizeAllocations'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'

export interface DeleteAllocationsParams {
  budgetId: string
  year: number
  month: number
  /** Optional callback to report progress during the operation */
  onProgress?: (progress: AllocationProgress) => void
}

export function useDeleteAllocations() {
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const deleteAllocations = async (params: DeleteAllocationsParams) => {
    const { budgetId, year, month, onProgress } = params

    // Phase 1: Deleting allocations
    onProgress?.({ phase: 'saving', message: 'Deleting allocations...' })

    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Clear allocations from category_balances
    // Don't manually set end_balance - let recalculation handle it from transactions
    const clearedCategoryBalances = monthData.category_balances.map(cb => ({
      ...cb,
      allocated: 0,
      // end_balance will be recalculated by recalculateMonthAndCascade
    }))

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: clearedCategoryBalances,
      are_allocations_finalized: false,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Phase 2: Recalculate locally (instant feedback)
    onProgress?.({ phase: 'recalculating', message: 'Recalculating month balances...' })

    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useDeleteAllocations] Failed to recalculate month and cascade:', error)
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
        console.warn('[useDeleteAllocations] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    onProgress?.({ phase: 'complete', message: 'Allocations deleted!' })

    return { updatedMonth }
  }

  return {
    deleteAllocations,
    // No longer using mutation, so no pending state
    isPending: false,
    isError: false,
    error: null,
  }
}
