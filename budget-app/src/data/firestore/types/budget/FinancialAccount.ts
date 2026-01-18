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
  is_active: boolean
  /** Hidden accounts are excluded from dropdowns and balance displays, shown in a collapsed section in settings */
  is_hidden?: boolean
}

export type AccountsMap = Record<string, FinancialAccount>

