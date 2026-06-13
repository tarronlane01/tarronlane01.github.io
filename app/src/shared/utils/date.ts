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
 * Get year and month N months before the given month.
 * @param year - Current year
 * @param month - Current month (1-12)
 * @param monthsBack - Number of months to go back (1 = previous month, 2 = two months ago, etc.)
 * @returns Year and month for the target month, or null if monthsBack < 1
 */
export function getMonthsBack(year: number, month: number, monthsBack: number): { year: number; month: number } | null {
  if (monthsBack < 1) return null
  let y = year
  let m = month
  for (let i = 0; i < monthsBack; i++) {
    if (m === 1) {
      y -= 1
      m = 12
    } else {
      m -= 1
    }
  }
  return { year: y, month: m }
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

/**
 * Format an ISO date string for display
 * @param isoString - ISO date string
 * @returns Formatted date string (e.g., "Jan 3, 2025, 2:30 PM")
 */
export function formatDate(isoString: string) {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Get the default date for a form based on the month being viewed.
 * If viewing the current calendar month, returns today's date.
 * Otherwise, returns the first day of the month.
 * @param year - Year being viewed
 * @param month - Month being viewed (1-12)
 * @returns Date string in YYYY-MM-DD format
 */
export function getDefaultFormDate(year: number, month: number): string {
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth() + 1 // getMonth() is 0-indexed

  if (year === todayYear && month === todayMonth) {
    // Current month: use today's date (local timezone)
    const todayDay = today.getDate()
    return `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`
  }
  // Different month: use first of month
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Parse a date string (YYYY-MM-DD) into year and month numbers.
 * Used when determining which month a transaction belongs to.
 * @param date - Date string in YYYY-MM-DD format
 * @returns Object with year and month numbers
 */
export function parseDateToYearMonth(date: string): { year: number; month: number } {
  const [year, month] = date.split('-').map(Number)
  return { year, month }
}
