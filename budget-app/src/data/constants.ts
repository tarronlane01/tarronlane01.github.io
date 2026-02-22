/**
 * Application Constants
 *
 * Contains special IDs and constants used throughout the application.
 */

// =============================================================================
// SAMPLE BUDGET (shared demo budget for all admin users)
// =============================================================================

/**
 * The ID of the shared sample budget that all admin users can access.
 * This budget:
 * - Appears in the budget list for all admin users
 * - Can be uploaded/restored via the admin migration page
 * - Is ignored when determining if a user needs to create their first budget
 * - Has its own Firestore rules allowing admin read/write
 */
export const SAMPLE_BUDGET_ID = 'sample_budget'
export const SAMPLE_BUDGET_NAME = 'Sample Budget'

/**
 * Check if a budget ID is the sample budget
 */
export function isSampleBudget(budgetId: string | null | undefined): boolean {
  return budgetId === SAMPLE_BUDGET_ID
}

// =============================================================================
// NO CATEGORY (ghost category for spend without a real category)
// =============================================================================

/**
 * Special "No Category" ID for spend entries that don't need a real category.
 * Used for things like adding starting account balances, corrections, etc.
 * This category:
 * - Appears in category selection for spend entries
 * - Does NOT track a balance (excluded from category balance calculations)
 * - Does NOT appear in the regular category list
 */
export const NO_CATEGORY_ID = '__NO_CATEGORY__'
export const NO_CATEGORY_NAME = 'No Category'

/**
 * Check if a category ID is the special "No Category"
 */
export function isNoCategory(categoryId: string | null | undefined): boolean {
  return categoryId === NO_CATEGORY_ID
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

