/**
 * Window utilities for determining which months are in the initial load window.
 * 
 * Window = last 3 months + current calendar month + all future months
 * Window is based on current calendar month, not the month being edited.
 */

import { getYearMonthOrdinal } from '@utils'
import { MAX_PAST_MONTHS } from '@constants'

/**
 * Get the first month in the window (earliest month that should have start_balance saved).
 * This is 3 months before the current calendar month.
 */
export function getFirstWindowMonth(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Calculate MAX_PAST_MONTHS (3) months ago
  let firstWindowYear = currentYear
  let firstWindowMonth = currentMonth - MAX_PAST_MONTHS
  while (firstWindowMonth < 1) {
    firstWindowMonth += 12
    firstWindowYear -= 1
  }

  return { year: firstWindowYear, month: firstWindowMonth }
}

/**
 * Get the first window month ordinal.
 */
export function getFirstWindowMonthOrdinal(): string {
  const { year, month } = getFirstWindowMonth()
  return getYearMonthOrdinal(year, month)
}

/**
 * Check if a month is at or before the first month in the window.
 * Months at/before the first window month should have start_balance saved.
 * 
 * @param year - Year to check
 * @param month - Month to check (1-12)
 * @returns true if month is at or before first window month
 */
export function isMonthAtOrBeforeWindow(year: number, month: number): boolean {
  const firstWindow = getFirstWindowMonth()
  const monthOrdinal = getYearMonthOrdinal(year, month)
  const firstWindowOrdinal = getYearMonthOrdinal(firstWindow.year, firstWindow.month)
  return monthOrdinal <= firstWindowOrdinal
}

/**
 * Check if a month is after the first month in the window.
 * Months after the first window month should NOT have start_balance saved.
 * 
 * @param year - Year to check
 * @param month - Month to check (1-12)
 * @returns true if month is after first window month
 */
export function isMonthAfterWindow(year: number, month: number): boolean {
  return !isMonthAtOrBeforeWindow(year, month)
}
