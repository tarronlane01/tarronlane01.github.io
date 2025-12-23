/**
 * Budget Mutations Hook
 *
 * Provides mutation functions for budget-level changes:
 * - Account CRUD operations
 * - Account group CRUD operations
 * - Category CRUD operations
 * - Category group CRUD operations
 * - Budget renaming
 *
 * All mutations use optimistic updates and update the cache with server response.
 * NO invalidateQueries calls - we trust the mutation result to avoid unnecessary reads.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/useBudgetQuery'
import type {
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  CategoryGroup,
} from '../../types/budget'
import { cleanAccountsForFirestore, readDoc, writeDoc } from '../../utils/firestoreHelpers'

/**
 * Clean categories for Firestore (removes undefined values)
 */
function cleanCategoriesForFirestore(categories: CategoriesMap): Record<string, any> {
  const cleaned: Record<string, any> = {}
  Object.entries(categories).forEach(([catId, cat]) => {
    cleaned[catId] = {
      name: cat.name,
      category_group_id: cat.category_group_id ?? null,
      sort_order: cat.sort_order,
      balance: cat.balance ?? 0,
    }
    if (cat.description !== undefined) cleaned[catId].description = cat.description
    if (cat.default_monthly_amount !== undefined) cleaned[catId].default_monthly_amount = cat.default_monthly_amount
    if (cat.default_monthly_type !== undefined) cleaned[catId].default_monthly_type = cat.default_monthly_type
  })
  return cleaned
}

/**
 * Clean account groups for Firestore
 */
function cleanAccountGroupsForFirestore(groups: AccountGroupsMap): Record<string, any> {
  const cleaned: Record<string, any> = {}
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

interface UpdateAccountsParams {
  budgetId: string
  accounts: AccountsMap
}

interface UpdateAccountGroupsParams {
  budgetId: string
  accountGroups: AccountGroupsMap
}

interface UpdateCategoriesParams {
  budgetId: string
  categories: CategoriesMap
}

interface UpdateCategoryGroupsParams {
  budgetId: string
  categoryGroups: CategoryGroup[]
}

interface UpdateAccountBalanceParams {
  budgetId: string
  accountId: string
  delta: number
}

interface RenameBudgetParams {
  budgetId: string
  newName: string
}

/**
 * Hook providing mutation functions for budget-level data
 *
 * Pattern for all mutations:
 * - onMutate: Optimistic update (instant UI feedback)
 * - mutationFn: Firestore write (returns server truth)
 * - onSuccess: Update cache with server response (NO refetch)
 * - onError: Rollback to previous state
 */
export function useBudgetMutations() {
  const queryClient = useQueryClient()

  /**
   * Update accounts in budget document
   */
  const updateAccounts = useMutation({
    mutationFn: async ({ budgetId, accounts }: UpdateAccountsParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedAccounts = cleanAccountsForFirestore(accounts)

      await writeDoc('budgets', budgetId, {
        ...data,
        accounts: cleanedAccounts,
      })

      return accounts
    },
    onMutate: async ({ budgetId, accounts }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accounts,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      // Update cache with server response - NO refetch needed
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          accounts: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  /**
   * Update account groups in budget document
   */
  const updateAccountGroups = useMutation({
    mutationFn: async ({ budgetId, accountGroups }: UpdateAccountGroupsParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedGroups = cleanAccountGroupsForFirestore(accountGroups)

      await writeDoc('budgets', budgetId, {
        ...data,
        account_groups: cleanedGroups,
      })

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

  /**
   * Update categories in budget document
   */
  const updateCategories = useMutation({
    mutationFn: async ({ budgetId, categories }: UpdateCategoriesParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedCategories = cleanCategoriesForFirestore(categories)

      await writeDoc('budgets', budgetId, {
        ...data,
        categories: cleanedCategories,
      })

      return categories
    },
    onMutate: async ({ budgetId, categories }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categories,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categories: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  /**
   * Update category groups in budget document
   */
  const updateCategoryGroups = useMutation({
    mutationFn: async ({ budgetId, categoryGroups }: UpdateCategoryGroupsParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDoc('budgets', budgetId, {
        ...data,
        category_groups: categoryGroups,
      })

      return categoryGroups
    },
    onMutate: async ({ budgetId, categoryGroups }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categoryGroups,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categoryGroups: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  /**
   * Update a single account's balance (used after income/expense changes)
   */
  const updateAccountBalance = useMutation({
    mutationFn: async ({ budgetId, accountId, delta }: UpdateAccountBalanceParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const accounts = data.accounts || {}

      if (!accounts[accountId]) {
        throw new Error('Account not found')
      }

      const updatedAccounts = {
        ...accounts,
        [accountId]: {
          ...accounts[accountId],
          balance: accounts[accountId].balance + delta,
        },
      }

      await writeDoc('budgets', budgetId, {
        ...data,
        accounts: cleanAccountsForFirestore(updatedAccounts),
      })

      return updatedAccounts
    },
    onMutate: async ({ budgetId, accountId, delta }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      if (previousData && previousData.accounts[accountId]) {
        const updatedAccounts = {
          ...previousData.accounts,
          [accountId]: {
            ...previousData.accounts[accountId],
            balance: previousData.accounts[accountId].balance + delta,
          },
        }
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          accounts: updatedAccounts,
        })
      }

      return { previousData }
    },
    onSuccess: (data, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          accounts: data,
        })
      }
    },
    onError: (_err, { budgetId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.budget(budgetId), context.previousData)
      }
    },
  })

  /**
   * Rename budget
   */
  const renameBudget = useMutation({
    mutationFn: async ({ budgetId, newName }: RenameBudgetParams) => {
      const { exists, data } = await readDoc<Record<string, any>>('budgets', budgetId)

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
    updateAccounts,
    updateAccountGroups,
    updateCategories,
    updateCategoryGroups,
    updateAccountBalance,
    renameBudget,
  }
}
