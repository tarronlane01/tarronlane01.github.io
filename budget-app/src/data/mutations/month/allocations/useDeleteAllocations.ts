/**
 * Delete Allocations Hook
 *
 * Deletes all allocations (clears allocations and sets unfinalized).
 * Now triggers immediate recalculation instead of just marking months as needing recalc.
 *
 * Progress callback allows the UI to show detailed status during the operation.
 */

import type { MonthDocument } from '@types'
import { readMonth } from '@data/queries/month'
import { useWriteMonthData } from '..'
import { triggerRecalculation } from '../../../recalculation'
import { queryClient, queryKeys } from '../../../queryClient'
import type { AllocationProgress } from './useFinalizeAllocations'

export interface DeleteAllocationsParams {
  budgetId: string
  year: number
  month: number
  /** Optional callback to report progress during the operation */
  onProgress?: (progress: AllocationProgress) => void
}

export function useDeleteAllocations() {
  const { writeData } = useWriteMonthData()

  const deleteAllocations = async (params: DeleteAllocationsParams) => {
    const { budgetId, year, month, onProgress } = params

    // Phase 1: Deleting allocations
    onProgress?.({ phase: 'saving', message: 'Deleting allocations...' })

    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Clear allocations from category_balances
    const clearedCategoryBalances = monthData.category_balances.map(cb => ({
      ...cb,
      allocated: 0,
      end_balance: cb.start_balance - cb.spent,
    }))

    const updatedMonth: MonthDocument = {
      ...monthData,
      category_balances: clearedCategoryBalances,
      are_allocations_finalized: false,
      updated_at: new Date().toISOString(),
    }

    // Write month data with cascade marking (marks future months as needing recalc)
    await writeData.mutateAsync({
      budgetId,
      month: updatedMonth,
      description: 'delete allocations',
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

    onProgress?.({ phase: 'complete', message: 'Allocations deleted!' })

    return { updatedMonth }
  }

  return {
    deleteAllocations,
    // Expose mutation state for UI loading indicators
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}
