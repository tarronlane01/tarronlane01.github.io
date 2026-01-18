/**
 * Payees Query Hook
 *
 * React Query hook for fetching payees.
 * Uses fetchPayees for the actual Firestore read.
 *
 * This is a lightweight, frequently-cached document used for autocomplete.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys, STALE_TIME } from '@data/queryClient'
import { fetchPayees } from './fetchPayees'
import { useBudget } from '@contexts'

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
    queryKey: budgetId ? queryKeys.payees(budgetId) : ['payees', 'none'],
    queryFn: () => fetchPayees(budgetId!),
    enabled: isEnabled,
    // React Query will automatically use cached data if it exists and is not stale
    // The cache is populated by useInitialDataLoad with updatedAt timestamps
    staleTime: STALE_TIME, // 5 minutes - matches queryClient default
  })
}

