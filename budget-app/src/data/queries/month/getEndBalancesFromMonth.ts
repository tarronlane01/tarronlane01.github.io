/**
 * Get End Balances From Month
 *
 * Helper function for extracting end balances from a month document.
 * Used when creating the next month or when recalculating.
 */

import type { MonthDocument } from '@types'

/**
 * Build end balances from a month document.
 * Returns maps of category_id -> end_balance and account_id -> end_balance
 */
export function getEndBalancesFromMonth(monthDoc: MonthDocument): {
  categoryEndBalances: Record<string, number>
  accountEndBalances: Record<string, number>
} {
  const categoryEndBalances: Record<string, number> = {}
  const accountEndBalances: Record<string, number> = {}

  if (monthDoc.category_balances) {
    monthDoc.category_balances.forEach(cb => {
      categoryEndBalances[cb.category_id] = cb.end_balance
    })
  }

  if (monthDoc.account_balances) {
    monthDoc.account_balances.forEach(ab => {
      accountEndBalances[ab.account_id] = ab.end_balance
    })
  }

  return { categoryEndBalances, accountEndBalances }
}

