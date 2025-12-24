/**
 * Budget Mutations Hook
 *
 * Main entry point for budget-level mutations. Combines:
 * - Account mutations (useAccountMutations)
 * - Category mutations (useCategoryMutations)
 * - Budget rename mutation
 *
 * All mutations use optimistic updates and update the cache with server response.
 * NO invalidateQueries calls - we trust the mutation result to avoid unnecessary reads.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/useBudgetQuery'
import { readDoc, writeDoc, type FirestoreData } from '../firestore/operations'
import { useAccountMutations } from './useAccountMutations'
import { useCategoryMutations } from './useCategoryMutations'

interface RenameBudgetParams {
  budgetId: string
  newName: string
}

/**
 * Hook providing all mutation functions for budget-level data
 *
 * Pattern for all mutations:
 * - onMutate: Optimistic update (instant UI feedback)
 * - mutationFn: Firestore write (returns server truth)
 * - onSuccess: Update cache with server response (NO refetch)
 * - onError: Rollback to previous state
 */
export function useBudgetMutations() {
  const queryClient = useQueryClient()

  // Account mutations
  const accountMutations = useAccountMutations()

  // Category mutations
  const categoryMutations = useCategoryMutations()

  /**
   * Rename budget
   */
  const renameBudget = useMutation({
    mutationFn: async ({ budgetId, newName }: RenameBudgetParams) => {
      const { exists, data } = await readDoc<FirestoreData>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDoc('budgets', budgetId, {
        ...data,
        name: newName.trim(),
      })

      return newName.trim()
    },
    onMutate: async ({ budgetId, newName }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          budget: {
            ...previousData.budget,
            name: newName.trim(),
          },
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          budget: {
            ...currentData.budget,
            name: data,
          },
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  return {
    // Account mutations
    updateAccounts: accountMutations.updateAccounts,
    updateAccountGroups: accountMutations.updateAccountGroups,
    updateAccountBalance: accountMutations.updateAccountBalance,
    // Category mutations
    updateCategories: categoryMutations.updateCategories,
    updateCategoryGroups: categoryMutations.updateCategoryGroups,
    saveCategoryBalancesSnapshot: categoryMutations.saveCategoryBalancesSnapshot,
    recalculateCategoryBalances: categoryMutations.recalculateCategoryBalances,
    // Budget mutations
    renameBudget,
  }
}
