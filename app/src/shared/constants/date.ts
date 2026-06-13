/**
 * Full month names for display purposes
 */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const

/**
 * Abbreviated month names (3 letters)
 */
export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const

/**
 * Maximum number of months allowed beyond the current month.
 * Used for:
 * - Month navigation (prevents navigating too far ahead)
 * - Month creation limits (prevents creating months too far in future/past)
 * - Database cleanup (deletes months beyond this limit)
 */
export const MAX_FUTURE_MONTHS = 3

/**
 * Maximum number of months allowed before the current month (for creating new months).
 * Existing months can still be viewed regardless of age.
 */
export const MAX_PAST_MONTHS = 3

