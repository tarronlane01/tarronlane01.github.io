/**
 * Mutation Helpers
 *
 * Shared helpers for month mutations to:
 * - Track changes in sync context automatically
 * - Recalculate locally when data changes
 * - Update cache immediately
 */

import { queryClient, queryKeys } from '@data/queryClient'
import { recalculateMonthLocally } from '@hooks/useLocalRecalculation'
import type { MonthDocument } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { getYearMonthOrdinal } from '@utils'
import type { MonthMap } from '@types'
import type { BudgetData } from '@data/queries/budget'
import { useSync } from '@contexts/sync_context'
import { useApp } from '@contexts'
import { retotalMonth } from './retotalMonth'
import { getFirstWindowMonth } from '@utils/window'
import { writeMonthData } from './useWriteMonthData'
import { convertMonthBalancesToStored } from '@data/firestore/converters/monthBalances'
import { ensureMonthsFreshAndRecalculateBalances } from './ensureMonthsFresh'

/**
 * Recalculate the current month and all future months locally.
 * This recalculates months locally when data changes.
 *
 * IMPORTANT: Also tracks all recalculated months for background save.
 * This ensures that when a month is changed, all months from that month onwards
 * (including the edited month itself) are recalculated and saved to Firestore.
 *
 * @internal This is an internal implementation detail. Use recalculateMonthAndCascade instead.
 */
async function recalculateFutureMonthsLocally(
  budgetId: string,
  year: number,
  month: number,
  trackChange?: (change: { type: 'month'; budgetId: string; year: number; month: number }) => void
): Promise<void> {
  // Get budget to find all months from the edited month onwards
  const budgetData = queryClient.getQueryData<{ budget: { month_map: MonthMap } }>(
    queryKeys.budget(budgetId)
  )

  if (!budgetData) {
    console.warn('[mutationHelpers] Budget not in cache, skipping local recalculation')
    return
  }

  const monthMap = budgetData.budget.month_map
  const currentOrdinal = getYearMonthOrdinal(year, month)

  // Find all months from the edited month onwards (ordinal >= current)
  const monthsToRecalculate: Array<{ year: number; month: number }> = []
  for (const [ordinal] of Object.entries(monthMap)) {
    if (ordinal >= currentOrdinal) {
      // Parse ordinal back to year/month
      const year = parseInt(ordinal.substring(0, 4), 10)
      const month = parseInt(ordinal.substring(4, 6), 10)
      monthsToRecalculate.push({ year, month })
    }
  }

  // Sort chronologically
  monthsToRecalculate.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  // Recalculate each month in sequence (starting with the edited month) and track changes
  for (const { year: recalcYear, month: recalcMonth } of monthsToRecalculate) {
    try {
      await recalculateMonthLocally(budgetId, recalcYear, recalcMonth, queryClient)

      // Track this month as needing to be saved (it was recalculated)
      if (trackChange) {
        trackChange({ type: 'month', budgetId, year: recalcYear, month: recalcMonth })
      }
    } catch (error) {
      console.warn(
        `[mutationHelpers] Failed to recalculate month ${recalcYear}/${recalcMonth} locally:`,
        error
      )
      // Continue with other months even if one fails
    }
  }
}

/**
 * Hook that provides automatic change tracking for month mutations.
 * Use this in mutation hooks to get helpers that automatically track changes.
 *
 * This hook automatically handles:
 * - Cache updates with change tracking
 * - Local recalculation of future months
 *
 * Example:
 * ```ts
 * const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()
 *
 * // Update cache with new transaction
 * updateMonthCacheAndTrack(budgetId, year, month, updatedMonth)
 *
 * // Recalculate month, all future months, and budget - all in one call
 * await recalculateMonthAndCascade(budgetId, year, month)
 * ```
 */
export function useMonthMutationHelpers() {
  const { trackChange } = useSync()
  const { addLoadingHold, removeLoadingHold } = useApp()

  /**
   * Update month cache and automatically track the change.
   * This replaces the pattern of:
   * - queryClient.setQueryData(...)
   * - trackChange({ type: 'month', ... })
   */
  const updateMonthCacheAndTrack = (
    budgetId: string,
    year: number,
    month: number,
    monthData: MonthDocument
  ): void => {
    // Update cache
    queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: monthData })

    // Automatically track change
    trackChange({
      type: 'month',
      budgetId,
      year,
      month,
    })
  }

  /**
   * Recalculate a month and cascade all dependent calculations.
   *
   * This is the SINGLE method that handles ALL retotalling and recalculation:
   * 1. Retotals the edited month (for instant UI feedback from current transactions)
   * 2. Fully recalculates the edited month (updates start_balance from previous month)
   * 3. Fully recalculates all future months (cascading from the edited month)
   * 4. Recalculates budget account balances from all months in cache
   * 5. If editing before window, saves start_balance for months at/before window
   *
   * ALL retotalling and recalculation happens here - mutations should NOT call
   * retotalMonth or recalculateMonth directly. This ensures:
   * - One place to troubleshoot
   * - All calculations work on local cache data (fast, immediate)
   * - No steps are forgotten
   */
  const recalculateMonthAndCascade = async (
    budgetId: string,
    year: number,
    month: number,
    onLoadingChange?: (isLoading: boolean, message: string) => void
  ): Promise<void> => {
    // Create a loading callback that uses loading holds if no callback provided
    const loadingKey = 'recalculate-month-cascade'
    const handleLoadingChange = onLoadingChange || ((isLoading: boolean, message: string) => {
      if (isLoading) {
        addLoadingHold(loadingKey, message)
      } else {
        removeLoadingHold(loadingKey)
      }
    })
    // Step 1: Retotal the edited month first for instant UI feedback
    // This updates totals from current transactions without changing start_balance
    const monthKey = queryKeys.month(budgetId, year, month)
    const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)
    if (monthQueryData?.month) {
      const retotaledMonth = retotalMonth(monthQueryData.month)
      queryClient.setQueryData<MonthQueryData>(monthKey, { month: retotaledMonth })
    }

    // Step 2: Check if editing before first window month
    const firstWindowMonth = getFirstWindowMonth()
    const firstWindowOrdinal = getYearMonthOrdinal(firstWindowMonth.year, firstWindowMonth.month)
    const editedOrdinal = getYearMonthOrdinal(year, month)
    const isEditingBeforeWindow = editedOrdinal < firstWindowOrdinal

    // Step 3: Fully recalculate the edited month and all future months
    // This updates start_balance from previous month and ensures cascading is correct
    await recalculateFutureMonthsLocally(budgetId, year, month, trackChange)

    // Step 4: If editing before window, save start_balance for months at/before window
    if (isEditingBeforeWindow) {
      handleLoadingChange(true, 'Saving start balances...')
      try {
        // Get all months from edited month to first window month
        const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
        if (!budgetData) {
          console.warn('[mutationHelpers] Budget not in cache, skipping start_balance save')
          return
        }

        const monthMap = budgetData.monthMap || {}
        const monthsToSave: Array<{ year: number; month: number }> = []
        
        for (const [ordinal] of Object.entries(monthMap)) {
          if (ordinal >= editedOrdinal && ordinal <= firstWindowOrdinal) {
            const y = parseInt(ordinal.substring(0, 4), 10)
            const m = parseInt(ordinal.substring(4, 6), 10)
            monthsToSave.push({ year: y, month: m })
          }
        }

        // Sort chronologically
        monthsToSave.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

        // Save each month (converter will only save start_balance for months at/before window)
        for (const { year: saveYear, month: saveMonth } of monthsToSave) {
          const saveMonthKey = queryKeys.month(budgetId, saveYear, saveMonth)
          const saveMonthData = queryClient.getQueryData<MonthQueryData>(saveMonthKey)
          if (saveMonthData?.month) {
            const storedMonth = convertMonthBalancesToStored(saveMonthData.month)
            await writeMonthData({
              budgetId,
              month: storedMonth,
              description: `recalculation: saving start_balance for ${saveYear}/${saveMonth}`,
              updateMonthMap: false, // Don't update month_map - we're already recalculating
            })
          }
        }
      } catch (error) {
        console.error('[mutationHelpers] Failed to save start_balance for months at/before window:', error)
      } finally {
        handleLoadingChange(false, '')
      }
    }

    // Step 5: Ensure required months are in cache and fresh, then recalculate balances
    // This checks cache freshness and refetches if needed before recalculating
    // Always show loading overlay when refetching stale data
    try {
      await ensureMonthsFreshAndRecalculateBalances(budgetId, handleLoadingChange)
    } catch (error) {
      console.warn('[mutationHelpers] Failed to ensure months fresh and recalculate balances:', error)
    }

    // Track budget change (after both account and category balances are updated)
    trackChange({ type: 'budget', budgetId })
  }

  return {
    updateMonthCacheAndTrack,
    recalculateMonthAndCascade,
    trackChange, // Expose trackChange so mutations can use it for other changes
  }
}


