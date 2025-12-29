export interface FinancialAccount {
  nickname: string
  description: string
  balance: number
  account_group_id: string | null
  sort_order: number
  is_income_account: boolean
  is_income_default: boolean
  is_outgo_account: boolean
  is_outgo_default: boolean
  on_budget: boolean
  is_active: boolean
}

export type AccountsMap = Record<string, FinancialAccount>

