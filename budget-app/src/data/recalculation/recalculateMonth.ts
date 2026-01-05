/**
 * Recalculate Month
 *
 * Pure calculation logic for recalculating a single month's derived values.
 * Takes the previous month's end balances and calculates correct values for:
 * - category_balances (start_balance, end_balance)
 * - account_balances (start_balance, end_balance, income, expenses, net_change)
 * - previous_month_income
 *
 * This is a pure function - it does NOT read or write to Firestore.
 * The caller is responsible for providing the previous month's data and saving results.
 */

import type {
  MonthDocument,
  CategoryMonthBalance,
  AccountMonthBalance,
} from '@types'
import { isNoCategory, isNoAccount } from '../constants'
import { roundCurrency } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Snapshot of end balances from the previous month.
 * Used as input to recalculate the next month's start balances.
 */
export interface PreviousMonthSnapshot {
  /** category_id -> end_balance */
  categoryEndBalances: Record<string, number>
  /** account_id -> end_balance */
  accountEndBalances: Record<string, number>
  /** Total income from previous month (for percentage-based allocations) */
  totalIncome: number
}

/**
 * Empty snapshot for the first month or when no previous data exists.
 */
export const EMPTY_SNAPSHOT: PreviousMonthSnapshot = {
  categoryEndBalances: {},
  accountEndBalances: {},
  totalIncome: 0,
}

// ============================================================================
// MAIN RECALCULATION FUNCTION
// ============================================================================

/**
 * Recalculate all derived values for a month based on previous month's snapshot.
 *
 * This function:
 * 1. Sets start_balance for categories from previous month's end_balance
 * 2. Recalculates end_balance = start_balance + allocated + spent (spent is negative for money out)
 * 3. Sets start_balance for accounts from previous month's end_balance
 * 4. Recalculates account income/expenses from transaction arrays
 * 5. Recalculates end_balance = start_balance + net_change (net_change = income + expenses)
 * 6. Sets previous_month_income
 *
 * Note: The needs_recalculation flag is stored in the budget's month_map,
 * not on the month document itself. The caller handles clearing that flag.
 *
 * @param month - The month document to recalculate
 * @param prevSnapshot - Snapshot of previous month's end balances
 * @returns Recalculated month document (not saved - caller must save)
 */
export function recalculateMonth(
  month: MonthDocument,
  prevSnapshot: PreviousMonthSnapshot
): MonthDocument {
  // Recalculate category balances
  const categoryBalances = recalculateCategoryBalances(
    month.category_balances,
    prevSnapshot.categoryEndBalances
  )

  // Recalculate account balances from transactions
  const accountBalances = recalculateAccountBalances(
    month,
    prevSnapshot.accountEndBalances
  )

  return {
    ...month,
    previous_month_income: prevSnapshot.totalIncome,
    category_balances: categoryBalances,
    account_balances: accountBalances,
    updated_at: new Date().toISOString(),
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recalculate category balances with correct start balances from previous month.
 * Note: The special "No Category" is excluded as it doesn't track balances.
 */
function recalculateCategoryBalances(
  currentBalances: CategoryMonthBalance[],
  prevCategoryEndBalances: Record<string, number>
): CategoryMonthBalance[] {
  // Build map of existing balances (excluding "No Category")
  const balanceMap = new Map<string, CategoryMonthBalance>()
  for (const cb of currentBalances) {
    if (isNoCategory(cb.category_id)) continue
    balanceMap.set(cb.category_id, cb)
  }

  // Update each existing balance with correct start_balance (excluding "No Category")
  // Note: spent is negative for money out, positive for money in
  // All values are rounded to 2 decimal places to avoid floating point precision issues
  const updated: CategoryMonthBalance[] = currentBalances
    .filter(cb => !isNoCategory(cb.category_id))
    .map(cb => {
      const startBalance = roundCurrency(prevCategoryEndBalances[cb.category_id] ?? 0)
      const allocated = roundCurrency(cb.allocated)
      const spent = roundCurrency(cb.spent)
      return {
        ...cb,
        start_balance: startBalance,
        allocated,
        spent,
        end_balance: roundCurrency(startBalance + allocated + spent),
      }
    })

  // Add any categories from previous month that aren't in current (excluding "No Category")
  for (const [catId, endBal] of Object.entries(prevCategoryEndBalances)) {
    if (isNoCategory(catId)) continue
    if (!balanceMap.has(catId)) {
      const startBalance = roundCurrency(endBal)
      updated.push({
        category_id: catId,
        start_balance: startBalance,
        allocated: 0,
        spent: 0,
        end_balance: startBalance,
      })
    }
  }

  return updated
}

/**
 * Recalculate account balances from income/expense transactions.
 * Note: The special "No Account" is excluded as it doesn't track balances.
 */
function recalculateAccountBalances(
  month: MonthDocument,
  prevAccountEndBalances: Record<string, number>
): AccountMonthBalance[] {
  // Collect all account IDs from transactions and previous balances (excluding No Account)
  const accountIds = new Set<string>()

  for (const income of month.income || []) {
    if (isNoAccount(income.account_id)) continue
    accountIds.add(income.account_id)
  }
  for (const expense of month.expenses || []) {
    if (isNoAccount(expense.account_id)) continue
    accountIds.add(expense.account_id)
  }
  for (const accountId of Object.keys(prevAccountEndBalances)) {
    if (isNoAccount(accountId)) continue
    accountIds.add(accountId)
  }
  // Also include accounts from existing balances (excluding No Account)
  for (const ab of month.account_balances || []) {
    if (isNoAccount(ab.account_id)) continue
    accountIds.add(ab.account_id)
  }

  // Calculate balances for each account
  const balances: AccountMonthBalance[] = []

  for (const accountId of accountIds) {
    const startBalance = roundCurrency(prevAccountEndBalances[accountId] ?? 0)

    // Sum income for this account (round the total)
    const incomeTotal = roundCurrency((month.income || [])
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0))

    // Sum expenses for this account (round the total)
    // Note: expense.amount follows CSV convention: negative = money out, positive = money in
    const expensesTotal = roundCurrency((month.expenses || [])
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + e.amount, 0))

    // Net change = income + expenses (expenses is negative for money out)
    const netChange = roundCurrency(incomeTotal + expensesTotal)

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

// ============================================================================
// SNAPSHOT EXTRACTION
// ============================================================================

/**
 * Extract a snapshot from a month for passing to the next month's recalculation.
 * Note: The special "No Category" and "No Account" are excluded as they don't track balances.
 */
export function extractSnapshotFromMonth(month: MonthDocument): PreviousMonthSnapshot {
  const categoryEndBalances: Record<string, number> = {}
  const accountEndBalances: Record<string, number> = {}

  for (const cb of month.category_balances || []) {
    // Skip "No Category" - it doesn't track balances
    if (isNoCategory(cb.category_id)) continue
    categoryEndBalances[cb.category_id] = roundCurrency(cb.end_balance)
  }

  for (const ab of month.account_balances || []) {
    // Skip the No Account - it doesn't track balances
    if (isNoAccount(ab.account_id)) continue
    accountEndBalances[ab.account_id] = roundCurrency(ab.end_balance)
  }

  return {
    categoryEndBalances,
    accountEndBalances,
    totalIncome: roundCurrency(month.total_income),
  }
}

