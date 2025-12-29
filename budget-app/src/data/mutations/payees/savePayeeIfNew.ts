/**
 * Save Payee If New
 *
 * Adds a new payee to the budget's payees list if it doesn't already exist.
 * Used by income and expense mutations for payee autocomplete.
 */

import { writeDocByPath } from '@firestore'

/**
 * Save payee if new and return updated payees list
 *
 * @param budgetId - Budget ID
 * @param payee - Payee name to add
 * @param existingPayees - Current list of payees
 * @returns Updated payees list if payee was added, null otherwise
 */
export async function savePayeeIfNew(
  budgetId: string,
  payee: string,
  existingPayees: string[]
): Promise<string[] | null> {
  const trimmed = payee.trim()
  if (!trimmed || existingPayees.includes(trimmed)) return null

  const updatedPayees = [...existingPayees, trimmed].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  await writeDocByPath(
    'payees',
    budgetId,
    {
      budget_id: budgetId,
      payees: updatedPayees,
      updated_at: new Date().toISOString(),
    },
    `adding new payee "${trimmed}" to autocomplete list`
  )

  return updatedPayees
}

