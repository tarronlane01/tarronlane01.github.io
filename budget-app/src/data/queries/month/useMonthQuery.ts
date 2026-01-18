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
import type { BudgetData } from '@data/queries/budget/fetchBudget'
import { createMonth } from '@data/mutations/month/createMonth'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { useBudget } from '@contexts'

/**
 * Parse raw Firestore month data into typed MonthDocument.
 * Duplicated from readMonth.ts to avoid importing the function that uses fetchQuery.
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  return {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
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
  month: number
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

    return parseMonthData(data, budgetId, year, month)
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
 * Fetch month document - reads directly from Firestore, creates new if needed.
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
  // Read directly from Firestore (no fetchQuery to avoid deadlock)
  const existingMonth = await readMonthDirect(budgetId, year, month)

  if (existingMonth) {
    return existingMonth
  }

  // Check if month exists in month_map before creating
  // If queryClient is provided, check cache first (faster)
  let monthExistsInMap = false
  if (queryClient) {
    const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (budgetData?.monthMap) {
      const monthOrdinal = getYearMonthOrdinal(year, month)
      monthExistsInMap = monthOrdinal in budgetData.monthMap
    }
  } else {
    // If not in cache, read budget to check month_map
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets',
      budgetId,
      'checking month_map before creating month'
    )
    if (exists && data?.month_map) {
      const monthOrdinal = getYearMonthOrdinal(year, month)
      const monthMap = data.month_map as Record<string, unknown>
      monthExistsInMap = monthOrdinal in monthMap
    }
  }

  // Only create if month exists in month_map
  // If month_map is empty/missing, allow creation (legacy support for budgets without month_map)
  if (monthExistsInMap) {
    // Create new month document with start balances from previous month
    return createMonth(budgetId, year, month)
  }

  // Month doesn't exist in month_map - throw error instead of creating
  throw new Error(`Month ${year}/${month} does not exist in budget. Cannot create months that are not in month_map.`)
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
  })
}
