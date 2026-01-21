/**
 * Finalize Allocations Hook
 *
 * Finalizes allocations (applies to category balances).
 * Sets `are_allocations_finalized = true` and recalculates category balances.
 *
 * Triggers immediate recalculation when allocations are finalized.
 * This ensures all balances (account, category, available now) are updated immediately.
 *
 * Progress callback allows the UI to show detailed status during the operation.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import type { AllocationData } from '.'
import type { RecalculationProgress } from '../../../recalculation'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

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

    // Update only source values (allocated) - let recalculation handle calculated fields
    // Get category IDs from existing balances or allocations
    const existingCategoryIds = monthData.category_balances?.map(cb => cb.category_id) ?? []

    // Update only allocated (source value) - calculated fields will be recalculated
    // Round allocated values to ensure 2 decimal precision
    const updatedCategoryBalances = monthData.category_balances.map(cb => {
      const newAllocated = roundCurrency(allocations[cb.category_id] ?? cb.allocated)
      return {
        ...cb,
        allocated: newAllocated,
        // Don't set calculated fields - they'll be recalculated by recalculateMonthAndCascade
      }
    })

    // Add any categories that weren't in existing balances
    for (const [catId, allocated] of Object.entries(allocations)) {
      if (!existingCategoryIds.includes(catId)) {
        updatedCategoryBalances.push({
          category_id: catId,
          start_balance: 0,
          // Round allocated to ensure 2 decimal precision
          allocated: roundCurrency(allocated),
          // Calculated fields will be recalculated
          spent: 0,
          transfers: 0,
          adjustments: 0,
          end_balance: 0,
        })
      }
    }

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: updatedCategoryBalances,
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
