/**
 * Budget Query Hook
 *
 * React Query hook for fetching budget-level documents.
 * Uses fetchBudget for the actual Firestore read.
 *
 * The budget document contains global/cross-month data:
 * - Account definitions and groups (with balances)
 * - Category definitions and groups (with balances)
 * - Display ordering
 * - Ownership/access metadata
 *
 * This document is read once per session and cached aggressively.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import { fetchBudget, type BudgetData } from './fetchBudget'
import { useBudget } from '@contexts'

export type { BudgetData }

/**
 * Query hook for budget-level document
 *
 * Returns the complete budget data including accounts, categories, etc.
 * React Query will automatically use cached data if it exists and is not stale.
 * The cache is populated by useInitialDataLoad before this query runs.
 *
 * @param budgetId - The budget ID to fetch
 * @param options - Additional query options
 */
export function useBudgetQuery(
  budgetId: string | null,
  options?: { enabled?: boolean }
) {
  const { initialDataLoadComplete } = useBudget()

  // Enable query only if:
  // 1. Budget ID is provided
  // 2. Options don't explicitly disable it
  // 3. Initial data load is complete (cache is populated)
  const isEnabled = !!budgetId &&
    (options?.enabled !== false) &&
    initialDataLoadComplete

  return useQuery({
    queryKey: budgetId ? queryKeys.budget(budgetId) : ['budget', 'none'],
    queryFn: () => fetchBudget(budgetId!),
    enabled: isEnabled,
    // React Query will automatically use cached data if it exists and is not stale
    // The cache is populated by useInitialDataLoad with updatedAt timestamps
    staleTime: STALE_TIME, // 5 minutes - matches queryClient default
  })
}

