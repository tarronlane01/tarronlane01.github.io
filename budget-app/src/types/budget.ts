// Budget-related types and interfaces
// Extracted from budget_context.tsx for better organization

// Permission flags that can only be set via Firebase Console
export interface PermissionFlags {
  is_admin?: boolean
  is_test?: boolean
}

// User document type for storing budget access
export interface UserDocument {
  uid: string
  email: string | null
  budget_ids: string[]
  permission_flags?: PermissionFlags
  created_at?: string
  updated_at?: string
}

// Data types
export type ExpectedBalanceType = 'positive' | 'negative' | 'any'

// AccountGroup stored in a map where the key is the group ID
export interface AccountGroup {
  name: string
  sort_order: number
  expected_balance?: ExpectedBalanceType // 'positive' = warn if negative, 'negative' = warn if positive (e.g. credit cards), 'any' = no warnings
  on_budget?: boolean // If set, overrides account-level setting for all accounts in this group
  is_active?: boolean // If set, overrides account-level setting for all accounts in this group
}

// Map of account group ID to AccountGroup data
export type AccountGroupsMap = Record<string, AccountGroup>

// FinancialAccount stored in a map where the key is the account ID
export interface FinancialAccount {
  nickname: string
  balance: number
  account_group_id: string | null
  sort_order: number
  is_income_account?: boolean
  is_income_default?: boolean
  is_outgo_account?: boolean // Can this account be used for spending/expenses?
  is_outgo_default?: boolean // Is this the default account for new expenses?
  on_budget?: boolean // true = on budget (default), false = off budget (tracking only)
  is_active?: boolean // true = active (default), false = hidden/archived
}

// Map of account ID to FinancialAccount data
export type AccountsMap = Record<string, FinancialAccount>

export type DefaultAmountType = 'fixed' | 'percentage'

// Category stored in a map where the key is the category ID
export interface Category {
  name: string
  description?: string // Optional description of what this category is used for
  category_group_id: string | null
  sort_order: number
  default_monthly_amount?: number // Suggested allocation amount per month (dollars if fixed, percentage if percentage)
  default_monthly_type?: DefaultAmountType // 'fixed' = dollar amount, 'percentage' = % of previous month's income
  balance: number // Cumulative allocated amount across all finalized months
}

// Map of category ID to Category data
export type CategoriesMap = Record<string, Category>

export interface CategoryGroup {
  id: string
  name: string
  sort_order: number
}

// Income transaction for a month
export interface IncomeTransaction {
  id: string
  amount: number
  account_id: string
  date: string // YYYY-MM-DD format
  payee?: string
  description?: string
  created_at: string
}

// Payees document structure (one per budget)
export interface PayeesDocument {
  budget_id: string
  payees: string[] // List of unique payee names
  updated_at: string
}

// Category allocation for a month
export interface CategoryAllocation {
  category_id: string
  amount: number
}

// Month document structure
export interface MonthDocument {
  budget_id: string
  year: number
  month: number // 1-12
  income: IncomeTransaction[]
  total_income: number // Sum of all income amounts for this month
  // Account balances at start and end of this month (account_id -> balance)
  account_balances_start?: Record<string, number>
  account_balances_end?: Record<string, number>
  // Category allocations for this month
  allocations?: CategoryAllocation[]
  allocations_finalized?: boolean // When true, allocations affect category balances
  created_at: string
  updated_at: string
}

// Budget document structure
export interface Budget {
  id: string
  name: string
  user_ids: string[] // Users who have been invited (includes accepted)
  accepted_user_ids: string[] // Users who have accepted the invite
  owner_id: string
  owner_email: string | null
}

// Invite status for displaying in UI
export interface BudgetInvite {
  budgetId: string
  budgetName: string
  ownerEmail: string | null
}

// Summary of a budget for listing
export interface BudgetSummary {
  id: string
  name: string
  ownerEmail: string | null
  isOwner: boolean
  isPending: boolean // true if user hasn't accepted yet
}

