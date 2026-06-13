import type { AccountsMap } from './FinancialAccount'
import type { AccountGroupsMap } from './AccountGroup'
import type { CategoriesMap } from './Category'
import type { CategoryGroup } from './CategoryGroup'

/**
 * Map of month ordinals (YYYYMM) to empty objects.
 * The budget maintains this map to track which months exist in the budget.
 * Keys are YYYYMM ordinal format (e.g., "202401" for January 2024).
 * Values are empty objects (just used to track presence).
 */
export type MonthMap = Record<string, Record<string, never>>

// Budget document structure (full Firestore document)
export interface Budget {
  id: string
  name: string
  user_ids: string[] // Users who have been invited (includes accepted)
  accepted_user_ids: string[] // Users who have accepted the invite
  owner_id: string
  owner_email: string

  // Financial data
  accounts: AccountsMap
  account_groups: AccountGroupsMap
  categories: CategoriesMap
  category_groups: CategoryGroup[]

  /**
   * Index of months in the budget.
   * Key is YYYYMM ordinal format (e.g., "202401" for January 2024).
   * Values are empty objects (just used to track which months exist).
   * This allows deriving earliest/latest month from the map keys.
   */
  month_map: MonthMap

  /**
   * Number of months back to use for percentage-based allocation income.
   * E.g. 1 = use previous month's income; 2 = use income from two months ago.
   * Default 1. When changed, only non-finalized allocation calculations use the new value.
   */
  percentage_income_months_back?: number

  created_at?: string
  updated_at?: string
}
