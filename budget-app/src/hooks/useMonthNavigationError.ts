import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

interface UseMonthNavigationErrorOptions {
  monthError: Error | null
  currentYear: number
  currentMonthNumber: number
  lastActiveTab: string
}

/**
 * Calculates the maximum allowed month (3 months in the future)
 */
function getMaxAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let maxYear = now.getFullYear()
  let maxMonth = now.getMonth() + 1 + 3
  while (maxMonth > 12) {
    maxMonth -= 12
    maxYear += 1
  }
  return { year: maxYear, month: maxMonth }
}

/**
 * Calculates the minimum allowed month (3 months in the past)
 */
function getMinAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let minYear = now.getFullYear()
  let minMonth = now.getMonth() + 1 - 3
  while (minMonth < 1) {
    minMonth += 12
    minYear -= 1
  }
  return { year: minYear, month: minMonth }
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

  // Handle month errors by redirecting to valid month
  useEffect(() => {
    if (!monthError) return
    const errorMsg = monthError.message || ''

    // Handle months too far in the future
    if (errorMsg.includes('months in the future') || errorMsg.includes('Refusing to create month')) {
      const { year: maxYear, month: maxMonth } = getMaxAllowedMonth()
      const errorMessage = `Cannot navigate to ${currentYear}/${currentMonthNumber} - redirected to ${maxYear}/${maxMonth}`
      navigate(`/budget/${maxYear}/${maxMonth}/${lastActiveTab}?error=${encodeURIComponent(errorMessage)}`, { replace: true })
      return
    }

    // Handle months too far in the past
    if (errorMsg.includes('months in the past')) {
      const { year: minYear, month: minMonth } = getMinAllowedMonth()
      const errorMessage = `Cannot create month ${currentYear}/${currentMonthNumber} - redirected to ${minYear}/${minMonth}`
      navigate(`/budget/${minYear}/${minMonth}/${lastActiveTab}?error=${encodeURIComponent(errorMessage)}`, { replace: true })
    }
  }, [monthError, currentYear, currentMonthNumber, lastActiveTab, navigate])

  return {
    error,
    setError,
  }
}

