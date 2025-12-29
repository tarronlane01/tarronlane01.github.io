/**
 * Accept Invite Mutation
 *
 * Accepts a budget invitation for the current user.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { readDocByPath, writeDocByPath } from '@firestore'
import type { UserDocument, FirestoreData } from '@types'

interface AcceptInviteParams {
  budgetId: string
  userId: string
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()

  const acceptInvite = useMutation({
    mutationFn: async ({ budgetId, userId }: AcceptInviteParams) => {
      const now = new Date().toISOString()

      // Verify invitation exists
      const { exists: budgetExists, data: budgetData } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'verifying user was invited to this budget'
      )

      if (!budgetExists || !budgetData) {
        throw new Error('Budget not found')
      }

      if (!budgetData.user_ids?.includes(userId)) {
        throw new Error('You have not been invited to this budget')
      }

      // Update user document
      const { data: userData } = await readDocByPath<UserDocument>(
        'users',
        userId,
        'PRE-EDIT-READ'
      )

      if (userData?.budget_ids?.includes(budgetId)) {
        throw new Error('You have already accepted this invite')
      }

      await writeDocByPath(
        'users',
        userId,
        {
          ...(userData || { uid: userId, email: null }),
          budget_ids: [budgetId, ...(userData?.budget_ids || [])],
          updated_at: now,
        },
        'adding accepted budget to user\'s budget list'
      )

      // Update budget's accepted_user_ids
      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...budgetData,
          accepted_user_ids: [...(budgetData.accepted_user_ids || []), userId],
        },
        'marking user as accepted in budget\'s accepted_user_ids'
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

