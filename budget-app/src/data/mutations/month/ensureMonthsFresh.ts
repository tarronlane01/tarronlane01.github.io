/**
 * Ensure Months Fresh and Recalculate Balances
 *
 * Ensures months needed for balance calculations are fresh in cache.
 * If any are stale or missing, refetches them, then recalculates balances.
 */

import { queryClient, queryKeys, STALE_TIME } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { MonthQueryData } from '@data/queries/month'
import { getYearMonthOrdinal } from '@utils'
import type { MonthMap } from '@types'
import { MAX_FUTURE_MONTHS } from '@constants'
import { readMonth } from '@data/queries/month'
import { recalculateBudgetAccountBalancesFromCache } from '@data/mutations/budget/accounts/recalculateBudgetAccountBalances'
import { recalculateBudgetCategoryBalancesFromCache } from '@data/mutations/budget/categories/recalculateBudgetCategoryBalances'

/**
 * Parse ordinal string to year/month
 */
function parseOrdinal(ordinal: string): { year: number; month: number } {
  return {
    year: parseInt(ordinal.substring(0, 4), 10),
    month: parseInt(ordinal.substring(4, 6), 10),
  }
}

/**
 * Check if months needed for balance calculations are fresh in cache.
 * Returns list of months that need to be refetched (stale or missing).
 */
function getMonthsNeedingRefetch(
  budgetId: string,
  monthMap: MonthMap
): Array<{ year: number; month: number; ordinal: string }> {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonth)

  // Calculate max future ordinal
  let maxFutureYear = currentYear
  let maxFutureMonth = currentMonth + MAX_FUTURE_MONTHS
  while (maxFutureMonth > 12) {
    maxFutureMonth -= 12
    maxFutureYear += 1
  }
  const maxFutureOrdinal = getYearMonthOrdinal(maxFutureYear, maxFutureMonth)

  const monthsNeedingRefetch: Array<{ year: number; month: number; ordinal: string }> = []
  const sortedOrdinals = Object.keys(monthMap).sort()

  // Check current month and all future months up to MAX_FUTURE_MONTHS
  for (const ordinal of sortedOrdinals) {
    if (ordinal < currentOrdinal) continue // Skip past months
    if (ordinal > maxFutureOrdinal) break // Stop at max future

    const { year, month } = parseOrdinal(ordinal)
    const monthKey = queryKeys.month(budgetId, year, month)
    const queryState = queryClient.getQueryState<MonthQueryData>(monthKey)

    // Check if month is missing or stale
    const isMissing = !queryState?.data
    const isStale = queryState?.dataUpdatedAt
      ? Date.now() - queryState.dataUpdatedAt > STALE_TIME
      : true

    if (isMissing || isStale) {
      monthsNeedingRefetch.push({ year, month, ordinal })
    }
  }

  return monthsNeedingRefetch
}

/**
 * Ensure months needed for balance calculations are fresh in cache.
 * If any are stale or missing, refetch them (with optional loading overlay).
 * Then recalculate both account and category balances from cache.
 * 
 * This function can be called from both mutation helpers and hooks.
 * 
 * @param budgetId - The budget ID
 * @param onLoadingChange - Optional callback for loading state changes
 * @param alwaysRecalculate - If true, always recalculate balances even if no months were refetched.
 *                            Set to true when called from mutations (we just updated local cache).
 *                            Set to false when called from navigation (don't overwrite correct cache).
 */
export async function ensureMonthsFreshAndRecalculateBalances(
  budgetId: string,
  onLoadingChange?: (isLoading: boolean, message: string) => void,
  alwaysRecalculate: boolean = true
): Promise<void> {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    console.warn('[ensureMonthsFreshAndRecalculateBalances] Budget not in cache')
    return
  }

  const monthMap = cachedBudget.monthMap || {}
  const monthsNeedingRefetch = getMonthsNeedingRefetch(budgetId, monthMap)

  // If no months need refetching and we're not forced to recalculate,
  // skip everything - the cache is already fresh from the mutation.
  if (monthsNeedingRefetch.length === 0 && !alwaysRecalculate) {
    return
  }

  // If months need refetching, do it with loading overlay
  if (monthsNeedingRefetch.length > 0) {
    onLoadingChange?.(true, `Refreshing ${monthsNeedingRefetch.length} month${monthsNeedingRefetch.length > 1 ? 's' : ''}...`)
    
    try {
      // Refetch all stale/missing months in parallel
      await Promise.all(
        monthsNeedingRefetch.map(({ year, month }) =>
          readMonth(budgetId, year, month, {
            description: `refreshing month ${year}/${month} for balance calculation`,
          })
        )
      )
    } finally {
      onLoadingChange?.(false, '')
    }
  }

  // Recalculate balances from cache
  // This updates budget cache with balances calculated from month cache data
  recalculateBudgetAccountBalancesFromCache(budgetId)
  await recalculateBudgetCategoryBalancesFromCache(budgetId)
}
