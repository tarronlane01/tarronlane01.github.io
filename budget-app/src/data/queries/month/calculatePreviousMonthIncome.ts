/**
 * Calculate Previous Month Income
 *
 * Helper to calculate income from N months back for percentage-based allocations.
 * Checks cache first, then reads raw Firestore doc for income only (no cascade).
 *
 * IMPORTANT: When the target month is not in cache, we read the raw document and
 * sum the income array only. We do NOT call readMonth/parseMonthData for the target,
 * because that would recursively compute that month's previous_month_income and
 * cascade to load all months back in time (one read per N months).
 */

import type { MonthQueryData } from './readMonth'
import { queryKeys } from '@data/queryClient'
import { getMonthsBack, getMonthDocId, roundCurrency } from '@utils'
import { readDocByPath } from '@firestore'
import type { QueryClient } from '@tanstack/react-query'
import type { FirestoreData } from '@types'

/**
 * Get total income from the month that is `monthsBack` months before the given month.
 * E.g. monthsBack=1 → previous month; monthsBack=2 → two months ago.
 * Checks cache first, then reads raw doc for income only (avoids cascade).
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

  // Not in cache - read raw doc and sum income only (do NOT call readMonth;
  // that would parse the full doc and recursively compute previous_month_income,
  // cascading to load every N months back in time)
  try {
    const monthDocId = getMonthDocId(budgetId, targetYear, targetMonth)
    const { exists, data } = await readDocByPath<FirestoreData>(
      'months',
      monthDocId,
      `[calculatePreviousMonthIncome] income ${monthsBack} month(s) back for ${year}/${month}`
    )
    if (exists && data?.income) {
      const income = data.income as Array<{ amount?: number }>
      return roundCurrency(income.reduce((sum, inc) => sum + (inc.amount || 0), 0))
    }
  } catch (error) {
    console.warn(`[calculatePreviousMonthIncome] Could not read month ${targetYear}/${targetMonth}:`, error)
  }

  return 0
}
