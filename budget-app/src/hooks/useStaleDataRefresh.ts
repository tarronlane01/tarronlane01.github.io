/**
 * Stale Data Refresh Hook
 *
 * Detects when cached data is stale and triggers a fresh initial load.
 * Also fetches the viewing month and adjacent months if they're outside
 * the normal window (3 months ago to current + all future).
 *
 * This handles scenarios like:
 * - User leaves app on a past month, returns an hour later
 * - Data needs to be refreshed for accurate balance calculations
 * - Viewing month is outside the initial load window and needs fetching
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import { getYearMonthOrdinal, getNextMonth, getPreviousMonth } from '@utils'
import { readMonthDirect } from '@data/queries/month/useMonthQuery'
import type { MonthQueryData } from '@data/queries/month'

// ============================================================================
// TYPES
// ============================================================================

interface UseStaleDataRefreshOptions {
  budgetId: string | null
  viewingYear: number
  viewingMonth: number
  initialDataLoadComplete: boolean
  enabled?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the window months ordinal threshold (3 months ago from current date).
 * Months at or after this ordinal are within the normal initial load window.
 * Returns string ordinal (e.g., "202510") for string comparison.
 */
function getWindowStartOrdinal(): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Calculate 3 months ago
  let threeMonthsAgoYear = currentYear
  let threeMonthsAgoMonth = currentMonth - 3
  while (threeMonthsAgoMonth <= 0) {
    threeMonthsAgoMonth += 12
    threeMonthsAgoYear -= 1
  }

  return getYearMonthOrdinal(threeMonthsAgoYear, threeMonthsAgoMonth)
}

/**
 * Check if a month is within the initial load window.
 * Uses string comparison which works for zero-padded ordinals.
 */
function isMonthInWindow(year: number, month: number): boolean {
  const monthOrdinal = getYearMonthOrdinal(year, month)
  const windowStartOrdinal = getWindowStartOrdinal()
  return monthOrdinal >= windowStartOrdinal
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook that detects stale cache and triggers fresh data loads.
 *
 * Features:
 * 1. On mount/visibility change: checks if initialDataLoad is stale and invalidates it
 * 2. After initial load: fetches viewing month + adjacent months if outside window
 * 3. Ensures smooth navigation even when starting from past months
 */
export function useStaleDataRefresh({
  budgetId,
  viewingYear,
  viewingMonth,
  initialDataLoadComplete,
  enabled = true,
}: UseStaleDataRefreshOptions) {
  const queryClient = useQueryClient()
  const hasRefreshedRef = useRef(false)
  const hasFetchedViewingContextRef = useRef<string | null>(null)

  // ==========================================================================
  // STALE DETECTION & INVALIDATION
  // ==========================================================================

  /**
   * Check if the initial data load cache is stale and invalidate if so.
   * Only runs after initial data load has completed at least once.
   */
  const checkAndRefreshIfStale = useCallback(() => {
    // Don't run until initial data load has completed at least once
    if (!budgetId || !enabled || !initialDataLoadComplete) return

    const initialLoadKey = ['initialDataLoad', budgetId]
    const queryState = queryClient.getQueryState(initialLoadKey)

    if (!queryState?.dataUpdatedAt) {
      // No data yet - let initial load handle it
      return
    }

    const isStale = Date.now() - queryState.dataUpdatedAt > STALE_TIME

    if (isStale && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true
      queryClient.invalidateQueries({ queryKey: initialLoadKey })
    }
  }, [budgetId, enabled, initialDataLoadComplete, queryClient])

  // Check when initial data load completes (handles returning to stale app)
  useEffect(() => {
    if (!initialDataLoadComplete) return
    checkAndRefreshIfStale()
  }, [initialDataLoadComplete, checkAndRefreshIfStale])

  // Check when tab becomes visible again
  useEffect(() => {
    if (!enabled || !initialDataLoadComplete) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset refresh flag when becoming visible to allow re-checking
        hasRefreshedRef.current = false
        checkAndRefreshIfStale()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, initialDataLoadComplete, checkAndRefreshIfStale])

  // Reset refresh flag when budget changes
  useEffect(() => {
    hasRefreshedRef.current = false
    hasFetchedViewingContextRef.current = null
  }, [budgetId])

  // ==========================================================================
  // VIEWING MONTH CONTEXT FETCH
  // ==========================================================================

  /**
   * After initial load completes, fetch viewing month + adjacent months
   * if they're outside the normal window.
   */
  useEffect(() => {
    if (!budgetId || !enabled || !initialDataLoadComplete) return

    // Check if viewing month is outside the window
    const viewingInWindow = isMonthInWindow(viewingYear, viewingMonth)
    if (viewingInWindow) {
      // Viewing month is in window, nothing extra to fetch
      return
    }

    // Create a key for this viewing context to avoid duplicate fetches
    const contextKey = `${budgetId}-${viewingYear}-${viewingMonth}`
    if (hasFetchedViewingContextRef.current === contextKey) {
      return
    }
    hasFetchedViewingContextRef.current = contextKey

    // Fetch viewing month + previous + next for smooth navigation
    const monthsToFetch = [
      { year: viewingYear, month: viewingMonth }, // Current viewing
      getPreviousMonth(viewingYear, viewingMonth), // Previous
      getNextMonth(viewingYear, viewingMonth), // Next
    ]

    // Prefetch all three months in parallel
    for (const { year, month } of monthsToFetch) {
      const monthKey = queryKeys.month(budgetId, year, month)
      const cachedData = queryClient.getQueryData<MonthQueryData>(monthKey)

      // Skip if already in cache and not stale
      if (cachedData) {
        const queryState = queryClient.getQueryState<MonthQueryData>(monthKey)
        const isStale = queryState?.dataUpdatedAt
          ? Date.now() - queryState.dataUpdatedAt > STALE_TIME
          : false
        if (!isStale) continue
      }

      // Prefetch the month
      queryClient
        .prefetchQuery({
          queryKey: monthKey,
          queryFn: async (): Promise<MonthQueryData | null> => {
            const monthData = await readMonthDirect(budgetId, year, month)
            if (!monthData) return null
            return { month: monthData }
          },
          staleTime: STALE_TIME,
        })
        .catch((error) => {
          console.warn(
            `[useStaleDataRefresh] Failed to prefetch month ${year}/${month}:`,
            error
          )
        })
    }
  }, [budgetId, enabled, initialDataLoadComplete, viewingYear, viewingMonth, queryClient])
}
