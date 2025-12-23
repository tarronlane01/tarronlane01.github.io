/**
 * Payees Query Hook
 *
 * Fetches the payees document for autocomplete functionality.
 * This is a lightweight, frequently-cached document.
 */

import { useQuery } from '@tanstack/react-query'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import app from '../../firebase'
import { queryKeys } from '../queryClient'
import type { PayeesDocument } from '../../types/budget'

/**
 * Fetch payees from Firestore
 */
async function fetchPayees(budgetId: string): Promise<string[]> {
  const db = getFirestore(app)
  const payeesDocRef = doc(db, 'payees', budgetId)

  const payeesDoc = await getDoc(payeesDocRef)

  if (payeesDoc.exists()) {
    const data = payeesDoc.data() as PayeesDocument
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

