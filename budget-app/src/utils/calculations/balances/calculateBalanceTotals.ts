import type { CategoryMonthBalance } from '@types'

export interface CategoryBalanceTotals {
  start: number
  allocated: number
  spent: number
  transfers: number
  adjustments: number
  end: number
}

/**
 * Calculates totals across all category balances
 * 
 * Note: The 'end' total matches the settings page "Allocated" calculation:
 * - Sums only positive end_balances (same as settings page sums only positive category.balance)
 * - This ensures the month view grand total matches the settings page allocated total
 */
export function calculateBalanceTotals(
  categoryBalances: Record<string, CategoryMonthBalance>
): CategoryBalanceTotals {
  return Object.values(categoryBalances).reduce((acc, bal) => ({
    start: acc.start + bal.start_balance,
    allocated: acc.allocated + bal.allocated,
    spent: acc.spent + bal.spent,
    transfers: acc.transfers + bal.transfers,
    adjustments: acc.adjustments + bal.adjustments,
    // Sum only positive end_balances to match settings page "Allocated" calculation
    // This ensures: month view END = settings page Allocated
    end: acc.end + Math.max(0, bal.end_balance),
  }), { start: 0, allocated: 0, spent: 0, transfers: 0, adjustments: 0, end: 0 })
}

