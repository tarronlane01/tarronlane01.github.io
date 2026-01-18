/**
 * Finalize Allocations Hook
 *
 * Finalizes allocations (applies to category balances).
 * Sets `are_allocations_finalized = true` and recalculates category balances.
 *
 * Now triggers immediate recalculation instead of just marking months as needing recalc.
 * This ensures all balances (account, category, available now) are updated immediately.
 *
 * Progress callback allows the UI to show detailed status during the operation.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import { calculateCategoryBalancesForMonth, type AllocationData } from '.'
import type { RecalculationProgress } from '../../../recalculation'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'

export interface FinalizeAllocationsParams {
  budgetId: string
  year: number
  month: number
  allocations: AllocationData
  /** Optional callback to report progress during the operation */
  onProgress?: (progress: AllocationProgress) => void
}

/** Progress phases for allocation finalization */
export type AllocationProgressPhase = 'saving' | 'recalculating' | 'complete'

/** Progress information for allocation operations */
export interface AllocationProgress {
  phase: AllocationProgressPhase
  message: string
  /** Recalculation progress details (when phase is 'recalculating') */
  recalcProgress?: RecalculationProgress
}

export function useFinalizeAllocations() {
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const finalizeAllocations = async (params: FinalizeAllocationsParams) => {
    const { budgetId, year, month, allocations, onProgress } = params

    // Phase 1: Saving allocations
    onProgress?.({ phase: 'saving', message: 'Saving allocations...' })

    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Get category IDs from existing balances or allocations
    // Use allocation keys when month has no category_balances (fresh month after reset)
    // Note: empty array [] doesn't trigger ?? fallback, so we must check .length explicitly
    const existingCategoryIds = monthData.category_balances?.map(cb => cb.category_id) ?? []
    const categoryIds = existingCategoryIds.length > 0
      ? existingCategoryIds
      : Object.keys(allocations)

    const categoryBalances = categoryIds.length > 0
      ? calculateCategoryBalancesForMonth(monthData, categoryIds, allocations, true)
      : monthData.category_balances

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: categoryBalances,
      are_allocations_finalized: true,
      updated_at: new Date().toISOString(),
    }

    // Update cache and track change automatically
    updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)

    // Phase 2: Recalculate locally (instant feedback)
    onProgress?.({ phase: 'recalculating', message: 'Recalculating month balances...' })

    try {
      await recalculateMonthAndCascade(budgetId, year, month)
    } catch (error) {
      console.warn('[useFinalizeAllocations] Failed to recalculate month and cascade:', error)
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
        console.warn('[useFinalizeAllocations] Failed to save current document immediately:', error)
        // Continue even if immediate save fails - background save will handle it
      }
    }

    onProgress?.({ phase: 'complete', message: 'Allocations applied!' })

    return { updatedMonth }
  }

  return {
    finalizeAllocations,
    // No longer using mutation, so no pending state
    isPending: false,
    isError: false,
    error: null,
  }
}
