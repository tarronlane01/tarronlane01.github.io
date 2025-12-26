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

/**
 * Snapshot of category balances stored on the budget document.
 * Avoids needing to query all month documents on every page load.
 *
 * Snapshot is considered stale if:
 * - is_stale === true (explicitly marked after month edits)
 * - computed_for_year/month doesn't match current year/month
 * - snapshot doesn't exist
 */
export interface CategoryBalancesSnapshot {
  /** When this snapshot was last computed */
  computed_at: string

  /** The "current month" this was computed for */
  computed_for_year: number
  computed_for_month: number

  /** Explicit stale flag - set to true when months are edited */
  is_stale: boolean

  /** Balances per category */
  balances: Record<string, {
    /** Available through computed_for_year/month (allocations - expenses up to that month) */
    current: number
    /** Total including all future allocations minus all expenses */
    total: number
  }>
}

/**
 * Snapshot of account balances stored on the budget document.
 * Similar to CategoryBalancesSnapshot but for accounts.
 *
 * Snapshot is considered stale if:
 * - is_stale === true (explicitly marked after month edits)
 * - computed_for_year/month doesn't match current year/month
 * - snapshot doesn't exist
 */
export interface AccountBalancesSnapshot {
  /** When this snapshot was last computed */
  computed_at: string

  /** The "current month" this was computed for */
  computed_for_year: number
  computed_for_month: number

  /** Explicit stale flag - set to true when months are edited */
  is_stale: boolean

  /** Balances per account for the given month */
  balances: Record<string, {
    /** Balance at start of month */
    start: number
    /** Total income for the month */
    income: number
    /** Total expenses for the month */
    expenses: number
    /** Net change (income - expenses) */
    net_change: number
    /** Balance at end of month */
    end: number
  }>
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

// Expense transaction for a month
export interface ExpenseTransaction {
  id: string
  amount: number // Always positive - represents money spent
  category_id: string
  account_id: string
  date: string // YYYY-MM-DD format
  payee?: string
  description?: string
  cleared?: boolean // Whether this transaction has appeared in the bank account
  created_at: string
}

// Category balance tracking for a month (stored with allocations)
export interface CategoryMonthBalance {
  category_id: string
  start_balance: number // Balance at start of month (end of previous month)
  allocated: number // Allocations this month
  spent: number // Total spend this month
  end_balance: number // start + allocated - spent
}

// Account balance tracking for a month
export interface AccountMonthBalance {
  account_id: string
  start_balance: number // Balance at start of month (end of previous month)
  income: number // Total income deposited to this account this month
  expenses: number // Total expenses from this account this month
  net_change: number // income - expenses
  end_balance: number // start + income - expenses
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

/**
 * Snapshot of data from the previous month.
 * This is copied once when a month is created or when navigating to a stale month.
 * Months never read from other month documents during normal rendering.
 */
export interface PreviousMonthSnapshot {
  /** Total income from previous month (used for percentage-based allocations) */
  total_income: number
  /** Ending account balances from previous month (account_id -> balance) */
  account_balances_end: Record<string, number>
  /** Ending category balances from previous month (category_id -> end_balance) */
  category_balances_end: Record<string, number>
  /** When this snapshot was taken */
  snapshot_taken_at: string
}

// Month document structure
export interface MonthDocument {
  budget_id: string
  year: number
  month: number // 1-12
  income: IncomeTransaction[]
  total_income: number // Sum of all income amounts for this month
  // Expenses for this month
  expenses?: ExpenseTransaction[]
  total_expenses?: number // Sum of all expense amounts for this month
  // Account balances at start and end of this month (account_id -> balance)
  account_balances_start?: Record<string, number>
  account_balances_end?: Record<string, number>
  // Category allocations for this month
  allocations?: CategoryAllocation[]
  allocations_finalized?: boolean // When true, allocations affect category balances
  // Category balances for this month (tracks start, allocated, spent, end per category)
  category_balances?: CategoryMonthBalance[]

  /**
   * True if this month's category_balances need recalculation.
   * Set to true when:
   * - Allocations or expenses are edited in THIS month
   * - ANY PREVIOUS month is edited (since this month's start_balance depends on it)
   * When true, we need to walk backwards to find a valid starting point.
   */
  category_balances_stale?: boolean

  /**
   * True if this month's account balances need recalculation.
   * Set to true when:
   * - Income or expenses are added/edited/deleted in THIS month
   * - ANY PREVIOUS month is edited (since this month's start_balance depends on it)
   * When true, we need to recalculate account balances from previous month's end.
   */
  account_balances_stale?: boolean

  /**
   * Snapshot of previous month's data (carry-forward pattern).
   * Contains the values this month needs from the previous month.
   * Undefined if this is the first month or hasn't been populated yet.
   */
  previous_month_snapshot?: PreviousMonthSnapshot

  /**
   * True if the previous_month_snapshot needs to be refreshed.
   * Set to true when ANY previous month is edited (changes cascade forward).
   * When true, the snapshot needs to be refreshed before this month can render correctly.
   * Set to true in cache immediately when a previous month changes.
   * Persisted to Firestore only once (not on every edit).
   */
  previous_month_snapshot_stale?: boolean

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

