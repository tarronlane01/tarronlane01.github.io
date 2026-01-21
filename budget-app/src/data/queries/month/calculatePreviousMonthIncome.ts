/**
 * Calculate Previous Month Income
 *
 * Helper to calculate previous_month_income from the previous month's income array.
 * Checks cache first, then fetches from Firestore if needed.
 */

import type { MonthQueryData } from './readMonth'
import { queryKeys } from '@data/queryClient'
import { getPreviousMonth, getMonthDocId, roundCurrency } from '@utils'
import { readDocByPath } from '@firestore'
import type { FirestoreData } from '@types'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Get previous month's total income.
 * Checks cache first, then fetches from Firestore if needed.
 * Returns 0 if previous month doesn't exist.
 */
export async function calculatePreviousMonthIncome(
  budgetId: string,
  year: number,
  month: number,
  queryClient?: QueryClient
): Promise<number> {
  const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month)
  const prevMonthKey = queryKeys.month(budgetId, prevYear, prevMonth)

  // Try cache first
  if (queryClient) {
    const prevMonthQueryData = queryClient.getQueryData<MonthQueryData>(prevMonthKey)
    if (prevMonthQueryData?.month) {
      // Previous month is in cache - calculate from income array
      const prevIncome = prevMonthQueryData.month.income || []
      return roundCurrency(prevIncome.reduce((sum, inc) => sum + (inc.amount || 0), 0))
    }
  }

  // Not in cache - try to fetch from Firestore
  try {
    const prevMonthDocId = getMonthDocId(budgetId, prevYear, prevMonth)
    const { exists, data } = await readDocByPath<FirestoreData>(
      'months',
      prevMonthDocId,
      `calculating previous_month_income for ${year}/${month}`
    )

    if (exists && data) {
      // Cache it for future use
      if (queryClient) {
        // We could cache the full month, but for now just return the income
        // The full month will be cached when it's actually read
      }

      // Calculate from income array
      const income = data.income || []
      return roundCurrency(income.reduce((sum: number, inc: { amount: number }) => sum + (inc.amount || 0), 0))
    }
  } catch (error) {
    // If we can't fetch previous month, default to 0
    console.warn(`[calculatePreviousMonthIncome] Could not fetch previous month ${prevYear}/${prevMonth}:`, error)
  }

  // No previous month found - return 0
  return 0
}
