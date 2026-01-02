import type { AccountMonthBalance } from '@types'

export interface AccountBalanceTotals {
  start: number
  income: number
  expenses: number
  netChange: number
  end: number
}

/**
 * Calculates totals across all account balances
 */
export function calculateAccountBalanceTotals(
  accountBalances: Record<string, AccountMonthBalance>
): AccountBalanceTotals {
  return Object.values(accountBalances).reduce((acc, bal) => ({
    start: acc.start + bal.start_balance,
    income: acc.income + bal.income,
    expenses: acc.expenses + bal.expenses,
    netChange: acc.netChange + bal.net_change,
    end: acc.end + bal.end_balance,
  }), { start: 0, income: 0, expenses: 0, netChange: 0, end: 0 })
}

