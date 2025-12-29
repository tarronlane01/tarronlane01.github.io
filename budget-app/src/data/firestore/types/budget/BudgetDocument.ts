import type { AccountsMap } from './FinancialAccount'
import type { AccountGroupsMap } from './AccountGroup'
import type { CategoriesMap } from './Category'
import type { CategoryGroup } from './CategoryGroup'

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

  is_needs_recalculation: boolean

  created_at?: string
  updated_at?: string
}
