/**
 * Month Prefetch Hook
 *
 * Prefetches the next month in the navigation direction when navigating between months.
 * This allows smooth navigation without loading overlays when moving sequentially.
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import { getNextMonth, getPreviousMonth, getYearMonthOrdinal } from '@utils'
import { readMonthDirect } from '@data/queries/month/useMonthQuery'
import type { MonthQueryData } from '@data/queries/month'
import type { BudgetData } from '@data/queries/budget/fetchBudget'

/**
 * Hook that prefetches the next month in the navigation direction.
 *
 * When navigating forward (next month), prefetches the month after that.
 * When navigating backward (previous month), prefetches the month before that.
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

    // Check if the month is already in cache
    const prefetchKey = queryKeys.month(budgetId, nextMonthToPrefetch.year, nextMonthToPrefetch.month)
    const cachedData = queryClient.getQueryData<MonthQueryData>(prefetchKey)

    // Only prefetch if not already in cache
    if (!cachedData) {
      // Check if month exists in month_map before prefetching
      const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      const monthOrdinal = getYearMonthOrdinal(nextMonthToPrefetch.year, nextMonthToPrefetch.month)
      const monthExistsInMap = budgetData?.monthMap && monthOrdinal in budgetData.monthMap

      // Only prefetch if month exists in month_map (don't create months during prefetch)
      if (monthExistsInMap) {
        // Prefetch in the background (doesn't block UI)
        // Use readMonthDirect to only read existing months, don't create
        queryClient.prefetchQuery({
          queryKey: prefetchKey,
          queryFn: async (): Promise<MonthQueryData | null> => {
            const monthData = await readMonthDirect(budgetId, nextMonthToPrefetch.year, nextMonthToPrefetch.month)
            if (!monthData) {
              // Month doesn't exist - return null (query will handle this)
              return null
            }
            return { month: monthData }
          },
          staleTime: STALE_TIME,
        }).catch(error => {
          // Silently fail - prefetch is just an optimization
          console.warn(`[useMonthPrefetch] Failed to prefetch month ${nextMonthToPrefetch.year}/${nextMonthToPrefetch.month}:`, error)
        })
      }
      // If month doesn't exist in month_map, skip prefetch (don't create it)
    }

    // Update refs for next comparison
    prevYearRef.current = currentYear
    prevMonthRef.current = currentMonth
  }, [budgetId, currentYear, currentMonth, queryClient])
}

