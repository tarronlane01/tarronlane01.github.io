/**
 * Create Month
 *
 * Creates a new month document with start balances from the previous month.
 * This is a write operation, so it lives in mutations.
 *
 * IMPORTANT: Validates that the budget exists before creating the month.
 * This prevents orphaned month documents if a budget was deleted.
 */

import type { MonthDocument, FirestoreData, CategoryMonthBalance, AccountMonthBalance, MonthMap } from '@types'
import { isMonthAtOrBeforeWindow } from '@utils/window'
import { readDocByPath, writeDocByPath, updateDocByPath } from '@firestore'
import { getMonthDocId, getPreviousMonth, getYearMonthOrdinal } from '@utils'
import { MAX_FUTURE_MONTHS } from '@constants'
import { queryClient, queryKeys } from '@data/queryClient'
import type { MonthQueryData } from '@data/queries/month/readMonth'
import { getEndBalancesFromMonth } from '@data/queries/month/getEndBalancesFromMonth'
import { updateCacheWithSingleMonth } from '@data/recalculation/monthMapHelpers'

/** Options for createMonth */
export interface CreateMonthOptions {
  /**
   * Bypass the date limit safeguard (MAX_FUTURE_MONTHS/MAX_PAST_MONTHS).
   * Use only for seed data imports or migrations that need to create historical months.
   */
  bypassDateLimit?: boolean
  /**
   * Optional callback to track budget changes for background save.
   * If provided, the budget month_map update will be tracked for background save.
   */
  trackBudgetChange?: (change: { type: 'budget'; budgetId: string }) => void
}

/**
 * Create a new month document with start balances from previous month.
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param options - Optional settings (e.g., bypassDateLimit for seed imports)
 * @returns The created month document
 * @throws Error if the month is beyond MAX_FUTURE_MONTHS/MAX_PAST_MONTHS (unless bypassed)
 */
export async function createMonth(
  budgetId: string,
  year: number,
  month: number,
  options?: CreateMonthOptions
): Promise<MonthDocument> {
  const { bypassDateLimit = false } = options ?? {}

  // Safeguard: Prevent creating months beyond the allowed range
  // This catches bugs like double-incrementing the year during navigation
  // Can be bypassed for seed data imports
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // Calculate months from now (positive = future, negative = past)
  const monthsFromNow = (year - currentYear) * 12 + (month - currentMonth)

  // Only restrict future months (past months are allowed if they exist in month_map)
  // fetchMonth already checks month_map before calling createMonth, so we can safely allow past months
  if (!bypassDateLimit && monthsFromNow > MAX_FUTURE_MONTHS) {
    const errorMsg = `[createMonth] Refusing to create month ${year}/${month} - ` +
      `it's ${monthsFromNow} months in the future (max allowed: ${MAX_FUTURE_MONTHS}). ` +
      `This likely indicates a bug in month navigation.`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Past months are allowed - fetchMonth already validates they exist in month_map before calling createMonth

  // FIRST: Validate that the budget exists before creating the month
  // This prevents orphaned month documents if the budget was deleted from another browser
  // We also use this data to update the month_map later (avoiding a second read)
  const { exists: budgetExists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    'validating budget exists before creating month'
  )

  if (!budgetExists || !budgetData) {
    // Clear the user's cached data since their budget no longer exists
    queryClient.removeQueries({ queryKey: queryKeys.budget(budgetId) })

    const errorMsg = `[createMonth] Budget ${budgetId} does not exist. ` +
      `It may have been deleted. Please refresh the page.`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  const nowIso = now.toISOString()
  const monthDocId = getMonthDocId(budgetId, year, month)

  let previousMonthIncome = 0
  let categoryStartBalances: Record<string, number> = {}
  let accountStartBalances: Record<string, number> = {}

  // For months after January, get previous month data
  // Check cache first, then use direct Firestore read if not in cache
  // IMPORTANT: Use direct Firestore read (not readMonth) to avoid caching null results.
  // If we cached null for a non-existent previous month, navigating to that month later
  // would return the cached null instead of triggering month creation.
  if (month > 1 || year > new Date().getFullYear() - 10) {
    const { year: prevYear, month: prevMonth } = getPreviousMonth(year, month)
    const prevMonthDocId = getMonthDocId(budgetId, prevYear, prevMonth)

    // CRITICAL: Check React Query cache first to use cached previous month data
    // This prevents duplicate reads when previous month is already in cache
    const prevMonthKey = queryKeys.month(budgetId, prevYear, prevMonth)
    const cachedPrevMonth = queryClient.getQueryData<{ month: MonthDocument }>(prevMonthKey)
    
    let prevData: FirestoreData | null = null
    
    if (cachedPrevMonth?.month) {
      // Previous month is in cache - use it
      // Convert MonthDocument back to FirestoreData format for compatibility
      const monthDoc = cachedPrevMonth.month
      prevData = {
        budget_id: monthDoc.budget_id,
        year_month_ordinal: monthDoc.year_month_ordinal,
        year: monthDoc.year,
        month: monthDoc.month,
        income: monthDoc.income,
        expenses: monthDoc.expenses,
        transfers: monthDoc.transfers,
        adjustments: monthDoc.adjustments,
        account_balances: monthDoc.account_balances,
        category_balances: monthDoc.category_balances,
        are_allocations_finalized: monthDoc.are_allocations_finalized,
        created_at: monthDoc.created_at,
        updated_at: monthDoc.updated_at,
      } as FirestoreData
    } else {
      // Not in cache - read directly from Firestore (to avoid caching null results)
      try {
        const { exists, data } = await readDocByPath<FirestoreData>(
          'months',
          prevMonthDocId,
          'fetching previous month to create start balances for new month'
        )
        if (exists) {
          prevData = data
        }
      } catch (error) {
        // Treat permission errors as "previous month doesn't exist" - start with zero balances
        // This handles non-admin users where the security rule fails for non-existent months
        const isPermissionError = error instanceof Error &&
          error.message.includes('Missing or insufficient permissions')

        if (isPermissionError) {
          console.warn(`[createMonth] Permission error reading previous month ${prevYear}/${prevMonth}, starting with zero balances`)
        } else {
          // Re-throw other errors
          throw error
        }
      }
    }

    if (prevData) {
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
          transfers: prevData.transfers || [],
          adjustments: prevData.adjustments || [],
          account_balances: prevData.account_balances || [],
          category_balances: prevData.category_balances || [],
          are_allocations_finalized: prevData.are_allocations_finalized ?? false,
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
  // Only include stored fields - calculated fields will be computed on-the-fly
  // Only save start_balance if month is at/before first window month
  const isAtOrBeforeWindow = isMonthAtOrBeforeWindow(year, month)
  const categoryBalances: CategoryMonthBalance[] = Object.entries(categoryStartBalances).map(
    ([categoryId, startBalance]) => ({
      category_id: categoryId,
      start_balance: isAtOrBeforeWindow ? startBalance : 0, // Only save if at/before window
      allocated: 0,
      // Calculated fields will be computed on-the-fly (spent, transfers, adjustments, end_balance)
      spent: 0,
      transfers: 0,
      adjustments: 0,
      end_balance: startBalance, // Calculated, but needed for in-memory use
    })
  )

  // Build account_balances with start_balance from previous month
  // Only include stored fields - calculated fields will be computed on-the-fly
  const accountBalances: AccountMonthBalance[] = Object.entries(accountStartBalances).map(
    ([accountId, startBalance]) => ({
      account_id: accountId,
      start_balance: isAtOrBeforeWindow ? startBalance : 0, // Only save if at/before window
      // Calculated fields will be computed on-the-fly (income, expenses, transfers, adjustments, net_change, end_balance)
      income: 0,
      expenses: 0,
      transfers: 0,
      adjustments: 0,
      net_change: 0,
      end_balance: startBalance, // Calculated, but needed for in-memory use
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
    transfers: [],
    adjustments: [],
    account_balances: accountBalances,
    category_balances: categoryBalances,
    are_allocations_finalized: false,
    created_at: nowIso,
    updated_at: nowIso,
  }

  // Build clean document for Firestore
  // Don't save total_income, total_expenses, or previous_month_income - they're calculated on-the-fly
  const docToWrite: FirestoreData = {
    budget_id: budgetId,
    year_month_ordinal: getYearMonthOrdinal(year, month),
    year,
    month,
    income: [],
    expenses: [],
    transfers: [],
    adjustments: [],
    account_balances: accountBalances,
    category_balances: categoryBalances,
    are_allocations_finalized: false,
    created_at: nowIso,
    updated_at: nowIso,
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

  // Add this month to the budget's month_map
  // We already have the budget data from our initial read, so no need to read again
  const monthOrdinal = getYearMonthOrdinal(year, month)
  const existingMonthMap: MonthMap = budgetData.month_map || {}
  // month_map entries are just empty objects (no flags)
  const updatedMonthMap: MonthMap = { ...existingMonthMap, [monthOrdinal]: {} }

  // Update cache immediately (instant UI feedback)
  // Track change for background save if callback provided
  updateCacheWithSingleMonth(budgetId, updatedMonthMap, options?.trackBudgetChange)

  // Write month_map to Firestore immediately (month creation is a special case - we need it persisted)
  // The change is also tracked for background save to ensure sync system picks it up
  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: nowIso,
  }, `adding month ${year}/${month} to budget month_map`)

  return newMonth
}

