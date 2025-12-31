import type { AccountsMap } from './FinancialAccount'
import type { AccountGroupsMap } from './AccountGroup'
import type { CategoriesMap } from './Category'
import type { CategoryGroup } from './CategoryGroup'

/**
 * Information about a month stored in the budget's month_map.
 * This acts as an index for the recent months (3 past to 3 future).
 */
export interface MonthInfo {
  needs_recalculation: boolean
}

/**
 * Map of month ordinals (YYYYMM) to their MonthInfo.
 * The budget maintains this map for the current month, 3 past months, and 3 future months.
 */
export type MonthMap = Record<string, MonthInfo>

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
   * Pre-calculated total available amount (on-budget account balances - category balances).
   * Updated during recalculation. Use this value for display when budget doesn't need recalculation.
   * When editing (is_needs_recalculation = true), adjust locally based on pending changes.
   */
  total_available: number

  is_needs_recalculation: boolean

  /**
   * Index of recent months (current, 3 past, 3 future).
   * Each entry tracks whether that month needs recalculation.
   * Key is YYYYMM ordinal format.
   */
  month_map: MonthMap

  created_at?: string
  updated_at?: string
}
