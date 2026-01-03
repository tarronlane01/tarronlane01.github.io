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

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { calculateCategoryBalancesForMonth, type AllocationData } from '.'
import { triggerRecalculation, type RecalculationProgress } from '../../../recalculation'
import { queryClient, queryKeys } from '../../../queryClient'

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
  const { writeData } = useWriteMonthData()

  const finalizeAllocations = async (params: FinalizeAllocationsParams) => {
    const { budgetId, year, month, allocations, onProgress } = params

    // Phase 1: Saving allocations
    onProgress?.({ phase: 'saving', message: 'Saving allocations...' })

    const monthData = await readMonthForEdit(budgetId, year, month, 'finalize allocations')

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

    // Write month data with cascade marking (marks future months as needing recalc)
    await writeData.mutateAsync({
      budgetId,
      month: updatedMonth,
      description: 'finalize allocations',
    })

    // Phase 2: Trigger immediate recalculation
    onProgress?.({ phase: 'recalculating', message: 'Recalculating month balances...' })

    await triggerRecalculation(budgetId, {
      triggeringMonthOrdinal: `${year}${String(month).padStart(2, '0')}`,
      onProgress: (recalcProgress) => {
        // Forward recalculation progress with a user-friendly message
        let message = 'Recalculating balances...'
        if (recalcProgress.phase === 'fetching-months') {
          message = `Loading month data (${recalcProgress.monthsFetched}/${recalcProgress.totalMonthsToFetch})...`
        } else if (recalcProgress.phase === 'recalculating' && recalcProgress.currentMonth) {
          message = `Recalculating ${recalcProgress.currentMonth}...`
        } else if (recalcProgress.phase === 'saving') {
          message = 'Saving recalculated balances...'
        }
        onProgress?.({
          phase: 'recalculating',
          message,
          recalcProgress,
        })
      },
    })

    // Force refetch month and budget data after recalculation
    // Using refetchQueries instead of invalidateQueries because refetchOnMount: false
    // means invalidated queries won't refetch when navigating to a new page
    await queryClient.refetchQueries({ queryKey: queryKeys.month(budgetId, year, month) })
    await queryClient.refetchQueries({ queryKey: queryKeys.budget(budgetId) })

    onProgress?.({ phase: 'complete', message: 'Allocations applied!' })

    return { updatedMonth }
  }

  return {
    finalizeAllocations,
    // Expose mutation state for UI loading indicators
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
