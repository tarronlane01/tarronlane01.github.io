/**
 * Month navigation utility functions
 */

import { getYearMonthOrdinal } from '@utils'
import { MAX_FUTURE_MONTHS, MAX_PAST_MONTHS } from '@constants'
import type { MonthMap } from '@types'

/**
 * Get the maximum allowed month (MAX_FUTURE_MONTHS from now)
 */
export function getMaxAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1 + MAX_FUTURE_MONTHS

  while (month > 12) {
    month -= 12
    year += 1
  }

  return { year, month }
}

/**
 * Get the minimum allowed month (MAX_PAST_MONTHS ago by default)
 */
export function getMinAllowedMonth(): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1 - MAX_PAST_MONTHS

  while (month < 1) {
    month += 12
    year -= 1
  }

  return { year, month }
}

/**
 * Get the earliest month from a month_map.
 * Returns the smallest ordinal key from the map.
 */
export function getEarliestMonthFromMap(monthMap: MonthMap): string | undefined {
  const ordinals = Object.keys(monthMap).sort()
  return ordinals[0]
}

/**
 * Get the latest month from a month_map.
 * Returns the largest ordinal key from the map.
 */
export function getLatestMonthFromMap(monthMap: MonthMap): string | undefined {
  const ordinals = Object.keys(monthMap).sort()
  return ordinals[ordinals.length - 1]
}

/**
 * Parse an ordinal string (YYYYMM) into year and month.
 */
function parseOrdinal(ordinal: string): { year: number; month: number } {
  const year = parseInt(ordinal.slice(0, 4), 10)
  const month = parseInt(ordinal.slice(4, 6), 10)
  return { year, month }
}

/**
 * Get the effective minimum month, considering the month_map from budget.
 * If there are months earlier than MAX_PAST_MONTHS ago in the map, use the earliest.
 *
 * @param monthMap - The month_map from the budget
 * @returns The effective minimum year/month
 */
export function getEffectiveMinMonth(monthMap: MonthMap): { year: number; month: number } {
  const defaultMin = getMinAllowedMonth()
  const earliestOrdinal = getEarliestMonthFromMap(monthMap)

  if (!earliestOrdinal) {
    return defaultMin
  }

  // Return the earlier of the two
  const defaultOrdinal = getYearMonthOrdinal(defaultMin.year, defaultMin.month)
  if (earliestOrdinal < defaultOrdinal) {
    return parseOrdinal(earliestOrdinal)
  }

  return defaultMin
}

/**
 * Check if a month is too far in the past (more than MAX_PAST_MONTHS, unless month_map has earlier months)
 *
 * @param year - Target year
 * @param month - Target month (1-12)
 * @param monthMap - The month_map from the budget
 */
export function isMonthTooFarInPast(year: number, month: number, monthMap: MonthMap): boolean {
  const minAllowed = getEffectiveMinMonth(monthMap)
  return (year < minAllowed.year) ||
    (year === minAllowed.year && month < minAllowed.month)
}

/**
 * Check if a month is too far in the future (more than MAX_FUTURE_MONTHS)
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

