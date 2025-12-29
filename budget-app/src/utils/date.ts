/**
 * Date Utility Functions
 */

/**
 * Get previous month's year and month
 * @param year - Current year
 * @param month - Current month (1-12)
 * @returns Previous month's year and month
 */
export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 }
  }
  return { year, month: month - 1 }
}

/**
 * Get next month's year and month
 * @param year - Current year
 * @param month - Current month (1-12)
 * @returns Next month's year and month
 */
export function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }
  return { year, month: month + 1 }
}

/**
 * Generate year_month_ordinal string for sorting/querying months
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12)
 * @returns Ordinal string (e.g., "202502" for Feb 2025)
 */
export function getYearMonthOrdinal(year: number, month: number): string {
  return `${year}${month.toString().padStart(2, '0')}`
}

