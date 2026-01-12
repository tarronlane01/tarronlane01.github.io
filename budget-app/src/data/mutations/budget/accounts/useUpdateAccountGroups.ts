/**
 * Update Account Groups Mutation
 *
 * Updates account groups in the budget document.
 *
 * Uses React Query's native optimistic update pattern.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { AccountGroupsMap, FirestoreData } from '@types'
import { writeBudgetData } from '../writeBudgetData'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Clean account groups for Firestore
 */
function cleanAccountGroupsForFirestore(groups: AccountGroupsMap): FirestoreData {
  const cleaned: FirestoreData = {}
  Object.entries(groups).forEach(([groupId, group]) => {
    cleaned[groupId] = {
      name: group.name,
      sort_order: group.sort_order,
    }
    if (group.expected_balance !== undefined) cleaned[groupId].expected_balance = group.expected_balance
    if (group.on_budget !== undefined) cleaned[groupId].on_budget = group.on_budget
    if (group.is_active !== undefined) cleaned[groupId].is_active = group.is_active
  })
  return cleaned
}

// ============================================================================
// TYPES
// ============================================================================

interface UpdateAccountGroupsParams {
  budgetId: string
  accountGroups: AccountGroupsMap
}

interface UpdateAccountGroupsResult {
  accountGroups: AccountGroupsMap
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useUpdateAccountGroups() {
  const queryClient = useQueryClient()

  const mutation = useMutation<UpdateAccountGroupsResult, Error, UpdateAccountGroupsParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, accountGroups } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKey, {
          ...previousData,
          accountGroups,
        })
      }

      return { previousData }
    },

    mutationFn: async (params) => {
      const { budgetId, accountGroups } = params
      const cleanedGroups = cleanAccountGroupsForFirestore(accountGroups)

      await writeBudgetData({
        budgetId,
        updates: { account_groups: cleanedGroups },
        description: 'saving updated account groups (user edited group settings)',
      })

      return { accountGroups }
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const updateAccountGroups = {
    mutate: (params: UpdateAccountGroupsParams) => mutation.mutate(params),
    mutateAsync: (params: UpdateAccountGroupsParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { updateAccountGroups }
}
