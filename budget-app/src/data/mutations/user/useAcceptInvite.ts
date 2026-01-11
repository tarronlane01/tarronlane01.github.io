/**
 * Accept Invite Mutation
 *
 * Accepts a budget invitation for the current user.
 *
 * PATTERN: Uses merge writes with arrayUnion for array operations.
 * Only the validation read is performed; writes use merge strategy.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { readDocByPath, writeDocByPath, arrayUnion } from '@firestore'
import type { FirestoreData } from '@types'

interface AcceptInviteParams {
  budgetId: string
  userId: string
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()

  const acceptInvite = useMutation({
    mutationFn: async ({ budgetId, userId }: AcceptInviteParams) => {
      const now = new Date().toISOString()

      // Validation read: Verify invitation exists (required for security)
      const { exists: budgetExists, data: budgetData } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'validating user was invited to this budget'
      )

      if (!budgetExists || !budgetData) {
        throw new Error('Budget not found')
      }

      if (!budgetData.user_ids?.includes(userId)) {
        throw new Error('You have not been invited to this budget')
      }

      if (budgetData.accepted_user_ids?.includes(userId)) {
        throw new Error('You have already accepted this invite')
      }

      // Update user document using merge + arrayUnion (no pre-read needed)
      await writeDocByPath(
        'users',
        userId,
        {
          uid: userId, // Ensures doc exists if first budget
          budget_ids: arrayUnion(budgetId),
          updated_at: now,
        },
        'adding accepted budget to user\'s budget list',
        { merge: true }
      )

      // Update budget's accepted_user_ids using merge + arrayUnion (no pre-read needed)
      await writeDocByPath(
        'budgets',
        budgetId,
        {
          accepted_user_ids: arrayUnion(userId),
          updated_at: now,
        },
        'marking user as accepted in budget\'s accepted_user_ids',
        { merge: true }
      )

      return { budgetId }
    },
    onSuccess: (data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessibleBudgets(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.budget(data.budgetId) })
    },
  })

  return { acceptInvite }
}

