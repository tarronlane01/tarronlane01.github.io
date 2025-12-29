/**
 * Fetch Payees
 *
 * Core function for fetching payees from Firestore.
 * Used for autocomplete functionality.
 */

import { readDocByPath } from '@firestore'
import type { PayeesDocument } from '@types'

/**
 * Fetch payees from Firestore.
 *
 * @param budgetId - The budget ID
 * @returns Array of payee names
 */
export async function fetchPayees(budgetId: string): Promise<string[]> {
  const { exists, data } = await readDocByPath<PayeesDocument>(
    'payees',
    budgetId,
    'loading payees for autocomplete (cache miss or stale)'
  )

  if (exists && data) {
    return data.payees || []
  }

  return []
}

