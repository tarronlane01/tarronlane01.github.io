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

