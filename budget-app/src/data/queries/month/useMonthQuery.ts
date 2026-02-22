/**
 * Month Query Hook
 *
 * React Query hook for fetching month-level documents.
 *
 * IMPORTANT: This hook reads directly from Firestore instead of using readMonth
 * to avoid a deadlock. readMonth uses queryClient.fetchQuery with the same
 * query key, which would cause React Query to wait for itself (deadlock).
 *
 * RECALCULATION:
 * The recalculation check happens in a useEffect that watches the returned data.
 * This ensures recalculation triggers whether the data came from cache or Firestore.
 * The check MUST be outside queryFn because queryFn doesn't run on cache hits.
 *
 * When a month doesn't exist, it creates a new one using createMonth
 * (which is in mutations since it's a write operation).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import type { MonthDocument, FirestoreData } from '@types'
import type { MonthQueryData } from './readMonth'
import { ensureBudgetInCache } from '@data/queries/budget/fetchBudget'
import { createMonth } from '@data/mutations/month/createMonth'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal, canCreateMonth, MonthNavigationError } from '@utils'
import { useBudget } from '@contexts'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'
import { calculatePreviousMonthIncome } from './calculatePreviousMonthIncome'

/**
 * Parse raw Firestore month data into typed MonthDocument.
 * Duplicated from readMonth.ts to avoid importing the function that uses fetchQuery.
 * Calculates total_income, total_expenses, and previous_month_income from arrays (not stored in Firestore).
 */
import type { QueryClient } from '@tanstack/react-query'

async function parseMonthData(
  data: FirestoreData,
  budgetId: string,
  year: number,
  month: number,
  queryClient?: QueryClient,
  monthsBack: number = 1
): Promise<MonthDocument> {
  const income = data.income || []
  const expenses = data.expenses || []
  
  // Calculate totals from arrays (not stored in Firestore - calculated on-the-fly)
  const totalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + (inc.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0)
  
  // Only fetch previous month's income when allocations are not finalized (needed for % allocation display).
  // When finalized, skip the fetch; use 0. Edit Allocations flow fetches it behind a loading overlay.
  const areAllocationsFinalized = data.are_allocations_finalized ?? false
  const previousMonthIncome = areAllocationsFinalized
    ? 0
    : await calculatePreviousMonthIncome(budgetId, year, month, queryClient, monthsBack)
  
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income,
    total_income: totalIncome, // Calculated from income array
    previous_month_income: previousMonthIncome, // Calculated from previous month's income array
    expenses,
    total_expenses: totalExpenses, // Calculated from expenses array
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  // Convert stored balances to calculated balances
  return convertMonthBalancesFromStored(monthDoc)
}

/**
 * Read month directly from Firestore.
 *
 * This bypasses queryClient.fetchQuery to avoid deadlocking with useQuery.
 * The useQuery hook itself handles caching - we don't need another cache layer.
 *
 * NOTE: Permission errors are caught and treated as "not found" to allow
 * month creation to proceed. This handles the case where non-admin users
 * try to read a non-existent month document - the security rule fails because
 * it can't access resource.data.budget_id on a non-existent document.
 */
export async function readMonthDirect(
  budgetId: string,
  year: number,
  month: number,
  queryClient?: QueryClient,
  monthsBack: number = 1
): Promise<MonthDocument | null> {
  const monthDocId = getMonthDocId(budgetId, year, month)

  try {
    const { exists, data } = await readDocByPath<FirestoreData>(
      'months',
      monthDocId,
      `loading month ${year}/${month}`
    )

    if (!exists || !data) {
      return null
    }

    return await parseMonthData(data, budgetId, year, month, queryClient, monthsBack)
  } catch (error) {
    // Treat permission errors as "not found" - this allows month creation to proceed
    // This handles non-admin users reading non-existent months where the security
    // rule fails because resource.data.budget_id doesn't exist
    const isPermissionError = error instanceof Error &&
      error.message.includes('Missing or insufficient permissions')

    if (isPermissionError) {
      console.warn(`[readMonthDirect] Permission error reading month ${year}/${month}, treating as not found`)
      return null
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Fetch month document - checks cache first, then reads from Firestore, creates new if needed.
 *
 * NOTE: Recalculation is NOT triggered here. It's handled in the useMonthQuery
 * hook via useEffect to ensure it runs whether data came from cache or Firestore.
 *
 * IMPORTANT: Only creates a month if it exists in the budget's month_map.
 * This prevents creating months when navigating backwards to months that don't exist.
 */
export async function fetchMonth(
  budgetId: string,
  year: number,
  month: number,
  queryClient?: ReturnType<typeof useQueryClient>
): Promise<MonthDocument> {
  // CRITICAL: Check React Query cache first to use prefetched data
  // Only recompute previous_month_income when allocations are not finalized (needed for % allocation display).
  // When finalized, return cached month as-is; Edit Allocations fetches it behind a loading overlay.
  if (queryClient) {
    const monthKey = queryKeys.month(budgetId, year, month)
    const cachedData = queryClient.getQueryData<MonthQueryData>(monthKey)
    if (cachedData?.month) {
      if (!cachedData.month.are_allocations_finalized) {
        const budgetData = await ensureBudgetInCache(budgetId, queryClient)
        const monthsBack = budgetData.budget.percentage_income_months_back ?? 1 // legacy unmigrated budget only
        const previousMonthIncome = await calculatePreviousMonthIncome(budgetId, year, month, queryClient, monthsBack)
        return { ...cachedData.month, previous_month_income: previousMonthIncome }
      }
      return cachedData.month
    }
  }

  // Not in cache - ensure budget in cache, then read month
  const budgetData = queryClient ? await ensureBudgetInCache(budgetId, queryClient) : null
  const monthsBack = budgetData?.budget.percentage_income_months_back ?? 1 // legacy unmigrated budget only
  const existingMonth = await readMonthDirect(budgetId, year, month, queryClient, monthsBack)

  if (existingMonth) {
    return existingMonth
  }

  // Check if we can create this month using centralized rules from @utils/monthCreationRules
  // Rules: edge months must be within 3 calendar months of today, and you must walk one month at a time
  
  let monthMap: Record<string, unknown> | null = null
  
  if (queryClient && budgetData && budgetData.monthMap) {
    monthMap = budgetData.monthMap as Record<string, unknown>
  } else {
    // If not in cache, read budget to check month_map
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets',
      budgetId,
      'checking month_map before creating month'
    )
    if (exists && data?.month_map) {
      monthMap = data.month_map as Record<string, unknown>
    }
  }

  // Use centralized month creation rules
  const creationResult = canCreateMonth(year, month, monthMap)
  
  if (creationResult.allowed) {
    return createMonth(budgetId, year, month)
  }

  // Month creation not allowed - throw structured error for redirect handling
  throw new MonthNavigationError(
    creationResult.error || `Month ${year}/${month} cannot be created.`,
    year,
    month,
    true // shouldRedirectToValidMonth
  )
}

/**
 * Query hook for month-level document
 *
 * Returns the complete month data including income, expenses, allocations,
 * and the previous month snapshot for cross-month calculations.
 *
 * NOTE: Recalculation is NOT automatically triggered by this hook.
 * The Balances tab handles recalculation when needed to avoid unnecessary
 * recalculations when viewing Income or Spend tabs.
 *
 * @param budgetId - The budget ID
 * @param year - The year
 * @param month - The month (1-12)
 * @param options - Additional query options
 */
export function useMonthQuery(
  budgetId: string | null,
  year: number,
  month: number,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient()
  const { initialDataLoadComplete } = useBudget()

  const queryKey = budgetId ? queryKeys.month(budgetId, year, month) : ['month', 'none']

  // Enable query only if:
  // 1. Budget ID is provided
  // 2. Options don't explicitly disable it
  // 3. Initial data load is complete (cache is populated) OR we need to fetch
  // This ensures we don't try to fetch before cache is ready on initial load
  const isEnabled = !!budgetId &&
    (options?.enabled !== false) &&
    initialDataLoadComplete

  // Check if there's already data or error cached for this query
  const existingData = queryClient.getQueryData(queryKey)
  const existingState = queryClient.getQueryState(queryKey)
  
  // Force refetch if state is "success" but there's no data (stale state from initialDataLoad)
  if (existingState?.status === 'success' && !existingData) {
    queryClient.resetQueries({ queryKey, exact: true })
  }

  return useQuery({
    queryKey,
    queryFn: async (): Promise<MonthQueryData> => {
      const monthData = await fetchMonth(budgetId!, year, month, queryClient)
      return { month: monthData }
    },
    enabled: isEnabled,
    // React Query will automatically use cached data if it exists and is not stale
    // The cache is populated by useInitialDataLoad with updatedAt timestamps
    // Setting staleTime ensures React Query knows when data is fresh (5 minutes)
    staleTime: STALE_TIME, // 5 minutes - matches queryClient default
    // fetchMonth now checks cache first, so even if queryFn is called, it will use prefetched data
    // Don't retry MonthNavigationError - retrying won't help and delays error handling
    retry: (failureCount, error) => {
      if (MonthNavigationError.is(error)) return false
      return failureCount < 3
    },
  })
}
