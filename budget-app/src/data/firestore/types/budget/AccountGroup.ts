// Account group types for budget document

export type ExpectedBalanceType = 'positive' | 'negative' | 'any'

// AccountGroup stored in a map where the key is the group ID
// All fields are required. Use null for optional override fields to mean "not set, use account default"
export interface AccountGroup {
  name: string
  sort_order: number
  expected_balance: ExpectedBalanceType // 'positive' = warn if negative, 'negative' = warn if positive (e.g. credit cards), 'any' = no warnings
  on_budget: boolean | null // null = use account default, true/false = override for all accounts in this group
  badge_color: string // color key for group badge (e.g. 'blue', 'green', 'grey')
}

// Map of account group ID to AccountGroup data
export type AccountGroupsMap = Record<string, AccountGroup>

