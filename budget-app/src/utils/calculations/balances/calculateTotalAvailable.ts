/**
 * Calculate total available (Ready to Assign) amount.
 *
 * Formula: onBudgetAccountTotal - totalPositiveCategoryBalances
 *
 * This is the amount of money available to allocate to categories.
 * Only positive category balances are subtracted (negative balances represent debt/overspending).
 *
 * IMPORTANT: This uses only stored/persisted category balances. It must NEVER factor in
 * unfinalized draft allocations—Avail is always from finalized data so it stays correct
 * regardless of draft edits on the month categories page.
 */

import type { FirestoreData } from '@types'
import { roundCurrency } from '@utils'

/**
 * Determine if an account is effectively on-budget and active.
 * Checks account group settings first, then falls back to account settings.
 *
 * @param account - The account data
 * @param accountGroups - Map of account groups
 * @returns True if the account should be included in on-budget calculations
 */
export function isAccountOnBudget(
  account: { account_group_id?: string; on_budget?: boolean; is_active?: boolean },
  accountGroups: FirestoreData
): boolean {
  const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
  const effectiveOnBudget = (group && group.on_budget !== null) ? group.on_budget : (account.on_budget !== false)
  const effectiveActive = (group && group.is_active !== null) ? group.is_active : (account.is_active !== false)
  return effectiveOnBudget && effectiveActive
}

/**
 * Calculate total available amount from accounts and categories.
 *
 * @param accounts - Map of account data (with balance field)
 * @param categories - Map of category data (with balance field)
 * @param accountGroups - Map of account group data
 * @returns Total available amount (rounded to 2 decimal places)
 */
export function calculateTotalAvailable(
  accounts: FirestoreData,
  categories: FirestoreData,
  accountGroups: FirestoreData
): number {
  // Sum of on-budget, active account balances
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    if (isAccountOnBudget(account as { account_group_id?: string; on_budget?: boolean; is_active?: boolean }, accountGroups)) {
      return sum + ((account as { balance?: number }).balance ?? 0)
    }
    return sum
  }, 0)

  // Sum of positive category balances only (negative balances are debt/overspending)
  const totalPositiveCategoryBalances = Object.values(categories).reduce((sum, cat) => {
    const balance = (cat as { balance?: number }).balance ?? 0
    return sum + (balance > 0 ? balance : 0)
  }, 0)

  return roundCurrency(onBudgetAccountTotal - totalPositiveCategoryBalances)
}
