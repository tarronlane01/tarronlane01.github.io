/**
 * Update Account Groups Mutation
 *
 * Updates account groups in the budget document.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { AccountGroupsMap, FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'

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

interface UpdateAccountGroupsParams {
  budgetId: string
  accountGroups: AccountGroupsMap
}

export function useUpdateAccountGroups() {
  const queryClient = useQueryClient()

  const updateAccountGroups = useMutation({
    mutationFn: async ({ budgetId, accountGroups }: UpdateAccountGroupsParams) => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        'PRE-EDIT-READ'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedGroups = cleanAccountGroupsForFirestore(accountGroups)

      await writeDocByPath(
        'budgets',
        budgetId,
        {
          ...data,
          account_groups: cleanedGroups,
        },
        'saving updated account groups (user edited group settings)'
      )

      return accountGroups
    },
    onMutate: async ({ budgetId, accountGroups }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accountGroups,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          accountGroups: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return { updateAccountGroups }
}

