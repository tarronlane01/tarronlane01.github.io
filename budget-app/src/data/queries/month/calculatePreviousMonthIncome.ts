/**
 * Calculate Previous Month Income
 *
 * Helper to calculate income from N months back for percentage-based allocations.
 * Checks cache first, then fetches from Firestore if needed.
 */

import type { MonthQueryData } from './readMonth'
import { queryKeys } from '@data/queryClient'
import { getMonthsBack, roundCurrency } from '@utils'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Get total income from the month that is `monthsBack` months before the given month.
 * E.g. monthsBack=1 → previous month; monthsBack=2 → two months ago.
 * Checks cache first, then fetches from Firestore if needed.
 * Returns 0 if target month doesn't exist or monthsBack < 1.
 */
export async function calculatePreviousMonthIncome(
  budgetId: string,
  year: number,
  month: number,
  queryClient?: QueryClient,
  monthsBack: number = 1
): Promise<number> {
  const target = getMonthsBack(year, month, monthsBack)
  if (!target) return 0

  const { year: targetYear, month: targetMonth } = target
  const targetMonthKey = queryKeys.month(budgetId, targetYear, targetMonth)

  // Try cache first
  if (queryClient) {
    const targetMonthQueryData = queryClient.getQueryData<MonthQueryData>(targetMonthKey)
    if (targetMonthQueryData?.month) {
      const targetIncome = targetMonthQueryData.month.income || []
      return roundCurrency(targetIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0))
    }
  }

  // Not in cache - use readMonth which respects cache and staleTime
  if (queryClient) {
    try {
      const { readMonth } = await import('./readMonth')
      const targetMonthDoc = await readMonth(budgetId, targetYear, targetMonth, {
        description: `calculating income ${monthsBack} month(s) back for ${year}/${month}`,
      })
      if (targetMonthDoc) {
        const targetIncome = targetMonthDoc.income || []
        return roundCurrency(targetIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0))
      }
    } catch (error) {
      console.warn(`[calculatePreviousMonthIncome] Could not fetch month ${targetYear}/${targetMonth}:`, error)
    }
  }

  return 0
}
