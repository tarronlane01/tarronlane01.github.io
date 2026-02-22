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
  logFirebaseOperations: false, // DEBUG: revert to true after fixing bug

  /**
   * Include source description in Firebase logs (e.g., "← loading budget").
   * When false, only shows operation and path for cleaner output.
   * When true, shows why the operation is happening.
   */
  logFirebaseSource: false,

  /**
   * Include full document path in Firebase operation logs.
   * When false, paths are shortened (e.g., "budgets" instead of "budgets/budget_123_abc").
   * When true, shows the full path for debugging specific documents.
   */
  logFirebaseFullPath: false,

  /**
   * Log the actual data being read/written in Firebase operations.
   * WARNING: This can be very verbose and may expose sensitive data in console.
   * Only enable when actively debugging data issues.
   */
  logFirebaseData: false,

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

