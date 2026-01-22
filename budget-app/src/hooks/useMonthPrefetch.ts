/**
 * Month Prefetch Hook
 *
 * Prefetches months to enable smooth navigation:
 * 1. On initial mount: prefetches the NEXT month (so forward navigation is instant)
 * 2. On navigation: prefetches the next month in the navigation direction
 *
 * This ensures:
 * - When landing on any month, the next month is ready
 * - When navigating forward, each subsequent next month is prefetched
 * - When navigating backward, each subsequent previous month is prefetched
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import { getNextMonth, getPreviousMonth, getYearMonthOrdinal } from '@utils'
import { readMonthDirect } from '@data/queries/month/useMonthQuery'
import type { MonthQueryData } from '@data/queries/month'
import type { BudgetData } from '@data/queries/budget/fetchBudget'

/**
 * Hook that prefetches months for smooth navigation.
 *
 * Features:
 * 1. Proactive next month prefetch: Always ensures the next month is ready
 * 2. Direction-aware prefetch: Prefetches in the navigation direction after movement
 *
 * This ensures smooth navigation when moving sequentially through months.
 */
export function useMonthPrefetch(
  budgetId: string | null,
  currentYear: number,
  currentMonth: number
) {
  const queryClient = useQueryClient()
  const prevYearRef = useRef<number | null>(null)
  const prevMonthRef = useRef<number | null>(null)
  const hasInitialPrefetchedRef = useRef<string | null>(null)

  /**
   * Prefetch a specific month if it exists in monthMap and isn't cached.
   */
  const prefetchMonth = useCallback(
    (year: number, month: number) => {
      if (!budgetId) return

      const prefetchKey = queryKeys.month(budgetId, year, month)
      const cachedData = queryClient.getQueryData<MonthQueryData>(prefetchKey)

      // Skip if already in cache
      if (cachedData) return

      // Check if month exists in month_map before prefetching
      const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      const monthOrdinal = getYearMonthOrdinal(year, month)
      const monthExistsInMap = budgetData?.monthMap && monthOrdinal in budgetData.monthMap

      // Only prefetch if month exists in month_map (don't create months during prefetch)
      if (!monthExistsInMap) return

      // Prefetch in the background (doesn't block UI)
      queryClient
        .prefetchQuery({
          queryKey: prefetchKey,
          queryFn: async (): Promise<MonthQueryData | null> => {
            const monthData = await readMonthDirect(budgetId, year, month)
            if (!monthData) {
              return null
            }
            return { month: monthData }
          },
          staleTime: STALE_TIME,
        })
        .catch((error) => {
          console.warn(
            `[useMonthPrefetch] Failed to prefetch month ${year}/${month}:`,
            error
          )
        })
    },
    [budgetId, queryClient]
  )

  // ==========================================================================
  // PROACTIVE NEXT MONTH PREFETCH (on mount or when landing on new month)
  // ==========================================================================
  // Always ensure the next month is prefetched so forward navigation is instant.
  // This handles cases like: user starts on a past month and wants to work forward.
  useEffect(() => {
    if (!budgetId) return

    // Track which month we've already done the initial prefetch for
    const currentKey = `${budgetId}-${currentYear}-${currentMonth}`
    if (hasInitialPrefetchedRef.current === currentKey) return
    hasInitialPrefetchedRef.current = currentKey

    // Prefetch the next month proactively
    const nextMonth = getNextMonth(currentYear, currentMonth)
    prefetchMonth(nextMonth.year, nextMonth.month)
  }, [budgetId, currentYear, currentMonth, prefetchMonth])

  // ==========================================================================
  // DIRECTION-AWARE PREFETCH (on navigation)
  // ==========================================================================
  // When user navigates, prefetch the next month in that direction.
  useEffect(() => {
    // Skip on initial mount
    if (prevYearRef.current === null || prevMonthRef.current === null) {
      prevYearRef.current = currentYear
      prevMonthRef.current = currentMonth
      return
    }

    // Skip if month hasn't changed
    if (prevYearRef.current === currentYear && prevMonthRef.current === currentMonth) {
      return
    }

    if (!budgetId) {
      prevYearRef.current = currentYear
      prevMonthRef.current = currentMonth
      return
    }

    // Determine navigation direction
    const prevOrdinal = getYearMonthOrdinal(prevYearRef.current, prevMonthRef.current)
    const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonth)
    const isForward = currentOrdinal > prevOrdinal

    // Calculate the next month to prefetch in the same direction
    const nextMonthToPrefetch = isForward
      ? getNextMonth(currentYear, currentMonth)
      : getPreviousMonth(currentYear, currentMonth)

    prefetchMonth(nextMonthToPrefetch.year, nextMonthToPrefetch.month)

    // Update refs for next comparison
    prevYearRef.current = currentYear
    prevMonthRef.current = currentMonth
  }, [budgetId, currentYear, currentMonth, prefetchMonth])
}

