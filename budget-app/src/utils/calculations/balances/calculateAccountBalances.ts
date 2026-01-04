import type { FinancialAccount } from '@contexts/budget_context'
import type { AccountMonthBalance, MonthDocument } from '@types'

/**
 * Calculates account balances for a given month
 * Computes income, expenses, and net change for each account
 */
export function calculateAccountBalances(
  currentMonth: MonthDocument | null | undefined,
  accounts: Record<string, FinancialAccount>
): Record<string, AccountMonthBalance> {
  // Build a map of existing account balances for quick lookup
  const existingBalances: Record<string, AccountMonthBalance> = {}
  if (currentMonth?.account_balances) {
    currentMonth.account_balances.forEach(ab => {
      existingBalances[ab.account_id] = ab
    })
  }

  const balances: Record<string, AccountMonthBalance> = {}
  Object.entries(accounts).forEach(([accountId, account]) => {
    const existing = existingBalances[accountId]
    // Start balance from existing or account's current balance if first month
    const startBalance = existing?.start_balance ?? account.balance

    // Calculate income deposited to this account this month
    let income = 0
    if (currentMonth?.income) {
      income = currentMonth.income
        .filter(i => i.account_id === accountId)
        .reduce((sum, i) => sum + i.amount, 0)
    }

    // Calculate expenses from this account this month
    // Note: expense.amount follows CSV convention: negative = money out, positive = money in
    let expenses = 0
    if (currentMonth?.expenses) {
      expenses = currentMonth.expenses
        .filter(e => e.account_id === accountId)
        .reduce((sum, e) => sum + e.amount, 0)
    }

    // Net change = income + expenses (expenses is negative for money out)
    const netChange = income + expenses

    balances[accountId] = {
      account_id: accountId,
      start_balance: startBalance,
      income,
      expenses,
      net_change: netChange,
      end_balance: startBalance + netChange,
    }
  })

  return balances
}

