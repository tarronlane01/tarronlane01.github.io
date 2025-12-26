/**
 * Helper Functions for Month Mutations
 *
 * Shared utilities used across income, expense, and allocation mutations.
 */

import type { MonthDocument, AccountsMap, CategoryAllocation, CategoryMonthBalance, AccountMonthBalance } from '../../types/budget'
import {
  getMonthDocId,
  cleanIncomeForFirestore,
  cleanExpensesForFirestore,
  cleanAllocationsForFirestore,
  cleanCategoryBalancesForFirestore,
  cleanAccountsForFirestore,
  writeDoc,
  readDoc,
  type FirestoreData,
} from '../firestore/operations'
import { markNextMonthSnapshotStaleInFirestore } from '../queries/useMonthQuery'

/**
 * Save month document to Firestore AND automatically mark next month as stale.
 *
 * CROSS-MONTH PATTERN:
 * Any change to a month potentially affects the next month's snapshot.
 * This function centralizes both operations so we never forget to mark stale.
 *
 * The stale flag is only written to Firestore if not already stale (avoids duplicate writes).
 *
 * @param budgetId - Budget ID
 * @param month - Month document to save
 * @param options.skipNextMonthStale - If true, skip marking next month as stale.
 *   Use this for operations that don't affect balances (e.g., saving draft allocations).
 */
export async function saveMonthToFirestore(
  budgetId: string,
  month: MonthDocument,
  options?: { skipNextMonthStale?: boolean }
) {
  const monthDocId = getMonthDocId(budgetId, month.year, month.month)

  const cleanedMonth: FirestoreData = {
    budget_id: month.budget_id,
    year: month.year,
    month: month.month,
    income: cleanIncomeForFirestore(month.income),
    total_income: month.total_income,
    updated_at: new Date().toISOString(),
  }

  if (month.created_at) cleanedMonth.created_at = month.created_at
  if (month.expenses) cleanedMonth.expenses = cleanExpensesForFirestore(month.expenses)
  if (month.total_expenses !== undefined) cleanedMonth.total_expenses = month.total_expenses
  if (month.allocations) cleanedMonth.allocations = cleanAllocationsForFirestore(month.allocations)
  if (month.allocations_finalized !== undefined) cleanedMonth.allocations_finalized = month.allocations_finalized
  if (month.category_balances) cleanedMonth.category_balances = cleanCategoryBalancesForFirestore(month.category_balances)
  if (month.category_balances_stale !== undefined) cleanedMonth.category_balances_stale = month.category_balances_stale
  if (month.account_balances_start) cleanedMonth.account_balances_start = month.account_balances_start
  if (month.account_balances_end) cleanedMonth.account_balances_end = month.account_balances_end
  if (month.previous_month_snapshot) cleanedMonth.previous_month_snapshot = month.previous_month_snapshot
  if (month.previous_month_snapshot_stale !== undefined) cleanedMonth.previous_month_snapshot_stale = month.previous_month_snapshot_stale

  // Save the month document
  await writeDoc(
    'months',
    monthDocId,
    cleanedMonth,
    'saveMonthToFirestore: saving month document after mutation'
  )

  // CROSS-MONTH: Mark next month as stale (only writes to Firestore if not already stale)
  // Skip this for operations that don't affect balances (e.g., saving draft allocations)
  if (!options?.skipNextMonthStale) {
    await markNextMonthSnapshotStaleInFirestore(budgetId, month.year, month.month)
  }
}

/**
 * Update account balance in budget document and return updated accounts
 */
export async function updateAccountBalance(
  budgetId: string,
  accountId: string,
  delta: number
): Promise<AccountsMap | null> {
  const { exists, data } = await readDoc<FirestoreData>(
    'budgets',
    budgetId,
    `reading budget to update account balance (delta: ${delta})`
  )

  if (!exists || !data) return null

  const accounts = data.accounts || {}

  if (!accounts[accountId]) return null

  const updatedAccounts = {
    ...accounts,
    [accountId]: {
      ...accounts[accountId],
      balance: accounts[accountId].balance + delta,
    },
  }

  await writeDoc(
    'budgets',
    budgetId,
    {
      ...data,
      accounts: cleanAccountsForFirestore(updatedAccounts),
    },
    'saving updated account balance after income/expense change'
  )

  return updatedAccounts
}

/**
 * Save payee if new and return updated payees list
 */
export async function savePayeeIfNew(
  budgetId: string,
  payee: string,
  existingPayees: string[]
): Promise<string[] | null> {
  const trimmed = payee.trim()
  if (!trimmed || existingPayees.includes(trimmed)) return null

  const updatedPayees = [...existingPayees, trimmed].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  await writeDoc(
    'payees',
    budgetId,
    {
      budget_id: budgetId,
      payees: updatedPayees,
      updated_at: new Date().toISOString(),
    },
    `adding new payee "${trimmed}" to autocomplete list`
  )

  return updatedPayees
}

// ============================================================================
// CATEGORY BALANCES CALCULATION HELPER
// ============================================================================

/**
 * Calculate category balances for a month given the allocations and finalized state.
 * This allows us to compute fresh values inline during mutations instead of marking stale.
 *
 * @param monthData - The month document (needs previous_month_snapshot and expenses)
 * @param categoryIds - List of all category IDs to calculate for
 * @param allocations - The allocations to use (may be different from monthData.allocations)
 * @param allocationsFinalized - Whether allocations are finalized
 * @returns Calculated category balances array
 */
export function calculateCategoryBalancesForMonth(
  monthData: MonthDocument,
  categoryIds: string[],
  allocations: CategoryAllocation[],
  allocationsFinalized: boolean
): CategoryMonthBalance[] {
  const prevBalances = monthData.previous_month_snapshot?.category_balances_end ?? {}
  const expenses = monthData.expenses ?? []

  return categoryIds.map(catId => {
    // Start balance comes from previous month's end balance
    const startBalance = prevBalances[catId] ?? 0

    // Allocated amount (only if finalized)
    let allocated = 0
    if (allocationsFinalized) {
      const alloc = allocations.find(a => a.category_id === catId)
      if (alloc) allocated = alloc.amount
    }

    // Sum expenses for this category
    const spent = expenses
      .filter(e => e.category_id === catId)
      .reduce((sum, e) => sum + e.amount, 0)

    return {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      end_balance: startBalance + allocated - spent,
    }
  })
}

// ============================================================================
// ACCOUNT BALANCES CALCULATION HELPER
// ============================================================================

/**
 * Calculate account balances for a month based on income and expenses.
 *
 * @param monthData - The month document (needs previous_month_snapshot, income, expenses)
 * @param accountIds - List of all account IDs to calculate for
 * @param accountCurrentBalances - Current account balances (fallback for first month)
 * @returns Object with account_balances_end map and AccountMonthBalance array
 */
export function calculateAccountBalancesForMonth(
  monthData: MonthDocument,
  accountIds: string[],
  accountCurrentBalances: Record<string, number>
): {
  accountBalancesEnd: Record<string, number>
  accountMonthBalances: AccountMonthBalance[]
} {
  const prevBalances = monthData.previous_month_snapshot?.account_balances_end ?? {}
  const income = monthData.income ?? []
  const expenses = monthData.expenses ?? []

  const accountBalancesEnd: Record<string, number> = {}
  const accountMonthBalances: AccountMonthBalance[] = []

  accountIds.forEach(accountId => {
    // Start balance from previous month's end, or current balance if first month
    const startBalance = prevBalances[accountId] ?? accountCurrentBalances[accountId] ?? 0

    // Sum income for this account
    const incomeTotal = income
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0)

    // Sum expenses for this account
    const expensesTotal = expenses
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + e.amount, 0)

    const netChange = incomeTotal - expensesTotal
    const endBalance = startBalance + netChange

    accountBalancesEnd[accountId] = endBalance

    accountMonthBalances.push({
      account_id: accountId,
      start_balance: startBalance,
      income: incomeTotal,
      expenses: expensesTotal,
      net_change: netChange,
      end_balance: endBalance,
    })
  })

  return { accountBalancesEnd, accountMonthBalances }
}

// ============================================================================
// RE-EXPORT STALE HELPERS FROM DEDICATED FILE
// ============================================================================

export {
  markCategoryBalancesSnapshotStaleInCache,
  markCategoryBalancesSnapshotStaleInFirestore,
  markMonthCategoryBalancesStaleInCache,
  markMonthCategoryBalancesStaleInFirestore,
  markFutureMonthsCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInFirestore,
} from './categoryBalanceStaleHelpers'

