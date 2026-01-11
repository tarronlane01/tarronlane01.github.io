/**
 * Update Account Groups Mutation
 *
 * Updates account groups in the budget document.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation.
 */

import { createOptimisticMutation } from '../../infrastructure'
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

// ============================================================================
// INTERNAL HOOK
// ============================================================================

const useUpdateAccountGroupsInternal = createOptimisticMutation<
  UpdateAccountGroupsParams,
  UpdateAccountGroupsResult,
  BudgetData
>({
  optimisticUpdate: (params) => {
    const { budgetId, accountGroups } = params

    return {
      cacheKey: queryKeys.budget(budgetId),
      transform: (cachedData) => {
        if (!cachedData) {
          return cachedData as unknown as BudgetData
        }

        return {
          ...cachedData,
          accountGroups,
        }
      },
    }
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
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useUpdateAccountGroups() {
  const { mutate, mutateAsync, isPending, isError, error, reset } = useUpdateAccountGroupsInternal()

  const updateAccountGroups = {
    mutate: (params: UpdateAccountGroupsParams) => mutate(params),
    mutateAsync: (params: UpdateAccountGroupsParams) => mutateAsync(params),
    isPending,
    isError,
    error,
    reset,
  }

  return { updateAccountGroups }
}
