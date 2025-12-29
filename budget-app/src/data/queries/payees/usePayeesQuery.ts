/**
 * Payees Query Hook
 *
 * React Query hook for fetching payees.
 * Uses fetchPayees for the actual Firestore read.
 *
 * This is a lightweight, frequently-cached document used for autocomplete.
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { fetchPayees } from './fetchPayees'

/**
 * Query hook for payees document
 *
 * @param budgetId - The budget ID
 * @param options - Additional query options
 */
export function usePayeesQuery(
  budgetId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? queryKeys.payees(budgetId) : ['payees', 'none'],
    queryFn: () => fetchPayees(budgetId!),
    enabled: !!budgetId && (options?.enabled !== false),
  })
}

