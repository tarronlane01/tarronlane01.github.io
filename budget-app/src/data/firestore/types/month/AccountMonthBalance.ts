/**
 * Account balance data stored in Firestore.
 * Only stores start_balance (for months at/before window).
 * All other fields (income, expenses, transfers, adjustments, net_change, end_balance) are calculated on-the-fly.
 */
export interface AccountMonthBalanceStored {
  account_id: string
  start_balance: number // Balance at start of month (end of previous month) - only stored for months at/before window
}

/**
 * Account balance with all calculated fields (in-memory only).
 * Extends stored data with calculated values from transactions.
 */
export interface AccountMonthBalance extends AccountMonthBalanceStored {
  income: number // Total income deposited to this account this month - calculated from income
  expenses: number // Total expenses from this account (negative = money out, positive = money in) - calculated from expenses
  transfers: number // Net transfers (positive = money in, negative = money out) - calculated from transfers
  adjustments: number // Net adjustments (positive = add, negative = subtract) - calculated from adjustments
  net_change: number // income + expenses + transfers + adjustments - calculated
  end_balance: number // start + net_change - calculated
}

