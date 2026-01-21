/**
 * Helper functions for Month Map Management
 */

import type { MonthMap } from '@types'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import { getYearMonthOrdinal } from '@utils'
import { MAX_FUTURE_MONTHS, MAX_PAST_MONTHS } from '@constants'

/**
 * Get the month window (MAX_PAST_MONTHS past, current, MAX_FUTURE_MONTHS future) ordinals.
 */
export function getMonthWindowOrdinals(): string[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  const ordinals: string[] = []

  // Past months
  for (let i = MAX_PAST_MONTHS; i > 0; i--) {
    let year = currentYear
    let month = currentMonth - i
    while (month < 1) {
      month += 12
      year -= 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  // Current month
  ordinals.push(getYearMonthOrdinal(currentYear, currentMonth))

  // Future months
  for (let i = 1; i <= MAX_FUTURE_MONTHS; i++) {
    let year = currentYear
    let month = currentMonth + i
    while (month > 12) {
      month -= 12
      year += 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  return ordinals
}

/**
 * Check if all future months are already in the month_map.
 * Returns true only if the cache exists AND all relevant months are in the map.
 *
 * This optimization prevents unnecessary Firestore writes when the user
 * makes multiple edits to the same month in quick succession.
 */
export function areAllFutureMonthsInCache(budgetId: string, editedMonthOrdinal: string): boolean {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (!cachedBudget?.monthMap) return false

  // CRITICAL: Always check if the edited month itself is in the map
  // This prevents gaps when writing months outside the window
  if (!(editedMonthOrdinal in cachedBudget.monthMap)) {
    return false // Edited month is missing
  }

  // Check if any future month in the cache is NOT in the map
  const windowOrdinals = getMonthWindowOrdinals()
  for (const ordinal of windowOrdinals) {
    if (ordinal >= editedMonthOrdinal && !(ordinal in cachedBudget.monthMap)) {
      return false // Found a month that needs to be added
    }
  }

  return true // Edited month and all future months are already in the map
}

/**
 * Update the cache with updated month_map.
 */
export function updateCacheWithMonthMap(
  budgetId: string,
  _monthOrdinal: string,
  updatedMonthMap: MonthMap
): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        month_map: updatedMonthMap,
      },
    })
  }
}

/**
 * Update cache for addMonthToMap
 * Optionally tracks the budget change for background save.
 */
export function updateCacheWithSingleMonth(
  budgetId: string,
  updatedMonthMap: MonthMap,
  trackChange?: (change: { type: 'budget'; budgetId: string }) => void
): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        month_map: updatedMonthMap,
      },
    })

    // Track change for background save if callback provided
    if (trackChange) {
      trackChange({ type: 'budget', budgetId })
    }
  }
}

/**
 * Update cache for addAllMonthsFromOrdinal
 */
export function updateCacheWithAllMonths(budgetId: string, updatedMonthMap: MonthMap): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        month_map: updatedMonthMap,
      },
    })
  }
}

/**
 * Remove a month from the budget's month_map.
 * Updates cache immediately and optionally tracks the budget change for background save.
 */
export function removeMonthFromMap(
  budgetId: string,
  year: number,
  month: number,
  trackChange?: (change: { type: 'budget'; budgetId: string }) => void
): MonthMap {
  const monthOrdinal = getYearMonthOrdinal(year, month)
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (!cachedBudget) {
    console.warn(`[removeMonthFromMap] Budget ${budgetId} not found in cache`)
    return {}
  }

  const existingMonthMap: MonthMap = cachedBudget.monthMap || {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [monthOrdinal]: _removed, ...updatedMonthMap } = existingMonthMap

  // Update cache immediately
  queryClient.setQueryData<BudgetData>(budgetKey, {
    ...cachedBudget,
    monthMap: updatedMonthMap,
    budget: {
      ...cachedBudget.budget,
      month_map: updatedMonthMap,
    },
  })

  // Track change for background save if callback provided
  if (trackChange) {
    trackChange({ type: 'budget', budgetId })
  }

  return updatedMonthMap
}
