/**
 * Delete Account Group Mutation
 *
 * Removes a single account group from the budget document using Firestore's deleteField().
 * Accounts that were in the group are moved to ungrouped in the same update.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { useBudget } from '@contexts'
import { useBudgetMutationHelpers } from '../mutationHelpers'
import { deleteBudgetAccountGroupKey } from '../writeBudgetData'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'

// ============================================================================
// TYPES
// ============================================================================

interface DeleteAccountGroupParams {
  budgetId: string
  groupId: string
  /** Account IDs that were in this group (will be set to ungrouped) */
  accountIdsToUngroup: string[]
}

interface MutationContext {
  previousData: BudgetData | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useDeleteAccountGroup() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { updateBudgetCacheAndTrack } = useBudgetMutationHelpers()

  const mutation = useMutation<void, Error, DeleteAccountGroupParams, MutationContext>({
    onMutate: async (params) => {
      const { budgetId, groupId, accountIdsToUngroup } = params
      const queryKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<BudgetData>(queryKey)
      const isCurrentDocument = currentViewingDocument.type === 'budget'

      if (previousData?.accounts && previousData?.accountGroups && groupId in previousData.accountGroups) {
        const { [groupId]: _removedGroup, ...restGroups } = previousData.accountGroups
        void _removedGroup
        const updatedAccounts = { ...previousData.accounts }
        for (const accountId of accountIdsToUngroup) {
          if (updatedAccounts[accountId]) {
            updatedAccounts[accountId] = {
              ...updatedAccounts[accountId],
              account_group_id: UNGROUPED_ACCOUNT_GROUP_ID,
            }
          }
        }
        const updatedBudget: BudgetData = {
          ...previousData,
          accounts: updatedAccounts,
          accountGroups: restGroups,
          budget: {
            ...previousData.budget,
            accounts: updatedAccounts,
            account_groups: restGroups,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKey, updatedBudget)
        if (!isCurrentDocument) {
          updateBudgetCacheAndTrack(budgetId, updatedBudget)
        }
      }

      if (isCurrentDocument) {
        try {
          await deleteBudgetAccountGroupKey(
            budgetId,
            groupId,
            accountIdsToUngroup,
            'account_groups: delete (targeted key)'
          )
        } catch (error) {
          console.warn('[useDeleteAccountGroup] Failed to delete account group key:', error)
        }
      }

      return { previousData }
    },

    mutationFn: async () => {
      return undefined
    },

    onError: (_error, params, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousData)
      }
    },
  })

  const deleteAccountGroup = {
    mutate: (params: DeleteAccountGroupParams) => mutation.mutate(params),
    mutateAsync: (params: DeleteAccountGroupParams) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }

  return { deleteAccountGroup }
}
