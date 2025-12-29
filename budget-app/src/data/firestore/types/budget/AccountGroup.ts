// Account group types for budget document

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

