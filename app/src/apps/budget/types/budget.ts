// UI types for budget display (not Firestore document types)

// Invite status for displaying in UI
export interface BudgetInvite {
  budgetId: string
  budgetName: string
  ownerEmail: string | null
}

// Summary of a budget for listing
export interface BudgetSummary {
  id: string
  name: string
  ownerEmail: string | null
  isOwner: boolean
  isPending: boolean // true if user hasn't accepted yet
  isSampleBudget?: boolean // true for the shared sample budget (admins only)
}
