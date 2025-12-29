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

