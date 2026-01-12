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
    end: acc.end + bal.end_balance,
  }), { start: 0, allocated: 0, spent: 0, transfers: 0, adjustments: 0, end: 0 })
}

