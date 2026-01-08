// Transfer transaction - moves money from one account/category to another
// Both from and to sides are required
export interface TransferTransaction {
  id: string
  amount: number // Amount being transferred (positive)
  from_account_id: string // Source account (required)
  to_account_id: string // Destination account (required)
  from_category_id: string // Source category (required)
  to_category_id: string // Destination category (required)
  date: string // YYYY-MM-DD format
  description?: string
  cleared?: boolean // Whether this transaction has appeared in the bank account
  created_at: string
}


