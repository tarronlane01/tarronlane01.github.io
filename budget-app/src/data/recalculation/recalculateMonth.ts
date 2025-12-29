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
 * 2. Recalculates end_balance = start_balance + allocated - spent
 * 3. Sets start_balance for accounts from previous month's end_balance
 * 4. Recalculates account income/expenses from transaction arrays
 * 5. Recalculates end_balance = start_balance + net_change
 * 6. Sets previous_month_income
 * 7. Clears is_needs_recalculation flag
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
    is_needs_recalculation: false,
    updated_at: new Date().toISOString(),
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recalculate category balances with correct start balances from previous month.
 */
function recalculateCategoryBalances(
  currentBalances: CategoryMonthBalance[],
  prevCategoryEndBalances: Record<string, number>
): CategoryMonthBalance[] {
  // Build map of existing balances
  const balanceMap = new Map<string, CategoryMonthBalance>()
  for (const cb of currentBalances) {
    balanceMap.set(cb.category_id, cb)
  }

  // Update each existing balance with correct start_balance
  const updated: CategoryMonthBalance[] = currentBalances.map(cb => {
    const startBalance = prevCategoryEndBalances[cb.category_id] ?? 0
    return {
      ...cb,
      start_balance: startBalance,
      end_balance: startBalance + cb.allocated - cb.spent,
    }
  })

  // Add any categories from previous month that aren't in current
  for (const [catId, endBal] of Object.entries(prevCategoryEndBalances)) {
    if (!balanceMap.has(catId)) {
      updated.push({
        category_id: catId,
        start_balance: endBal,
        allocated: 0,
        spent: 0,
        end_balance: endBal,
      })
    }
  }

  return updated
}

/**
 * Recalculate account balances from income/expense transactions.
 */
function recalculateAccountBalances(
  month: MonthDocument,
  prevAccountEndBalances: Record<string, number>
): AccountMonthBalance[] {
  // Collect all account IDs from transactions and previous balances
  const accountIds = new Set<string>()

  for (const income of month.income || []) {
    accountIds.add(income.account_id)
  }
  for (const expense of month.expenses || []) {
    accountIds.add(expense.account_id)
  }
  for (const accountId of Object.keys(prevAccountEndBalances)) {
    accountIds.add(accountId)
  }
  // Also include accounts from existing balances
  for (const ab of month.account_balances || []) {
    accountIds.add(ab.account_id)
  }

  // Calculate balances for each account
  const balances: AccountMonthBalance[] = []

  for (const accountId of accountIds) {
    const startBalance = prevAccountEndBalances[accountId] ?? 0

    // Sum income for this account
    const incomeTotal = (month.income || [])
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0)

    // Sum expenses for this account
    const expensesTotal = (month.expenses || [])
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

// ============================================================================
// SNAPSHOT EXTRACTION
// ============================================================================

/**
 * Extract a snapshot from a month for passing to the next month's recalculation.
 */
export function extractSnapshotFromMonth(month: MonthDocument): PreviousMonthSnapshot {
  const categoryEndBalances: Record<string, number> = {}
  const accountEndBalances: Record<string, number> = {}

  for (const cb of month.category_balances || []) {
    categoryEndBalances[cb.category_id] = cb.end_balance
  }

  for (const ab of month.account_balances || []) {
    accountEndBalances[ab.account_id] = ab.end_balance
  }

  return {
    categoryEndBalances,
    accountEndBalances,
    totalIncome: month.total_income,
  }
}

