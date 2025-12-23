/**
 * useBudgetData Hook
 *
 * Provides budget-level data and mutations.
 * Components import this hook directly instead of going through context.
 *
 * Usage:
 *   const { selectedBudgetId } = useBudget() // from context
 *   const {
 *     budget, accounts, categories, isLoading,
 *     saveAccounts, saveCategories, ...
 *   } = useBudgetData(selectedBudgetId, currentUserId)
 */

import { useCallback } from 'react'
import {
  useBudgetQuery,
  useBudgetMutations,
  useUserMutations,
  queryClient,
  queryKeys,
  type BudgetData,
} from '../data'
import type {
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  CategoryGroup,
  Budget,
} from '../types/budget'

interface UseBudgetDataReturn {
  // Query state
  isLoading: boolean
  isFetching: boolean
  error: Error | null

  // Budget document data
  budget: Budget | null
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]

  // Derived values
  isOwner: boolean
  budgetUserIds: string[]
  acceptedUserIds: string[]

  // Budget mutations
  saveAccounts: (accounts: AccountsMap) => Promise<void>
  saveAccountGroups: (groups: AccountGroupsMap) => Promise<void>
  saveCategories: (categories: CategoriesMap) => Promise<void>
  saveCategoryGroups: (groups: CategoryGroup[]) => Promise<void>
  saveAccountsAndGroups: (accounts: AccountsMap, groups: AccountGroupsMap) => Promise<void>
  saveCategoriesAndGroups: (categories: CategoriesMap, groups: CategoryGroup[]) => Promise<void>
  renameBudget: (newName: string) => Promise<void>

  // User/invite mutations
  createBudget: (name: string) => Promise<{ budgetId: string }>
  inviteUser: (userId: string) => Promise<void>
  revokeUser: (userId: string) => Promise<void>
  acceptInvite: (budgetId: string) => Promise<void>

  // Cache utilities
  setAccountsOptimistic: (accounts: AccountsMap) => void
  setAccountGroupsOptimistic: (groups: AccountGroupsMap) => void
  setCategoriesOptimistic: (categories: CategoriesMap) => void
  setCategoryGroupsOptimistic: (groups: CategoryGroup[]) => void
  refreshBudget: () => Promise<void>

  // Computed helpers
  getOnBudgetTotal: () => number
}

export function useBudgetData(
  budgetId: string | null,
  currentUserId: string | null
): UseBudgetDataReturn {
  // Query
  const budgetQuery = useBudgetQuery(budgetId)

  // Mutations
  const budgetMutations = useBudgetMutations()
  const userMutations = useUserMutations()

  // Extract data from query
  const budgetData = budgetQuery.data
  const budget = budgetData?.budget || null
  const accounts = budgetData?.accounts || {}
  const accountGroups = budgetData?.accountGroups || {}
  const categories = budgetData?.categories || {}
  const categoryGroups = budgetData?.categoryGroups || []

  // Derived values
  const isOwner = budget?.owner_id === currentUserId
  const budgetUserIds = budget?.user_ids || []
  const acceptedUserIds = budget?.accepted_user_ids || []

  // ==========================================================================
  // BUDGET MUTATIONS
  // ==========================================================================

  const saveAccounts = useCallback(async (newAccounts: AccountsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await budgetMutations.updateAccounts.mutateAsync({
      budgetId,
      accounts: newAccounts,
    })
  }, [budgetId, budgetMutations.updateAccounts])

  const saveAccountGroups = useCallback(async (newGroups: AccountGroupsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await budgetMutations.updateAccountGroups.mutateAsync({
      budgetId,
      accountGroups: newGroups,
    })
  }, [budgetId, budgetMutations.updateAccountGroups])

  const saveCategories = useCallback(async (newCategories: CategoriesMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await budgetMutations.updateCategories.mutateAsync({
      budgetId,
      categories: newCategories,
    })
  }, [budgetId, budgetMutations.updateCategories])

  const saveCategoryGroups = useCallback(async (newGroups: CategoryGroup[]) => {
    if (!budgetId) throw new Error('No budget selected')
    await budgetMutations.updateCategoryGroups.mutateAsync({
      budgetId,
      categoryGroups: newGroups,
    })
  }, [budgetId, budgetMutations.updateCategoryGroups])

  const saveAccountsAndGroups = useCallback(async (newAccounts: AccountsMap, newGroups: AccountGroupsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await Promise.all([
      budgetMutations.updateAccounts.mutateAsync({ budgetId, accounts: newAccounts }),
      budgetMutations.updateAccountGroups.mutateAsync({ budgetId, accountGroups: newGroups }),
    ])
  }, [budgetId, budgetMutations])

  const saveCategoriesAndGroups = useCallback(async (newCategories: CategoriesMap, newGroups: CategoryGroup[]) => {
    if (!budgetId) throw new Error('No budget selected')
    await Promise.all([
      budgetMutations.updateCategories.mutateAsync({ budgetId, categories: newCategories }),
      budgetMutations.updateCategoryGroups.mutateAsync({ budgetId, categoryGroups: newGroups }),
    ])
  }, [budgetId, budgetMutations])

  const renameBudget = useCallback(async (newName: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await budgetMutations.renameBudget.mutateAsync({ budgetId, newName })
  }, [budgetId, budgetMutations.renameBudget])

  // ==========================================================================
  // USER/INVITE MUTATIONS
  // ==========================================================================

  const createBudget = useCallback(async (name: string) => {
    if (!currentUserId) throw new Error('Not authenticated')
    const result = await userMutations.createBudget.mutateAsync({
      name: name.trim() || 'My Budget',
      userId: currentUserId,
      userEmail: null, // Will be filled by mutation if available
    })
    return result
  }, [currentUserId, userMutations.createBudget])

  const inviteUser = useCallback(async (userId: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await userMutations.inviteUser.mutateAsync({ budgetId, userId })
  }, [budgetId, userMutations.inviteUser])

  const revokeUser = useCallback(async (userId: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await userMutations.revokeUser.mutateAsync({ budgetId, userId })
  }, [budgetId, userMutations.revokeUser])

  const acceptInvite = useCallback(async (targetBudgetId: string) => {
    if (!currentUserId) throw new Error('Not authenticated')
    await userMutations.acceptInvite.mutateAsync({
      budgetId: targetBudgetId,
      userId: currentUserId,
    })
  }, [currentUserId, userMutations.acceptInvite])

  // ==========================================================================
  // CACHE UTILITIES (for optimistic updates)
  // ==========================================================================

  const setAccountsOptimistic = useCallback((newAccounts: AccountsMap) => {
    if (!budgetId) return
    const cachedData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (cachedData) {
      queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
        ...cachedData,
        accounts: newAccounts,
      })
    }
  }, [budgetId])

  const setAccountGroupsOptimistic = useCallback((newGroups: AccountGroupsMap) => {
    if (!budgetId) return
    const cachedData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (cachedData) {
      queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
        ...cachedData,
        accountGroups: newGroups,
      })
    }
  }, [budgetId])

  const setCategoriesOptimistic = useCallback((newCategories: CategoriesMap) => {
    if (!budgetId) return
    const cachedData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (cachedData) {
      queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
        ...cachedData,
        categories: newCategories,
      })
    }
  }, [budgetId])

  const setCategoryGroupsOptimistic = useCallback((newGroups: CategoryGroup[]) => {
    if (!budgetId) return
    const cachedData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (cachedData) {
      queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
        ...cachedData,
        categoryGroups: newGroups,
      })
    }
  }, [budgetId])

  const refreshBudget = useCallback(async () => {
    if (!budgetId) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) })
  }, [budgetId])

  // ==========================================================================
  // COMPUTED HELPERS
  // ==========================================================================

  const getOnBudgetTotal = useCallback((): number => {
    return Object.entries(accounts)
      .filter(([, acc]) => {
        const group = acc.account_group_id ? accountGroups[acc.account_group_id] : undefined
        const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (acc.on_budget !== false)
        const effectiveActive = group?.is_active !== undefined ? group.is_active : (acc.is_active !== false)
        return effectiveOnBudget && effectiveActive
      })
      .reduce((sum, [, acc]) => sum + acc.balance, 0)
  }, [accounts, accountGroups])

  return {
    // Query state
    isLoading: budgetQuery.isLoading,
    isFetching: budgetQuery.isFetching,
    error: budgetQuery.error,

    // Data
    budget,
    accounts,
    accountGroups,
    categories,
    categoryGroups,

    // Derived
    isOwner,
    budgetUserIds,
    acceptedUserIds,

    // Mutations
    saveAccounts,
    saveAccountGroups,
    saveCategories,
    saveCategoryGroups,
    saveAccountsAndGroups,
    saveCategoriesAndGroups,
    renameBudget,
    createBudget,
    inviteUser,
    revokeUser,
    acceptInvite,

    // Cache utilities
    setAccountsOptimistic,
    setAccountGroupsOptimistic,
    setCategoriesOptimistic,
    setCategoryGroupsOptimistic,
    refreshBudget,

    // Computed
    getOnBudgetTotal,
  }
}

