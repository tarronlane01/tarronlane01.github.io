/**
 * Retotal Month Utility
 *
 * Re-totals derived values on a month document based on the current
 * income and expenses arrays. Called when transactions are added/updated/deleted
 * to keep the month document consistent.
 *
 * This is a "minor" recalc that only updates totals from transaction arrays.
 * It does NOT:
 * - Update start_balance or carry-forward values (those come from previous months)
 * - Clear is_needs_recalculation flag (only full recalculation does that)
 *
 * For full recalculation that updates start_balance and clears the flag,
 * see triggerRecalculation.ts
 */

import type { MonthDocument, AccountMonthBalance, CategoryMonthBalance } from '@types'

/**
 * Re-total a month document based on current transactions.
 * Updates:
 * - total_income
 * - total_expenses
 * - account_balances (income, expenses, net_change, end_balance per account)
 * - category_balances.spent (spent per category)
 *
 * Does NOT modify is_needs_recalculation - only full recalculation clears that.
 * Preserves start_balance values since those come from previous month.
 */
export function retotalMonth(month: MonthDocument): MonthDocument {
  const income = month.income || []
  const expenses = month.expenses || []

  // Re-total income and expenses
  const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  // Re-total account balances
  const accountBalances = retotalAccountBalances(month)

  // Re-total category spent amounts
  const categoryBalances = retotalCategorySpent(month)

  return {
    ...month,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    account_balances: accountBalances,
    category_balances: categoryBalances,
  }
}

/**
 * Re-total account balances from income/expense transactions.
 * Preserves start_balance, re-totals income/expenses/net_change/end_balance.
 */
function retotalAccountBalances(month: MonthDocument): AccountMonthBalance[] {
  const income = month.income || []
  const expenses = month.expenses || []
  const existingBalances = month.account_balances || []

  // Build map of existing balances to preserve start_balance
  const balanceMap = new Map<string, AccountMonthBalance>()
  for (const ab of existingBalances) {
    balanceMap.set(ab.account_id, ab)
  }

  // Collect all account IDs from transactions
  const accountIds = new Set<string>()
  for (const inc of income) {
    accountIds.add(inc.account_id)
  }
  for (const exp of expenses) {
    accountIds.add(exp.account_id)
  }
  // Include existing accounts even if no transactions this month
  for (const ab of existingBalances) {
    accountIds.add(ab.account_id)
  }

  // Calculate balances for each account
  const balances: AccountMonthBalance[] = []
  for (const accountId of accountIds) {
    const existing = balanceMap.get(accountId)
    const startBalance = existing?.start_balance ?? 0

    // Sum income for this account
    const incomeTotal = income
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0)

    // Sum expenses for this account
    const expensesTotal = expenses
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + e.amount, 0)

    const netChange = incomeTotal - expensesTotal

    balances.push({
      account_id: accountId,
      start_balance: startBalance,
      income: incomeTotal,
      expenses: expensesTotal,
      net_change: netChange,
      end_balance: startBalance + netChange,
    })
  }

  return balances
}

/**
 * Re-total category spent amounts from expense transactions.
 * Preserves start_balance and allocated, re-totals spent and end_balance.
 */
function retotalCategorySpent(month: MonthDocument): CategoryMonthBalance[] {
  const expenses = month.expenses || []
  const existingBalances = month.category_balances || []

  // Build map of existing balances
  const balanceMap = new Map<string, CategoryMonthBalance>()
  for (const cb of existingBalances) {
    balanceMap.set(cb.category_id, cb)
  }

  // Calculate spent per category from expenses
  const spentByCategory = new Map<string, number>()
  for (const exp of expenses) {
    const current = spentByCategory.get(exp.category_id) || 0
    spentByCategory.set(exp.category_id, current + exp.amount)
  }

  // Update existing balances with new spent amounts
  const balances: CategoryMonthBalance[] = existingBalances.map(cb => {
    const spent = spentByCategory.get(cb.category_id) ?? 0
    return {
      ...cb,
      spent,
      end_balance: cb.start_balance + cb.allocated - spent,
    }
  })

  return balances
}

