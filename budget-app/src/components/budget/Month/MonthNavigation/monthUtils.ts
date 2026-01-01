/**
 * Month navigation utility functions
 */

import { getYearMonthOrdinal } from '@utils'
import type { MonthMap } from '@types'

/**
 * Get the maximum allowed month (3 months from now)
 */
export function getMaxAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1 + 3 // 3 months ahead

  while (month > 12) {
    month -= 12
    year += 1
  }

  return { year, month }
}

/**
 * Get the minimum allowed month (3 months ago)
 */
export function getMinAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1 - 3 // 3 months back

  while (month < 1) {
    month += 12
    year -= 1
  }

  return { year, month }
}

/**
 * Check if a month is too far in the past (more than 3 months)
 */
export function isMonthTooFarInPast(year: number, month: number): boolean {
  const minAllowed = getMinAllowedMonth()
  return (year < minAllowed.year) ||
    (year === minAllowed.year && month < minAllowed.month)
}

/**
 * Check if a month is too far in the future (more than 3 months)
 */
export function isMonthTooFarInFuture(year: number, month: number): boolean {
  const maxAllowed = getMaxAllowedMonth()
  return (year > maxAllowed.year) ||
    (year === maxAllowed.year && month > maxAllowed.month)
}

/**
 * Check if a month already exists in the budget's month_map
 */
export function monthExistsInMap(year: number, month: number, monthMap: MonthMap): boolean {
  const ordinal = getYearMonthOrdinal(year, month)
  return ordinal in monthMap
}

/**
 * Get the previous month (year, month)
 */
export function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

/**
 * Get the next month (year, month)
 */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }
  return { year, month: month + 1 }
}

