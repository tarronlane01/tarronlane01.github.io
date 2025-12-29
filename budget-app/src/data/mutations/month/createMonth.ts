/**
 * Create Month
 *
 * Creates a new month document with start balances from the previous month.
 * This is a write operation, so it lives in mutations.
 */

import type { MonthDocument, FirestoreData, CategoryMonthBalance, AccountMonthBalance } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { getMonthDocId, getPreviousMonth, getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys } from '@data/queryClient'
import type { MonthQueryData } from '@data/queries/month/readMonth'
import { getEndBalancesFromMonth } from '@data/queries/month/getEndBalancesFromMonth'

/**
 * Create a new month document with start balances from previous month.
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @returns The created month document
 */
export async function createMonth(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthDocument> {
  const now = new Date().toISOString()
  const monthDocId = getMonthDocId(budgetId, year, month)

  let previousMonthIncome = 0
  let categoryStartBalances: Record<string, number> = {}
  let accountStartBalances: Record<string, number> = {}

  // For months after January, get previous month data
  // IMPORTANT: Use direct Firestore read (not readMonth) to avoid caching null results.
  // If we cached null for a non-existent previous month, navigating to that month later
  // would return the cached null instead of triggering month creation.
  if (month > 1 || year > new Date().getFullYear() - 10) {
    const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month)
    const prevMonthDocId = getMonthDocId(budgetId, prevYear, prevMonth)

    const { exists, data: prevData } = await readDocByPath<FirestoreData>(
      'months',
      prevMonthDocId,
      'fetching previous month to create start balances for new month'
    )

    if (exists && prevData) {
      // Parse the previous month data to extract balances
      const prevMonthData: MonthDocument = {
        budget_id: budgetId,
        year_month_ordinal: prevData.year_month_ordinal ?? getYearMonthOrdinal(prevYear, prevMonth),
        year: prevData.year ?? prevYear,
        month: prevData.month ?? prevMonth,
        income: prevData.income || [],
        total_income: prevData.total_income ?? 0,
        previous_month_income: prevData.previous_month_income ?? 0,
        expenses: prevData.expenses || [],
        total_expenses: prevData.total_expenses ?? 0,
        account_balances: prevData.account_balances || [],
        category_balances: prevData.category_balances || [],
        are_allocations_finalized: prevData.are_allocations_finalized ?? false,
        is_needs_recalculation: prevData.is_needs_recalculation ?? false,
        created_at: prevData.created_at,
        updated_at: prevData.updated_at,
      }

      previousMonthIncome = prevMonthData.total_income
      const { categoryEndBalances, accountEndBalances } = getEndBalancesFromMonth(prevMonthData)
      categoryStartBalances = categoryEndBalances
      accountStartBalances = accountEndBalances
    }
  }

  // Build category_balances with start_balance from previous month
  const categoryBalances: CategoryMonthBalance[] = Object.entries(categoryStartBalances).map(
    ([categoryId, startBalance]) => ({
      category_id: categoryId,
      start_balance: startBalance,
      allocated: 0,
      spent: 0,
      end_balance: startBalance,
    })
  )

  // Build account_balances with start_balance from previous month
  const accountBalances: AccountMonthBalance[] = Object.entries(accountStartBalances).map(
    ([accountId, startBalance]) => ({
      account_id: accountId,
      start_balance: startBalance,
      income: 0,
      expenses: 0,
      net_change: 0,
      end_balance: startBalance,
    })
  )

  const newMonth: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: getYearMonthOrdinal(year, month),
    year,
    month,
    income: [],
    total_income: 0,
    previous_month_income: previousMonthIncome,
    expenses: [],
    total_expenses: 0,
    account_balances: accountBalances,
    category_balances: categoryBalances,
    are_allocations_finalized: false,
    is_needs_recalculation: false,
    created_at: now,
    updated_at: now,
  }

  // Build clean document for Firestore
  const docToWrite: FirestoreData = {
    budget_id: budgetId,
    year_month_ordinal: getYearMonthOrdinal(year, month),
    year,
    month,
    income: [],
    total_income: 0,
    previous_month_income: previousMonthIncome,
    expenses: [],
    total_expenses: 0,
    account_balances: accountBalances,
    category_balances: categoryBalances,
    are_allocations_finalized: false,
    is_needs_recalculation: false,
    created_at: now,
    updated_at: now,
  }

  await writeDocByPath(
    'months',
    monthDocId,
    docToWrite,
    'creating new month document (first time viewing this month)'
  )

  // Cache the new month
  queryClient.setQueryData<MonthQueryData>(
    queryKeys.month(budgetId, year, month),
    { month: newMonth }
  )

  return newMonth
}

