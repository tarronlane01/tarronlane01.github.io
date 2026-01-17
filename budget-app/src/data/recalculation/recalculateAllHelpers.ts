/**
 * Helpers for RecalculateAllButton - Month processing logic
 */

import type { AccountsMap, MonthDocument, FirestoreData, CategoryMonthBalance, AccountMonthBalance, TransferTransaction, AdjustmentTransaction } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal, roundCurrency } from '@utils'

interface MonthData {
  year: number
  month: number
  total_income?: number
}

interface ProcessMonthResult {
  updatedMonth: MonthDocument
  totalIncome: number
  totalExpenses: number
  /** Net changes per account for this month (for running balance tracking) */
  accountNetChanges: Record<string, number>
}

/**
 * Check if a category ID is the special "No Category"
 */
function isNoCategory(categoryId: string): boolean {
  return categoryId === 'no_category' || categoryId === 'NO_CATEGORY'
}

/**
 * Calculate category adjustments from transfers and adjustments arrays.
 * Returns a map of category_id -> net adjustment amount.
 * - Transfers: from_category subtracts, to_category adds
 * - Adjustments: adds/subtracts based on amount sign
 */
function calculateCategoryAdjustments(
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): Record<string, number> {
  const result: Record<string, number> = {}

  // Process transfers (both from and to affect category balances)
  for (const transfer of transfers) {
    // Subtract from source category (if real category)
    if (!isNoCategory(transfer.from_category_id)) {
      result[transfer.from_category_id] = (result[transfer.from_category_id] || 0) - transfer.amount
    }
    // Add to destination category (if real category)
    if (!isNoCategory(transfer.to_category_id)) {
      result[transfer.to_category_id] = (result[transfer.to_category_id] || 0) + transfer.amount
    }
  }

  // Process adjustments (one-sided, only affects real categories)
  for (const adjustment of adjustments) {
    if (!isNoCategory(adjustment.category_id)) {
      result[adjustment.category_id] = (result[adjustment.category_id] || 0) + adjustment.amount
    }
  }

  // Round all values
  for (const catId of Object.keys(result)) {
    result[catId] = roundCurrency(result[catId])
  }

  return result
}

/**
 * Process a single month during recalculation
 */
export async function processMonth(
  budgetId: string,
  monthData: MonthData,
  categoryIds: string[],
  accounts: AccountsMap,
  runningCategoryBalances: Record<string, number>,
  runningAccountBalances: Record<string, number>,
  previousMonthIncome: number
): Promise<ProcessMonthResult | null> {
  const monthDocId = getMonthDocId(budgetId, monthData.year, monthData.month)
  const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
    'months', monthDocId, `recalculate: reading full month data`
  )

  if (!exists || !fullMonthData) return null

  // Recalculate totals (round to 2 decimal places)
  const income = fullMonthData.income || []
  const expenses = fullMonthData.expenses || []
  const transfers = (fullMonthData.transfers || []) as TransferTransaction[]
  const adjustments = (fullMonthData.adjustments || []) as AdjustmentTransaction[]
  const areAllocationsFinalized = fullMonthData.are_allocations_finalized || false

  const newTotalIncome = roundCurrency(income.reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0))
  const newTotalExpenses = roundCurrency(expenses.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0))

  // Get existing allocations from category_balances
  const existingCategoryBalances: Record<string, { allocated: number }> = {}
  if (fullMonthData.category_balances) {
    for (const cb of fullMonthData.category_balances) {
      existingCategoryBalances[cb.category_id] = { allocated: cb.allocated ?? 0 }
    }
  }

  // Calculate category adjustments from transfers and adjustments
  const categoryAdjustments = calculateCategoryAdjustments(transfers, adjustments)

  // Build category_balances using running balances for start (all values rounded)
  const monthCategoryBalances: CategoryMonthBalance[] = categoryIds.map(catId => {
    const startBalance = roundCurrency(runningCategoryBalances[catId] ?? 0)
    let allocated = 0
    if (areAllocationsFinalized && existingCategoryBalances[catId]) {
      allocated = roundCurrency(existingCategoryBalances[catId].allocated)
    }

    let spent = 0
    if (expenses.length > 0) {
      spent = roundCurrency(expenses
        .filter((e: { category_id: string }) => e.category_id === catId)
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0))
    }

    // Get adjustment for this category (from transfers and adjustments)
    const adjustment = categoryAdjustments[catId] ?? 0

    // Calculate transfers and adjustments separately for this category
    const categoryTransfers = roundCurrency(
      transfers
        .filter(t => t.from_category_id === catId || t.to_category_id === catId)
        .reduce((sum, t) => {
          if (t.from_category_id === catId) return sum - t.amount
          if (t.to_category_id === catId) return sum + t.amount
          return sum
        }, 0)
    )

    const categoryAdjustmentsTotal = roundCurrency(
      adjustments
        .filter(a => a.category_id === catId)
        .reduce((sum, a) => sum + a.amount, 0)
    )

    // end_balance = start + allocated + spent + adjustments (from transfers/adjustments)
    const endBalance = roundCurrency(startBalance + allocated + spent + adjustment)
    return {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      transfers: categoryTransfers,
      adjustments: categoryAdjustmentsTotal,
      end_balance: endBalance,
    }
  })

  // Update running balances for next month
  monthCategoryBalances.forEach(cb => {
    runningCategoryBalances[cb.category_id] = cb.end_balance
  })

  // Build account_balances (all values rounded)
  // Includes income, expenses, transfers, and adjustments
  // Uses running balances from previous months for accurate start_balance
  const accountIds = Object.keys(accounts)
  const accountNetChanges: Record<string, number> = {}

  const monthAccountBalances: AccountMonthBalance[] = accountIds.map(accountId => {
    const accountIncome = roundCurrency(income
      .filter((inc: { account_id: string }) => inc.account_id === accountId)
      .reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0))

    const accountExpenses = roundCurrency(expenses
      .filter((exp: { account_id: string }) => exp.account_id === accountId)
      .reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0))

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
    const netChange = roundCurrency(accountIncome + accountExpenses + transfersOut + transfersIn + adjustmentTotal)
    accountNetChanges[accountId] = netChange

    // Use running balance for start (from previous month's end balance)
    const startBalance = roundCurrency(runningAccountBalances[accountId] ?? 0)

    // Store transfers and adjustments separately
    const accountTransfers = roundCurrency(transfersOut + transfersIn)

    return {
      account_id: accountId,
      start_balance: startBalance,
      income: accountIncome,
      expenses: accountExpenses,
      transfers: accountTransfers,
      adjustments: adjustmentTotal,
      net_change: netChange,
      end_balance: roundCurrency(startBalance + netChange),
    }
  })

  // Update running account balances for next month
  for (const ab of monthAccountBalances) {
    runningAccountBalances[ab.account_id] = ab.end_balance
  }

  const updatedMonth: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: getYearMonthOrdinal(monthData.year, monthData.month),
    year: monthData.year,
    month: monthData.month,
    income: income,
    total_income: newTotalIncome,
    previous_month_income: previousMonthIncome,
    expenses: expenses,
    total_expenses: newTotalExpenses,
    transfers: transfers,
    adjustments: adjustments,
    account_balances: monthAccountBalances,
    category_balances: monthCategoryBalances,
    are_allocations_finalized: areAllocationsFinalized,
    created_at: fullMonthData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return { updatedMonth, totalIncome: newTotalIncome, totalExpenses: newTotalExpenses, accountNetChanges }
}

/**
 * Calculate account balances from ALL months for a budget
 */
export async function calculateAccountBalancesFromAllMonths(
  budgetId: string,
  accounts: AccountsMap
): Promise<Record<string, number>> {
  const { queryCollection } = await import('@firestore')
  const accountBalances: Record<string, number> = {}

  // Initialize all accounts to 0
  Object.keys(accounts).forEach(accId => {
    accountBalances[accId] = 0
  })

  // Query ALL months for this budget
  const allMonthsResult = await queryCollection<{ year: number; month: number }>(
    'months', 'recalculate: querying all months for account balances',
    [{ field: 'budget_id', op: '==', value: budgetId }]
  )

  // Sum up income, expenses, transfers, and adjustments from ALL months
  for (const monthDoc of allMonthsResult.docs) {
    const monthDocId = getMonthDocId(budgetId, monthDoc.data.year, monthDoc.data.month)
    const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
      'months', monthDocId, `recalculate: reading month for account balances`
    )

    if (!exists || !fullMonthData) continue

    const income = fullMonthData.income || []
    const expenses = fullMonthData.expenses || []
    const transfers = (fullMonthData.transfers || []) as TransferTransaction[]
    const adjustments = (fullMonthData.adjustments || []) as AdjustmentTransaction[]

    // Sum income
    for (const inc of income) {
      if (inc.account_id && accountBalances[inc.account_id] !== undefined) {
        accountBalances[inc.account_id] += inc.amount
      }
    }

    // Sum expenses (note: expenses follow CSV convention - negative = money out)
    for (const exp of expenses) {
      if (exp.account_id && accountBalances[exp.account_id] !== undefined) {
        accountBalances[exp.account_id] += exp.amount // Already includes sign
      }
    }

    // Sum transfers (transfers TO account add, transfers FROM account subtract)
    for (const transfer of transfers) {
      if (transfer.to_account_id && accountBalances[transfer.to_account_id] !== undefined) {
        accountBalances[transfer.to_account_id] += transfer.amount
      }
      if (transfer.from_account_id && accountBalances[transfer.from_account_id] !== undefined) {
        accountBalances[transfer.from_account_id] -= transfer.amount
      }
    }

    // Sum adjustments
    for (const adj of adjustments) {
      if (adj.account_id && accountBalances[adj.account_id] !== undefined) {
        accountBalances[adj.account_id] += adj.amount
      }
    }
  }

  // Round all final balances
  for (const accId of Object.keys(accountBalances)) {
    accountBalances[accId] = roundCurrency(accountBalances[accId])
  }

  return accountBalances
}

