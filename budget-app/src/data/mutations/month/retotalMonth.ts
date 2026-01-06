/**
 * Retotal Month Utility
 *
 * Re-totals derived values on a month document based on the current
 * transaction arrays (income, expenses, transfers, adjustments).
 * Called when transactions are added/updated/deleted to keep the month document consistent.
 *
 * This is a "minor" recalc that only updates totals from transaction arrays.
 * It does NOT:
 * - Update start_balance or carry-forward values (those come from previous months)
 *
 * For full recalculation that updates start_balance, see triggerRecalculation.ts.
 * Note: Recalculation status is tracked in the budget's month_map, not on month documents.
 */

import type { MonthDocument, AccountMonthBalance, CategoryMonthBalance } from '@types'
import { isNoCategory, isNoAccount } from '../../constants'
import { roundCurrency } from '@utils'

/**
 * Re-total a month document based on current transactions.
 * Updates:
 * - total_income
 * - total_expenses
 * - account_balances (income, expenses, net_change, end_balance per account)
 * - category_balances.spent (spent per category)
 *
 * Preserves start_balance values since those come from previous month.
 */
export function retotalMonth(month: MonthDocument): MonthDocument {
  const income = month.income || []
  const expenses = month.expenses || []

  // Re-total income and expenses (round to 2 decimal places)
  const totalIncome = roundCurrency(income.reduce((sum, inc) => sum + inc.amount, 0))
  const totalExpenses = roundCurrency(expenses.reduce((sum, exp) => sum + exp.amount, 0))

  // Re-total account balances (includes transfers and adjustments)
  const accountBalances = retotalAccountBalances(month)

  // Re-total category spent amounts (includes transfers and adjustments)
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
 * Re-total account balances from all transaction types.
 * Includes: income, expenses, transfers, and adjustments.
 * Preserves start_balance, re-totals income/expenses/net_change/end_balance.
 * Note: The special "No Account" is excluded as it doesn't track balances.
 */
function retotalAccountBalances(month: MonthDocument): AccountMonthBalance[] {
  const income = month.income || []
  const expenses = month.expenses || []
  const transfers = month.transfers || []
  const adjustments = month.adjustments || []
  const existingBalances = month.account_balances || []

  // Build map of existing balances to preserve start_balance (excluding No Account)
  const balanceMap = new Map<string, AccountMonthBalance>()
  for (const ab of existingBalances) {
    if (isNoAccount(ab.account_id)) continue
    balanceMap.set(ab.account_id, ab)
  }

  // Collect all account IDs from all transaction types (excluding No Account)
  const accountIds = new Set<string>()
  for (const inc of income) {
    if (isNoAccount(inc.account_id)) continue
    accountIds.add(inc.account_id)
  }
  for (const exp of expenses) {
    if (isNoAccount(exp.account_id)) continue
    accountIds.add(exp.account_id)
  }
  for (const transfer of transfers) {
    if (!isNoAccount(transfer.from_account_id)) accountIds.add(transfer.from_account_id)
    if (!isNoAccount(transfer.to_account_id)) accountIds.add(transfer.to_account_id)
  }
  for (const adjustment of adjustments) {
    if (!isNoAccount(adjustment.account_id)) accountIds.add(adjustment.account_id)
  }
  // Include existing accounts even if no transactions this month (excluding No Account)
  for (const ab of existingBalances) {
    if (isNoAccount(ab.account_id)) continue
    accountIds.add(ab.account_id)
  }

  // Calculate balances for each account (all values rounded to 2 decimal places)
  const balances: AccountMonthBalance[] = []
  for (const accountId of accountIds) {
    const existing = balanceMap.get(accountId)
    const startBalance = roundCurrency(existing?.start_balance ?? 0)

    // Sum income for this account
    const incomeTotal = roundCurrency(income
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0))

    // Sum expenses for this account
    // Note: expense.amount follows CSV convention: negative = money out, positive = money in
    const expensesTotal = roundCurrency(expenses
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + e.amount, 0))

    // Calculate transfer effects for this account
    // Transfers out (from_account) subtract, transfers in (to_account) add
    const transfersOut = roundCurrency(transfers
      .filter(t => t.from_account_id === accountId)
      .reduce((sum, t) => sum - t.amount, 0))

    const transfersIn = roundCurrency(transfers
      .filter(t => t.to_account_id === accountId)
      .reduce((sum, t) => sum + t.amount, 0))

    // Calculate adjustment effects for this account
    const adjustmentTotal = roundCurrency(adjustments
      .filter(a => a.account_id === accountId)
      .reduce((sum, a) => sum + a.amount, 0))

    // Net change includes all transaction types
    const netChange = roundCurrency(incomeTotal + expensesTotal + transfersOut + transfersIn + adjustmentTotal)

    balances.push({
      account_id: accountId,
      start_balance: startBalance,
      income: incomeTotal,
      expenses: expensesTotal,
      net_change: netChange,
      end_balance: roundCurrency(startBalance + netChange),
    })
  }

  return balances
}

/**
 * Re-total category spent amounts from all transaction types.
 * Includes: expenses, transfers (from/to categories), and adjustments.
 * Preserves start_balance and allocated, re-totals spent and end_balance.
 * Also creates new CategoryMonthBalance entries for categories with transactions
 * that don't yet have a balance entry.
 * Note: The special "No Category" is excluded as it doesn't track balances.
 */
function retotalCategorySpent(month: MonthDocument): CategoryMonthBalance[] {
  const expenses = month.expenses || []
  const transfers = month.transfers || []
  const adjustments = month.adjustments || []
  const existingBalances = month.category_balances || []

  // Build map of existing balances (excluding "No Category")
  const balanceMap = new Map<string, CategoryMonthBalance>()
  for (const cb of existingBalances) {
    if (isNoCategory(cb.category_id)) continue
    balanceMap.set(cb.category_id, cb)
  }

  // Calculate spent per category from expenses (excluding "No Category")
  // Note: expense.amount follows CSV convention: negative = money out, positive = money in
  // Values are rounded when used, not during accumulation to avoid compound rounding errors
  const spentByCategory = new Map<string, number>()
  for (const exp of expenses) {
    if (isNoCategory(exp.category_id)) continue
    const current = spentByCategory.get(exp.category_id) || 0
    spentByCategory.set(exp.category_id, current + exp.amount)
  }

  // Calculate category adjustments from transfers and adjustments
  const categoryAdjustments = new Map<string, number>()

  // Process transfers (from_category subtracts, to_category adds)
  for (const transfer of transfers) {
    if (!isNoCategory(transfer.from_category_id)) {
      const current = categoryAdjustments.get(transfer.from_category_id) || 0
      categoryAdjustments.set(transfer.from_category_id, current - transfer.amount)
    }
    if (!isNoCategory(transfer.to_category_id)) {
      const current = categoryAdjustments.get(transfer.to_category_id) || 0
      categoryAdjustments.set(transfer.to_category_id, current + transfer.amount)
    }
  }

  // Process adjustments (adds/subtracts based on amount sign)
  for (const adjustment of adjustments) {
    if (!isNoCategory(adjustment.category_id)) {
      const current = categoryAdjustments.get(adjustment.category_id) || 0
      categoryAdjustments.set(adjustment.category_id, current + adjustment.amount)
    }
  }

  // Collect all category IDs (from existing balances, expenses, transfers, and adjustments)
  const allCategoryIds = new Set<string>()
  for (const cb of existingBalances) {
    if (isNoCategory(cb.category_id)) continue
    allCategoryIds.add(cb.category_id)
  }
  for (const exp of expenses) {
    if (isNoCategory(exp.category_id)) continue
    allCategoryIds.add(exp.category_id)
  }
  for (const transfer of transfers) {
    if (!isNoCategory(transfer.from_category_id)) allCategoryIds.add(transfer.from_category_id)
    if (!isNoCategory(transfer.to_category_id)) allCategoryIds.add(transfer.to_category_id)
  }
  for (const adjustment of adjustments) {
    if (!isNoCategory(adjustment.category_id)) allCategoryIds.add(adjustment.category_id)
  }

  // Build updated balances for all categories (all values rounded to 2 decimal places)
  const balances: CategoryMonthBalance[] = []
  for (const categoryId of allCategoryIds) {
    const existing = balanceMap.get(categoryId)
    const spent = roundCurrency(spentByCategory.get(categoryId) ?? 0)
    const adjustment = roundCurrency(categoryAdjustments.get(categoryId) ?? 0)

    if (existing) {
      // Update existing balance with new spent amount and adjustments
      // Note: spent is negative for money out, positive for money in
      const startBalance = roundCurrency(existing.start_balance)
      const allocated = roundCurrency(existing.allocated)
      balances.push({
        ...existing,
        start_balance: startBalance,
        allocated,
        spent,
        end_balance: roundCurrency(startBalance + allocated + spent + adjustment),
      })
    } else {
      // Create new balance entry for category that only has transactions (no allocation yet)
      balances.push({
        category_id: categoryId,
        start_balance: 0,
        allocated: 0,
        spent,
        end_balance: roundCurrency(spent + adjustment),
      })
    }
  }

  return balances
}

