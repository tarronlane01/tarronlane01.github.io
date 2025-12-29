/**
 * Check Invite Mutation
 *
 * Checks if a budget invite exists for the user.
 * This is a query disguised as a mutation for simplicity.
 */

import { useMutation } from '@tanstack/react-query'
import { readDocByPath } from '@firestore'
import type { BudgetInvite, FirestoreData } from '@types'

interface CheckInviteParams {
  budgetId: string
  userId: string
  userBudgetIds: string[]
}

export function useCheckInvite() {
  const checkInvite = useMutation({
    mutationFn: async ({ budgetId, userId, userBudgetIds }: CheckInviteParams): Promise<BudgetInvite | null> => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'checking if user has pending invite for this budget'
      )

      if (!exists || !data) return null

      if (!data.user_ids?.includes(userId)) return null
      if (userBudgetIds.includes(budgetId)) return null

      return {
        budgetId,
        budgetName: data.name,
        ownerEmail: data.owner_email || null,
      }
    },
  })

  return { checkInvite }
}

