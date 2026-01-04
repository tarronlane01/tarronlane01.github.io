import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { MonthMap } from '@types'

interface UseMonthNavigationErrorOptions {
  monthError: Error | null
  currentYear: number
  currentMonthNumber: number
  lastActiveTab: string
  monthMap: MonthMap
}

/**
 * Get the earliest month from a month_map.
 */
function getEarliestMonthFromMap(monthMap: MonthMap): { year: number; month: number } | null {
  const ordinals = Object.keys(monthMap).sort()
  if (ordinals.length === 0) return null
  const earliest = ordinals[0]
  return {
    year: parseInt(earliest.slice(0, 4), 10),
    month: parseInt(earliest.slice(4, 6), 10),
  }
}

/**
 * Get the latest month from a month_map.
 */
function getLatestMonthFromMap(monthMap: MonthMap): { year: number; month: number } | null {
  const ordinals = Object.keys(monthMap).sort()
  if (ordinals.length === 0) return null
  const latest = ordinals[ordinals.length - 1]
  return {
    year: parseInt(latest.slice(0, 4), 10),
    month: parseInt(latest.slice(4, 6), 10),
  }
}

/**
 * Hook to handle month navigation errors and URL error params
 * Automatically redirects to valid months when navigation is out of bounds
 */
export function useMonthNavigationError({
  monthError,
  currentYear,
  currentMonthNumber,
  lastActiveTab,
  monthMap,
}: UseMonthNavigationErrorOptions) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Check for error message in URL params (from redirect)
  const urlError = searchParams.get('error')
  const [error, setError] = useState<string | null>(urlError)

  // Clear error param from URL after reading it
  useEffect(() => {
    if (urlError) {
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [urlError, searchParams, setSearchParams])

  // Handle month errors by redirecting to the budget's valid month range
  useEffect(() => {
    if (!monthError) return

    // Get budget's actual month range
    const earliest = getEarliestMonthFromMap(monthMap)
    const latest = getLatestMonthFromMap(monthMap)

    // If no months in budget, can't redirect - just show error
    // Use queueMicrotask to avoid synchronous setState in effect
    if (!earliest || !latest) {
      queueMicrotask(() => setError(`Error loading month: ${monthError.message}`))
      return
    }

    const errorMsg = monthError.message || ''

    // Handle any month creation/navigation errors by redirecting to nearest valid month
    if (errorMsg.includes('Refusing to create month') || errorMsg.includes('months in the')) {
      // Determine if we're before or after the valid range
      const currentOrdinal = `${currentYear}${String(currentMonthNumber).padStart(2, '0')}`
      const earliestOrdinal = `${earliest.year}${String(earliest.month).padStart(2, '0')}`
      const latestOrdinal = `${latest.year}${String(latest.month).padStart(2, '0')}`

      let targetYear: number
      let targetMonth: number

      if (currentOrdinal < earliestOrdinal) {
        // Before earliest - go to earliest
        targetYear = earliest.year
        targetMonth = earliest.month
      } else if (currentOrdinal > latestOrdinal) {
        // After latest - go to latest
        targetYear = latest.year
        targetMonth = latest.month
      } else {
        // Within range but month doesn't exist - go to latest
        targetYear = latest.year
        targetMonth = latest.month
      }

      const errorMessage = `Cannot navigate to ${currentYear}/${currentMonthNumber} - redirected to ${targetYear}/${targetMonth}`
      navigate(`/budget/${targetYear}/${targetMonth}/${lastActiveTab}?error=${encodeURIComponent(errorMessage)}`, { replace: true })
    }
  }, [monthError, currentYear, currentMonthNumber, lastActiveTab, monthMap, navigate, setError])

  return {
    error,
    setError,
  }
}

