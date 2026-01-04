/**
 * Helpers for RecalculateAllButton - Month processing logic
 */

import type { AccountsMap, MonthDocument, FirestoreData, CategoryMonthBalance, AccountMonthBalance } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'

interface MonthData {
  year: number
  month: number
  total_income?: number
}

interface ProcessMonthResult {
  updatedMonth: MonthDocument
  totalIncome: number
  totalExpenses: number
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
  previousMonthIncome: number
): Promise<ProcessMonthResult | null> {
  const monthDocId = getMonthDocId(budgetId, monthData.year, monthData.month)
  const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
    'months', monthDocId, `recalculate: reading full month data`
  )

  if (!exists || !fullMonthData) return null

  // Recalculate totals
  const income = fullMonthData.income || []
  const expenses = fullMonthData.expenses || []
  const areAllocationsFinalized = fullMonthData.are_allocations_finalized || false

  const newTotalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0)
  const newTotalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0)

  // Get existing allocations from category_balances
  const existingCategoryBalances: Record<string, { allocated: number }> = {}
  if (fullMonthData.category_balances) {
    for (const cb of fullMonthData.category_balances) {
      existingCategoryBalances[cb.category_id] = { allocated: cb.allocated ?? 0 }
    }
  }

  // Build category_balances using running balances for start
  const monthCategoryBalances: CategoryMonthBalance[] = categoryIds.map(catId => {
    const startBalance = runningCategoryBalances[catId] ?? 0
    let allocated = 0
    if (areAllocationsFinalized && existingCategoryBalances[catId]) {
      allocated = existingCategoryBalances[catId].allocated
    }

    let spent = 0
    if (expenses.length > 0) {
      spent = expenses
        .filter((e: { category_id: string }) => e.category_id === catId)
        .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
    }

    const endBalance = startBalance + allocated + spent
    return { category_id: catId, start_balance: startBalance, allocated, spent, end_balance: endBalance }
  })

  // Update running balances for next month
  monthCategoryBalances.forEach(cb => {
    runningCategoryBalances[cb.category_id] = cb.end_balance
  })

  // Build account_balances
  const accountIds = Object.keys(accounts)
  const monthAccountBalances: AccountMonthBalance[] = accountIds.map(accountId => {
    const accountIncome = income
      .filter((inc: { account_id: string }) => inc.account_id === accountId)
      .reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0)

    const accountExpenses = expenses
      .filter((exp: { account_id: string }) => exp.account_id === accountId)
      .reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0)

    const netChange = accountIncome + accountExpenses

    let startBalance = 0
    if (fullMonthData.account_balances) {
      const existing = fullMonthData.account_balances.find(
        (ab: { account_id: string }) => ab.account_id === accountId
      )
      if (existing) startBalance = existing.start_balance ?? 0
    }

    return {
      account_id: accountId,
      start_balance: startBalance,
      income: accountIncome,
      expenses: accountExpenses,
      net_change: netChange,
      end_balance: startBalance + netChange,
    }
  })

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
    account_balances: monthAccountBalances,
    category_balances: monthCategoryBalances,
    are_allocations_finalized: areAllocationsFinalized,
    created_at: fullMonthData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return { updatedMonth, totalIncome: newTotalIncome, totalExpenses: newTotalExpenses }
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

  // Sum up income and expenses from ALL months
  for (const monthDoc of allMonthsResult.docs) {
    const monthDocId = getMonthDocId(budgetId, monthDoc.data.year, monthDoc.data.month)
    const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
      'months', monthDocId, `recalculate: reading month for account balances`
    )

    if (!exists || !fullMonthData) continue

    const income = fullMonthData.income || []
    const expenses = fullMonthData.expenses || []

    for (const inc of income) {
      if (inc.account_id && accountBalances[inc.account_id] !== undefined) {
        accountBalances[inc.account_id] += inc.amount
      }
    }

    for (const exp of expenses) {
      if (exp.account_id && accountBalances[exp.account_id] !== undefined) {
        accountBalances[exp.account_id] -= exp.amount
      }
    }
  }

  return accountBalances
}

