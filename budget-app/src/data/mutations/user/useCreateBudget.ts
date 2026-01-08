/**
 * Create Budget Mutation
 *
 * Creates a new budget and adds it to the user's budget list.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { readDocByPath, writeDocByPath } from '@firestore'
import type { UserDocument } from '@types'

interface CreateBudgetParams {
  name: string
  userId: string
  userEmail: string
}

export function useCreateBudget() {
  const queryClient = useQueryClient()

  const createBudget = useMutation({
    mutationFn: async ({ name, userId, userEmail }: CreateBudgetParams) => {
      const budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date().toISOString()

      // Create budget document
      const newBudget = {
        name: name.trim() || 'My Budget',
        user_ids: [userId],
        accepted_user_ids: [userId],
        owner_id: userId,
        owner_email: userEmail,
        accounts: {},
        account_groups: {},
        categories: {},
        category_groups: [],
        // Initialize calculated fields
        total_available: 0,
        is_needs_recalculation: false,
        month_map: {},
        created_at: now,
        updated_at: now,
      }
      await writeDocByPath(
        'budgets',
        budgetId,
        newBudget,
        'creating new budget document'
      )

      // Update user document
      const { exists: userExists, data: userData } = await readDocByPath<UserDocument>(
        'users',
        userId,
        'reading user document to add new budget to their list'
      )

      if (userExists && userData) {
        await writeDocByPath(
          'users',
          userId,
          {
            ...userData,
            budget_ids: [budgetId, ...userData.budget_ids],
            updated_at: now,
          },
          'adding new budget to user\'s budget list'
        )
      } else {
        // Create new user document
        await writeDocByPath(
          'users',
          userId,
          {
            uid: userId,
            email: userEmail,
            budget_ids: [budgetId],
            created_at: now,
            updated_at: now,
          },
          'creating new user document with first budget'
        )
      }

      return { budgetId, budget: { id: budgetId, ...newBudget } }
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessibleBudgets(userId) })
    },
  })

  return { createBudget }
}

