export interface FinancialAccount {
  nickname: string
  description: string
  balance: number
  account_group_id: string // Always required - use UNGROUPED_ACCOUNT_GROUP_ID for ungrouped accounts
  sort_order: number
  is_income_account: boolean
  is_income_default: boolean
  is_outgo_account: boolean
  is_outgo_default: boolean
  on_budget: boolean
  /** Soft-deleted accounts are preserved for historical viewing but excluded from current operations */
  is_deleted?: boolean
  /** The year-month (YYYYMM) when the account was deleted — used to show account in historical months */
  deleted_year_month?: string
  /** The year-month (YYYYMM) when the off-budget balance was last set via the set-balance feature */
  off_budget_balance_month?: string
}

export type AccountsMap = Record<string, FinancialAccount>

