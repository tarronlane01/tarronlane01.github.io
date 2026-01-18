/**
 * Create Budget Mutation
 *
 * Creates a new budget and adds it to the user's budget list.
 *
 * PATTERN: Uses merge writes with arrayUnion for array operations.
 * No pre-read needed for user document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import { writeDocByPath, arrayUnion } from '@firestore'
import { UNGROUPED_ACCOUNT_GROUP_ID, UNGROUPED_CATEGORY_GROUP_ID } from '@constants'

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

      // Create budget document (new doc, no merge needed)
      // Always create default ungrouped groups that cannot be deleted
      const newBudget = {
        name: name.trim() || 'My Budget',
        user_ids: [userId],
        accepted_user_ids: [userId],
        owner_id: userId,
        owner_email: userEmail,
        accounts: {},
        account_groups: {
          [UNGROUPED_ACCOUNT_GROUP_ID]: {
            name: 'Ungrouped',
            sort_order: 0,
            expected_balance: 'positive',
            on_budget: null,
            is_active: null,
          },
        },
        categories: {},
        category_groups: [
          {
            id: UNGROUPED_CATEGORY_GROUP_ID,
            name: 'Uncategorized',
            sort_order: 0,
          },
        ],
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

      // Update user document using merge + arrayUnion (no pre-read needed)
      // This handles both existing users and creates new user docs
      await writeDocByPath(
        'users',
        userId,
        {
          uid: userId,
          email: userEmail,
          budget_ids: arrayUnion(budgetId),
          updated_at: now,
        },
        'adding new budget to user\'s budget list',
        { merge: true }
      )

      return { budgetId, budget: { id: budgetId, ...newBudget } }
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.accessibleBudgets(userId) })
    },
  })

  return { createBudget }
}

