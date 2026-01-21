/**
 * Category balance data stored in Firestore.
 * Only stores start_balance (for months at/before window) and allocated (for all months).
 * All other fields (spent, transfers, adjustments, end_balance) are calculated on-the-fly.
 */
export interface CategoryMonthBalanceStored {
  category_id: string
  start_balance: number // Balance at start of month (end of previous month) - only stored for months at/before window
  allocated: number // Allocations this month - stored for all months
}

/**
 * Category balance with all calculated fields (in-memory only).
 * Extends stored data with calculated values from transactions.
 */
export interface CategoryMonthBalance extends CategoryMonthBalanceStored {
  spent: number // Total spend this month (negative = money out, positive = money in) - calculated from expenses
  transfers: number // Net transfers (positive = money in, negative = money out) - calculated from transfers
  adjustments: number // Net adjustments (positive = add, negative = subtract) - calculated from adjustments
  end_balance: number // start + allocated + spent + transfers + adjustments - calculated
}

