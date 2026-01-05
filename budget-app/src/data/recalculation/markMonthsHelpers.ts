/**
 * Helper functions for Mark Months Need Recalculation
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
 * The month_map now contains ALL months in the budget, not just the navigation window.
 * This allows us to derive earliest_month, latest_month, etc. from the map.
 * No cleanup is needed - all months are preserved.
 */
export function cleanupMonthMap(monthMap: MonthMap): MonthMap {
  // Return as-is - we now keep all months in the map
  return monthMap
}

/**
 * Check if the edited month AND all months after are already marked in cache.
 * Returns true only if the cache exists AND all relevant months are already marked.
 *
 * This optimization prevents unnecessary Firestore writes when the user
 * makes multiple edits to the same month in quick succession.
 */
export function areAllFutureMonthsAlreadyMarkedInCache(budgetId: string, editedMonthOrdinal: string): boolean {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (!cachedBudget?.monthMap) return false

  // Check if the edited month or any future month in the cache is NOT marked
  for (const [ordinal, info] of Object.entries(cachedBudget.monthMap)) {
    if (ordinal >= editedMonthOrdinal && !info.needs_recalculation) {
      return false // Found a month that needs marking
    }
  }

  return true // Edited month and all future months are already marked
}

/**
 * Update the cache to mark the budget and months as needing recalculation.
 */
export function updateCacheWithMarking(
  budgetId: string,
  _monthOrdinalToMark: string,
  updatedMonthMap: MonthMap
): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      isNeedsRecalculation: true,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        is_needs_recalculation: true,
        month_map: updatedMonthMap,
      },
    })
  }
}

/**
 * Update cache for setMonthInBudgetMap
 */
export function updateCacheWithMonth(budgetId: string, cleanedMonthMap: MonthMap): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      monthMap: cleanedMonthMap,
      budget: {
        ...cachedBudget.budget,
        month_map: cleanedMonthMap,
      },
    })
  }
}

/**
 * Update cache for markAllMonthsFromOrdinal
 */
export function updateCacheWithAllMonthsMarked(budgetId: string, updatedMonthMap: MonthMap): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      isNeedsRecalculation: true,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        is_needs_recalculation: true,
        month_map: updatedMonthMap,
      },
    })
  }
}

