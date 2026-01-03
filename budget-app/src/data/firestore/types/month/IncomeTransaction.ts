// Income transaction for a month
export interface IncomeTransaction {
  id: string
  amount: number
  account_id: string
  date: string // YYYY-MM-DD format
  payee?: string
  description?: string
  cleared?: boolean // Whether this transaction has appeared in the bank account
  created_at: string
}

