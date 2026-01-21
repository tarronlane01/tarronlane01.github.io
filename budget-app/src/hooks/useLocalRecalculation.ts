/**
 * Local Recalculation Hook
 *
 * Provides functions to recalculate months locally and update the cache immediately.
 * This allows users to see changes instantly without waiting for Firestore saves.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { queryKeys } from '@data/queryClient'
import { recalculateMonth, extractSnapshotFromMonth, type PreviousMonthSnapshot, EMPTY_SNAPSHOT } from '@data/recalculation'
import { readMonth } from '@data/queries/month'
import type { MonthDocument } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { getPreviousMonth } from '@utils'

/**
 * Recalculate a single month locally and update the cache.
 * If the previous month is not in cache, it will be fetched.
 *
 * @param budgetId - The budget ID
 * @param year - The year to recalculate
 * @param month - The month to recalculate (1-12)
 * @param queryClient - React Query client
 */
export async function recalculateMonthLocally(
  budgetId: string,
  year: number,
  month: number,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<MonthDocument> {
  const monthKey = queryKeys.month(budgetId, year, month)
  const monthQueryData = queryClient.getQueryData<MonthQueryData>(monthKey)

  if (!monthQueryData?.month) {
    throw new Error(`Month ${year}/${month} not found in cache`)
  }

  const currentMonth = monthQueryData.month

  // Get previous month snapshot
  const prevMonthSnapshot = await getPreviousMonthSnapshot(
    budgetId,
    year,
    month,
    queryClient
  )

  // Recalculate
  const recalculated = recalculateMonth(currentMonth, prevMonthSnapshot)

  // Update cache immediately
  queryClient.setQueryData<MonthQueryData>(monthKey, { month: recalculated })

  return recalculated
}

/**
 * Recalculate multiple months in sequence (for cascading recalculation).
 * Each month uses the previous month's end balances as its start balances.
 *
 * @param budgetId - The budget ID
 * @param months - Array of {year, month} to recalculate in order
 * @param queryClient - React Query client
 */
export async function recalculateMonthsLocally(
  budgetId: string,
  months: Array<{ year: number; month: number }>,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<MonthDocument[]> {
  const results: MonthDocument[] = []

  for (const { year, month } of months) {
    const recalculated = await recalculateMonthLocally(budgetId, year, month, queryClient)
    results.push(recalculated)
  }

  return results
}

/**
 * Get the previous month's snapshot for recalculation.
 * If the previous month is not in cache, it will be fetched from Firestore.
 */
async function getPreviousMonthSnapshot(
  budgetId: string,
  year: number,
  month: number,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<PreviousMonthSnapshot> {
  const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month)
  const prevMonthKey = queryKeys.month(budgetId, prevYear, prevMonth)
  const prevMonthQueryData = queryClient.getQueryData<MonthQueryData>(prevMonthKey)

  if (prevMonthQueryData?.month) {
    // Previous month is in cache - extract snapshot
    return extractSnapshotFromMonth(prevMonthQueryData.month)
  }

  // Previous month not in cache - try to fetch it using readMonth (respects cache freshness)
  try {
    const prevMonthDoc = await readMonth(budgetId, prevYear, prevMonth, {
      description: `fetching previous month ${prevYear}/${prevMonth} for recalculation`,
    })
    if (prevMonthDoc) {
      // readMonth already caches the data via fetchQuery, so we don't need to manually cache it
      return extractSnapshotFromMonth(prevMonthDoc)
    }
  } catch (error) {
    console.warn(`[useLocalRecalculation] Could not fetch previous month ${prevYear}/${prevMonth}:`, error)
  }

  // No previous month found - use empty snapshot
  return EMPTY_SNAPSHOT
}

/**
 * Hook for local recalculation functions
 */
export function useLocalRecalculation() {
  const queryClient = useQueryClient()

  const recalculateMonth = useCallback(
    async (budgetId: string, year: number, month: number) => {
      return recalculateMonthLocally(budgetId, year, month, queryClient)
    },
    [queryClient]
  )

  const recalculateMonths = useCallback(
    async (budgetId: string, months: Array<{ year: number; month: number }>) => {
      return recalculateMonthsLocally(budgetId, months, queryClient)
    },
    [queryClient]
  )

  return {
    recalculateMonth,
    recalculateMonths,
  }
}

