/**
 * Recalculate Month
 *
 * Pure calculation logic for recalculating a single month's derived values.
 * Takes the previous month's end balances and calculates correct values for:
 * - category_balances (start_balance, end_balance)
 * - account_balances (start_balance, end_balance, income, expenses, net_change)
 * - previous_month_income
 *
 * Handles all transaction types:
 * - income: adds to account balance
 * - expenses: subtracts from account and category balances
 * - transfers: moves money between accounts/categories (from = subtract, to = add)
 * - adjustments: one-sided corrections (can affect account and/or category)
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
  // Recalculate totals from transactions (ensures totals match actual transactions)
  const income = month.income || []
  const expenses = month.expenses || []
  const totalIncome = roundCurrency(income.reduce((sum, inc) => sum + inc.amount, 0))
  const totalExpenses = roundCurrency(expenses.reduce((sum, exp) => sum + exp.amount, 0))

  // Calculate category adjustments from transfers and adjustments (combined, for legacy compatibility)
  const categoryAdjustments = calculateCategoryAdjustments(month)

  // Calculate separate transfers and adjustments per category
  const { transfersMap, adjustmentsMap } = calculateCategoryTransfersAndAdjustments(month)

  // Recalculate category balances (including transfers and adjustments)
  const categoryBalances = recalculateCategoryBalances(
    month.category_balances,
    prevSnapshot.categoryEndBalances,
    categoryAdjustments,
    transfersMap,
    adjustmentsMap
  )

  // Recalculate account balances from all transaction types
  const accountBalances = recalculateAccountBalances(
    month,
    prevSnapshot.accountEndBalances
  )

  return {
    ...month,
    total_income: totalIncome,
    total_expenses: totalExpenses,
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
 * Calculate net category adjustments from transfers and adjustments.
 * Returns a map of category_id -> net adjustment amount.
 * - Transfers: from_category subtracts, to_category adds
 * - Adjustments: adds/subtracts based on amount sign (if category is real)
 */
function calculateCategoryAdjustments(month: MonthDocument): Record<string, number> {
  const adjustments: Record<string, number> = {}

  // Process transfers (both from and to affect category balances)
  for (const transfer of month.transfers || []) {
    // Subtract from source category (if real category)
    if (!isNoCategory(transfer.from_category_id)) {
      adjustments[transfer.from_category_id] = (adjustments[transfer.from_category_id] || 0) - transfer.amount
    }
    // Add to destination category (if real category)
    if (!isNoCategory(transfer.to_category_id)) {
      adjustments[transfer.to_category_id] = (adjustments[transfer.to_category_id] || 0) + transfer.amount
    }
  }

  // Process adjustments (one-sided, only affects real categories)
  for (const adjustment of month.adjustments || []) {
    if (!isNoCategory(adjustment.category_id)) {
      adjustments[adjustment.category_id] = (adjustments[adjustment.category_id] || 0) + adjustment.amount
    }
  }

  // Round all values
  for (const catId of Object.keys(adjustments)) {
    adjustments[catId] = roundCurrency(adjustments[catId])
  }

  return adjustments
}

/**
 * Calculate separate transfers and adjustments per category.
 * Returns maps of category_id -> transfer amount and category_id -> adjustment amount.
 */
function calculateCategoryTransfersAndAdjustments(month: MonthDocument): {
  transfersMap: Record<string, number>
  adjustmentsMap: Record<string, number>
} {
  const transfersMap: Record<string, number> = {}
  const adjustmentsMap: Record<string, number> = {}

  // Process transfers
  for (const transfer of month.transfers || []) {
    // Subtract from source category (if real category)
    if (!isNoCategory(transfer.from_category_id)) {
      transfersMap[transfer.from_category_id] = (transfersMap[transfer.from_category_id] || 0) - transfer.amount
    }
    // Add to destination category (if real category)
    if (!isNoCategory(transfer.to_category_id)) {
      transfersMap[transfer.to_category_id] = (transfersMap[transfer.to_category_id] || 0) + transfer.amount
    }
  }

  // Process adjustments
  for (const adjustment of month.adjustments || []) {
    if (!isNoCategory(adjustment.category_id)) {
      adjustmentsMap[adjustment.category_id] = (adjustmentsMap[adjustment.category_id] || 0) + adjustment.amount
    }
  }

  // Round all values
  for (const catId of Object.keys(transfersMap)) {
    transfersMap[catId] = roundCurrency(transfersMap[catId])
  }
  for (const catId of Object.keys(adjustmentsMap)) {
    adjustmentsMap[catId] = roundCurrency(adjustmentsMap[catId])
  }

  return { transfersMap, adjustmentsMap }
}

/**
 * Recalculate category balances with correct start balances from previous month.
 * Includes adjustments from transfers and adjustment transactions.
 * Note: The special "No Category" is excluded as it doesn't track balances.
 */
function recalculateCategoryBalances(
  currentBalances: CategoryMonthBalance[],
  prevCategoryEndBalances: Record<string, number>,
  categoryAdjustments: Record<string, number>,
  transfersMap: Record<string, number>,
  adjustmentsMap: Record<string, number>
): CategoryMonthBalance[] {
  // Build map of existing balances (excluding "No Category")
  const balanceMap = new Map<string, CategoryMonthBalance>()
  for (const cb of currentBalances) {
    if (isNoCategory(cb.category_id)) continue
    balanceMap.set(cb.category_id, cb)
  }

  // Collect all category IDs that need balances
  const allCategoryIds = new Set<string>()
  for (const cb of currentBalances) {
    if (!isNoCategory(cb.category_id)) allCategoryIds.add(cb.category_id)
  }
  for (const catId of Object.keys(prevCategoryEndBalances)) {
    if (!isNoCategory(catId)) allCategoryIds.add(catId)
  }
  for (const catId of Object.keys(categoryAdjustments)) {
    if (!isNoCategory(catId)) allCategoryIds.add(catId)
  }

  // Update each existing balance with correct start_balance (excluding "No Category")
  // Note: spent is negative for money out, positive for money in
  // All values are rounded to 2 decimal places to avoid floating point precision issues
  const updated: CategoryMonthBalance[] = []

  for (const catId of allCategoryIds) {
    const existing = balanceMap.get(catId)
    const startBalance = roundCurrency(prevCategoryEndBalances[catId] ?? 0)
    const allocated = roundCurrency(existing?.allocated ?? 0)
    const spent = roundCurrency(existing?.spent ?? 0)
    const transfers = roundCurrency(transfersMap[catId] ?? 0)
    const adjustments = roundCurrency(adjustmentsMap[catId] ?? 0)

    updated.push({
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      transfers,
      adjustments,
      // end_balance = start + allocated + spent + transfers + adjustments
      end_balance: roundCurrency(startBalance + allocated + spent + transfers + adjustments),
    })
  }

  return updated
}

/**
 * Recalculate account balances from all transaction types.
 * Includes: income, expenses, transfers, and adjustments.
 * Note: The special "No Account" is excluded as it doesn't track balances.
 */
function recalculateAccountBalances(
  month: MonthDocument,
  prevAccountEndBalances: Record<string, number>
): AccountMonthBalance[] {
  // Collect all account IDs from all transaction types and previous balances (excluding No Account)
  const accountIds = new Set<string>()

  for (const income of month.income || []) {
    if (isNoAccount(income.account_id)) continue
    accountIds.add(income.account_id)
  }
  for (const expense of month.expenses || []) {
    if (isNoAccount(expense.account_id)) continue
    accountIds.add(expense.account_id)
  }
  for (const transfer of month.transfers || []) {
    if (!isNoAccount(transfer.from_account_id)) accountIds.add(transfer.from_account_id)
    if (!isNoAccount(transfer.to_account_id)) accountIds.add(transfer.to_account_id)
  }
  for (const adjustment of month.adjustments || []) {
    if (!isNoAccount(adjustment.account_id)) accountIds.add(adjustment.account_id)
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

    // Calculate transfer effects for this account
    // Transfers out (from_account) subtract, transfers in (to_account) add
    const transfersOut = roundCurrency((month.transfers || [])
      .filter(t => t.from_account_id === accountId)
      .reduce((sum, t) => sum - t.amount, 0))

    const transfersIn = roundCurrency((month.transfers || [])
      .filter(t => t.to_account_id === accountId)
      .reduce((sum, t) => sum + t.amount, 0))

    // Net transfers = transfers in + transfers out (transfersOut is negative)
    const transfersTotal = roundCurrency(transfersIn + transfersOut)

    // Calculate adjustment effects for this account
    const adjustmentTotal = roundCurrency((month.adjustments || [])
      .filter(a => a.account_id === accountId)
      .reduce((sum, a) => sum + a.amount, 0))

    // Net change includes all transaction types
    const netChange = roundCurrency(incomeTotal + expensesTotal + transfersTotal + adjustmentTotal)

    balances.push({
      account_id: accountId,
      start_balance: startBalance,
      income: incomeTotal,
      expenses: expensesTotal,
      transfers: transfersTotal,
      adjustments: adjustmentTotal,
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

