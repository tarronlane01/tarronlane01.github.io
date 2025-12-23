/**
 * Payees Query Hook
 *
 * Fetches the payees document for autocomplete functionality.
 * This is a lightweight, frequently-cached document.
 */

import { useQuery } from '@tanstack/react-query'
import { readDoc } from '../../utils/firestoreHelpers'
import { queryKeys } from '../queryClient'
import type { PayeesDocument } from '../../types/budget'

/**
 * Fetch payees from Firestore
 */
async function fetchPayees(budgetId: string): Promise<string[]> {
  const { exists, data } = await readDoc<PayeesDocument>('payees', budgetId)

  if (exists && data) {
    return data.payees || []
  }

  return []
}

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

