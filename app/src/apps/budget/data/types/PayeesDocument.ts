// Payees document structure (one per budget)
export interface PayeesDocument {
  budget_id: string
  payees: string[] // List of unique payee names
  updated_at: string
}

