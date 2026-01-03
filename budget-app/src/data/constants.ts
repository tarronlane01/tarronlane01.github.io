/**
 * Application Constants
 *
 * Contains special IDs and constants used throughout the application.
 */

// =============================================================================
// ADJUSTMENT CATEGORY
// =============================================================================

/**
 * Special "Adjustment" category ID for spend entries that don't need a real category.
 * Used for things like adding starting account balances, corrections, etc.
 * This category:
 * - Appears in category selection for spend entries
 * - Does NOT track a balance (excluded from category balance calculations)
 * - Does NOT appear in the regular category list
 */
export const ADJUSTMENT_CATEGORY_ID = '__NO_CATEGORY__'
export const ADJUSTMENT_CATEGORY_NAME = 'No Category'

/**
 * Check if a category ID is the special Adjustment category
 */
export function isAdjustmentCategory(categoryId: string | null | undefined): boolean {
  return categoryId === ADJUSTMENT_CATEGORY_ID
}

// =============================================================================
// NO ACCOUNT
// =============================================================================

/**
 * Special "No Account" account ID for transactions that don't have a real account.
 * Used for imports where the account is N/A or unknown.
 * This account:
 * - Appears in account selection during imports (spend/income)
 * - Does NOT track a balance (excluded from account balance calculations)
 * - Does NOT appear in the regular account list in settings
 */
export const NO_ACCOUNT_ID = '__NO_ACCOUNT__'
export const NO_ACCOUNT_NAME = 'No Account'

/**
 * Check if an account ID is the special No Account
 */
export function isNoAccount(accountId: string | null | undefined): boolean {
  return accountId === NO_ACCOUNT_ID
}

