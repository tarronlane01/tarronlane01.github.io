/**
 * Feature Flags
 *
 * Toggle various development and debugging features here.
 * These flags are checked at runtime to enable/disable functionality.
 */

export const featureFlags = {
  /**
   * Log Firebase read/write operations to the console.
   * Useful for debugging data flow, but can be noisy.
   */
  logFirebaseOperations: true,

  /**
   * Log user interactions (button clicks, form changes, etc.) to the console.
   * Useful for AI-assisted debugging - copy/paste console output to show
   * what actions led up to an error.
   */
  logUserActions: false,

  /**
   * Show group subtotals in category and account listings.
   * When false, only individual items and grand totals are shown.
   */
  showGroupTotals: false,
} as const

