/**
 * Initial data load: determine which month range to load based on reference month and budget month_map.
 */

import { getYearMonthOrdinal } from '@utils'

/**
 * Calculate the on-the-fly window ordinals (current ± 3 months).
 */
export function getOnTheFlyWindow(): { minOrdinal: string; maxOrdinal: string } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let minYear = currentYear
  let minMonth = currentMonth - 3
  while (minMonth <= 0) {
    minMonth += 12
    minYear -= 1
  }

  let maxYear = currentYear
  let maxMonth = currentMonth + 3
  while (maxMonth > 12) {
    maxMonth -= 12
    maxYear += 1
  }

  return {
    minOrdinal: getYearMonthOrdinal(minYear, minMonth),
    maxOrdinal: getYearMonthOrdinal(maxYear, maxMonth),
  }
}

/**
 * Get a range around a specific month (±1 month).
 */
export function getRangeAroundMonth(year: number, month: number): { minOrdinal: string; maxOrdinal: string } {
  let minYear = year
  let minMonth = month - 1
  if (minMonth <= 0) {
    minMonth += 12
    minYear -= 1
  }

  let maxYear = year
  let maxMonth = month + 1
  if (maxMonth > 12) {
    maxMonth -= 12
    maxYear += 1
  }

  return {
    minOrdinal: getYearMonthOrdinal(minYear, minMonth),
    maxOrdinal: getYearMonthOrdinal(maxYear, maxMonth),
  }
}

/**
 * Determine which months to load based on the reference month and budget's month_map.
 * Strategy: reference month ± 1 if in budget; else on-the-fly window if any months; else latest month ± 1.
 */
export function determineMonthsToLoad(
  monthMap: Record<string, unknown>,
  referenceMonth?: { year: number; month: number }
): { minOrdinal: string; maxOrdinal: string } | null {
  const ordinals = Object.keys(monthMap).sort()
  if (ordinals.length === 0) return null

  if (referenceMonth) {
    const refRange = getRangeAroundMonth(referenceMonth.year, referenceMonth.month)
    const monthsInRefRange = ordinals.filter(o => o >= refRange.minOrdinal && o <= refRange.maxOrdinal)
    if (monthsInRefRange.length > 0) return refRange
  }

  const { minOrdinal: windowMin, maxOrdinal: windowMax } = getOnTheFlyWindow()
  const monthsInWindow = ordinals.filter(o => o >= windowMin && o <= windowMax)
  if (monthsInWindow.length > 0) return { minOrdinal: windowMin, maxOrdinal: windowMax }

  const latestOrdinal = ordinals[ordinals.length - 1]
  const latestYear = parseInt(latestOrdinal.substring(0, 4), 10)
  const latestMonth = parseInt(latestOrdinal.substring(4, 6), 10)
  return getRangeAroundMonth(latestYear, latestMonth)
}
