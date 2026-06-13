/**
 * Payees Query Hook
 *
 * React Query hook for fetching payees.
 * Uses fetchPayees for the actual Firestore read.
 *
 * This is a lightweight, frequently-cached document used for autocomplete.
 */

import { useQuery } from '@tanstack/react-query'
import { STALE_TIME } from '@data/queryClient'
import { queryKeys } from '@budget/data/queryKeys'
import { fetchPayees } from './fetchPayees'
import { useBudget } from '@budget/contexts'

export interface UsePayeesQueryOptions {
  enabled?: boolean
  /**
   * When true (default), the returned `data` is guaranteed to be a `string[]`
   * (empty array when loading or when cache has an unexpected shape).
   * Set to false to get the raw cached/query result.
   */
  ensureArray?: boolean
}

/**
 * Query hook for payees document
 *
 * React Query will automatically use cached data if it exists and is not stale.
 * The cache is populated by useInitialDataLoad before this query runs.
 *
 * @param budgetId - The budget ID
 * @param options - Additional query options
 */
export function usePayeesQuery(
  budgetId: string | null,
  options?: UsePayeesQueryOptions
) {
  const { initialDataLoadComplete } = useBudget()
  const { enabled, ensureArray = true } = options ?? {}

  // Enable query only if:
  // 1. Budget ID is provided
  // 2. Options don't explicitly disable it
  // 3. Initial data load is complete (cache is populated)
  const isEnabled = !!budgetId &&
    (enabled !== false) &&
    initialDataLoadComplete

  return useQuery({
    queryKey: budgetId ? queryKeys.payees(budgetId) : ['payees', 'none'],
    queryFn: () => fetchPayees(budgetId!),
    enabled: isEnabled,
    // React Query will automatically use cached data if it exists and is not stale
    // The cache is populated by useInitialDataLoad with updatedAt timestamps
    staleTime: STALE_TIME, // 5 minutes - matches queryClient default
    ...(ensureArray && {
      select: (data: unknown): string[] =>
        Array.isArray(data) ? data : [],
    }),
  })
}

