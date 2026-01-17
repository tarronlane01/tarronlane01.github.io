/**
 * useAutoRecalculation Hook
 *
 * Automatically triggers recalculation when navigating to a month that needs it.
 * Only runs on navigation (when month/year changes), not on cache updates.
 *
 * Usage:
 *   const { recalcProgress } = useAutoRecalculation({
 *     budgetId: selectedBudgetId,
 *     year: currentYear,
 *     month: currentMonthNumber,
 *     monthMap,
 *     // Optional: require month to be loaded before checking
 *     requireMonthLoaded: true,
 *     currentMonth: monthData,
 *     // Optional: track progress
 *     onProgress: (progress) => setRecalcProgress(progress),
 *   })
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { triggerRecalculation, type RecalculationProgress } from '@data/recalculation'
import { getMonthsNeedingRecalc } from '@data/recalculation/triggerRecalculationHelpers'
import { queryClient } from '@data/queryClient'
import { getYearMonthOrdinal } from '@utils'
import { useApp } from '@contexts'
import type { MonthMap } from '@types'
import type { MonthDocument } from '@types'

interface UseAutoRecalculationOptions {
  /** Budget ID */
  budgetId: string | null
  /** Year to check (required if checkAnyMonth is false) */
  year?: number
  /** Month to check (1-12) (required if checkAnyMonth is false) */
  month?: number
  /** Month map from budget data */
  monthMap: MonthMap
  /** If true, check if ANY month needs recalculation and trigger for the earliest one */
  checkAnyMonth?: boolean
  /** Optional: Require month document to be loaded before checking */
  requireMonthLoaded?: boolean
  /** Optional: Current month document (required if requireMonthLoaded is true) */
  currentMonth?: MonthDocument | null
  /** Optional: Additional condition that must be met (e.g., budget loaded) */
  additionalCondition?: boolean
  /** Optional: Callback to track recalculation progress */
  onProgress?: (progress: RecalculationProgress) => void
  /** Optional: Custom error handler (defaults to console.error) */
  onError?: (error: Error) => void
  /** Optional: Custom log prefix for error messages */
  logPrefix?: string
}

interface UseAutoRecalculationReturn {
  /** Current recalculation progress (null if not in progress) */
  recalcProgress: RecalculationProgress | null
  /** Whether recalculation is currently in progress */
  isRecalculating: boolean
}

function getRecalcProgressMessage(progress: RecalculationProgress): string {
  switch (progress.phase) {
    case 'reading-budget':
      return 'Reading budget data...'
    case 'fetching-months':
      if (progress.totalMonthsToFetch) {
        return `Loading ${progress.totalMonthsToFetch} months...`
      }
      return 'Loading months...'
    case 'recalculating':
      if (progress.currentMonth) {
        return `Recalculating ${progress.currentMonth}...`
      }
      return 'Recalculating balances...'
    case 'saving':
      if (progress.totalMonths) {
        return `Saving ${progress.totalMonths} months...`
      }
      return 'Saving results...'
    case 'complete':
      return 'Recalculation complete!'
    default:
      return 'Recalculating...'
  }
}

export function useAutoRecalculation({
  budgetId,
  year,
  month,
  monthMap,
  checkAnyMonth = false,
  requireMonthLoaded = false,
  currentMonth,
  additionalCondition = true,
  onProgress,
  onError,
  logPrefix = '[AutoRecalc]',
}: UseAutoRecalculationOptions): UseAutoRecalculationReturn {
  const [recalcProgress, setRecalcProgress] = useState<RecalculationProgress | null>(null)
  const recalcInProgressRef = useRef(false)
  const checkedMonthRef = useRef<string | null>(null)
  const lastMonthKeyRef = useRef<string | null>(null)
  const location = useLocation()
  const lastLocationRef = useRef<string | null>(null)
  const { addLoadingHold, removeLoadingHold } = useApp()

  useEffect(() => {
    // Check prerequisites
    if (!budgetId || !additionalCondition) return
    if (requireMonthLoaded && !currentMonth) return

    let monthKey: string
    let triggeringMonthOrdinal: string

    const locationKey = location.pathname

    if (checkAnyMonth) {
      // Reset checked ref if location changed (navigation to/from page)
      if (lastLocationRef.current !== locationKey) {
        checkedMonthRef.current = null
        lastLocationRef.current = locationKey
      }

      // Check if ANY month needs recalculation
      const monthsNeedingRecalc = getMonthsNeedingRecalc(monthMap)
      if (monthsNeedingRecalc.length === 0 || recalcInProgressRef.current) {
        return
      }

      // Use the earliest month that needs recalculation
      const earliestOrdinal = monthsNeedingRecalc[0]
      monthKey = `any-${earliestOrdinal}`

      // Skip if we've already checked (prevents re-running on cache updates)
      if (checkedMonthRef.current === monthKey) return

      triggeringMonthOrdinal = earliestOrdinal
    } else {
      // Check specific month
      if (year === undefined || month === undefined) {
        console.warn(`${logPrefix} year and month are required when checkAnyMonth is false`)
        return
      }

      const currentMonthOrdinal = getYearMonthOrdinal(year, month)
      const monthNeedsRecalc = monthMap[currentMonthOrdinal]?.needs_recalculation === true

      monthKey = `${year}-${month}`

      // Reset checked ref if location changed (navigation to/from page) or month/year changed
      if (lastLocationRef.current !== locationKey || lastMonthKeyRef.current !== monthKey) {
        checkedMonthRef.current = null
        lastLocationRef.current = locationKey
        lastMonthKeyRef.current = monthKey
      }

      // Skip if we've already checked this month (prevents re-running on cache updates)
      if (checkedMonthRef.current === monthKey) return

      // Check if this month needs recalculation
      if (!monthNeedsRecalc || recalcInProgressRef.current) {
        checkedMonthRef.current = monthKey
        return
      }

      triggeringMonthOrdinal = `${year}${String(month).padStart(2, '0')}`
    }

    recalcInProgressRef.current = true
    checkedMonthRef.current = monthKey

    // Add global loading overlay
    const loadingKey = `recalc-${budgetId}`
    addLoadingHold(loadingKey, 'Recalculating balances...')

    const handleProgress = (progress: RecalculationProgress) => {
      setRecalcProgress(progress)
      // Update global loading message based on progress
      const message = getRecalcProgressMessage(progress)
      addLoadingHold(loadingKey, message)
      onProgress?.(progress)
    }

    triggerRecalculation(budgetId, {
      triggeringMonthOrdinal,
      onProgress: handleProgress,
    })
      .then(() => {
        // Invalidate all month queries since recalculation affects multiple months
        queryClient.invalidateQueries({ queryKey: ['month', budgetId] })
      })
      .catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err))
        if (onError) {
          onError(error)
        } else {
          console.error(`${logPrefix} Recalculation failed:`, error)
        }
      })
      .finally(() => {
        recalcInProgressRef.current = false
        setRecalcProgress(null)
        removeLoadingHold(loadingKey)
      })
  }, [
    budgetId,
    year,
    month,
    monthMap,
    checkAnyMonth,
    requireMonthLoaded,
    currentMonth,
    additionalCondition,
    onProgress,
    onError,
    logPrefix,
    location.pathname,
    addLoadingHold,
    removeLoadingHold,
  ])

  return {
    recalcProgress,
    isRecalculating: recalcProgress !== null,
  }
}

