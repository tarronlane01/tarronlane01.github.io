// Adjustment transaction - one-sided corrections
// Allows NO_ACCOUNT_ID or NO_CATEGORY_ID for adjustments that don't affect a real account/category
export interface AdjustmentTransaction {
  id: string
  amount: number // Adjustment amount (positive = add, negative = subtract)
  account_id: string // Can be NO_ACCOUNT_ID for category-only adjustments
  category_id: string // Can be NO_CATEGORY_ID for account-only adjustments
  date: string // YYYY-MM-DD format
  payee?: string // Optional payee/source (e.g., "Bank Fee", "Interest")
  description?: string
  cleared?: boolean // Whether this transaction has appeared in the bank account
  created_at: string
}


