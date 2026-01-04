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

import { useCallback, useMemo } from 'react'
import {
  useBudgetQuery,
  queryClient,
  queryKeys,
  type BudgetData,
} from '@data'
import {
  useUpdateAccounts,
  useUpdateAccountGroups,
  useUpdateCategories,
  useUpdateCategoryGroups,
  useRenameBudget,
} from '../data/mutations/budget'
import {
  useCreateBudget,
  useAcceptInvite,
  useInviteUser,
  useRevokeUser,
} from '../data/mutations/user'
import type {
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  CategoryGroup,
  CategoryGroupWithId,
  Budget,
  MonthMap,
} from '@types'

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
  categoryGroups: CategoryGroupWithId[]

  // Derived values
  isOwner: boolean
  budgetUserIds: string[]
  acceptedUserIds: string[]
  /**
   * Pre-calculated total available from the budget document.
   * This value is calculated during recalculation and persists across month views.
   * Use this value when the budget doesn't need recalculation.
   */
  totalAvailable: number
  /**
   * Index of recent months with their recalculation status.
   * Key is YYYYMM ordinal format.
   */
  monthMap: MonthMap

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

  // Budget mutations
  const { updateAccounts } = useUpdateAccounts()
  const { updateAccountGroups } = useUpdateAccountGroups()
  const { updateCategories } = useUpdateCategories()
  const { updateCategoryGroups } = useUpdateCategoryGroups()
  const { renameBudget: renameBudgetOp } = useRenameBudget()

  // User mutations
  const { createBudget: createBudgetOp } = useCreateBudget()
  const { acceptInvite: acceptInviteOp } = useAcceptInvite()
  const { inviteUser: inviteUserOp } = useInviteUser()
  const { revokeUser: revokeUserOp } = useRevokeUser()

  // Extract data from query with stable references
  const budgetData = budgetQuery.data
  const budget = budgetData?.budget || null
  const accounts = useMemo(() => budgetData?.accounts || {}, [budgetData?.accounts])
  const accountGroups = useMemo(() => budgetData?.accountGroups || {}, [budgetData?.accountGroups])
  const categories = useMemo(() => budgetData?.categories || {}, [budgetData?.categories])
  const categoryGroups = useMemo(() => budgetData?.categoryGroups || [], [budgetData?.categoryGroups])

  // Derived values
  const isOwner = budget?.owner_id === currentUserId
  const budgetUserIds = useMemo(() => budget?.user_ids || [], [budget?.user_ids])
  const acceptedUserIds = useMemo(() => budget?.accepted_user_ids || [], [budget?.accepted_user_ids])
  const totalAvailable = budget?.total_available ?? 0
  const monthMap = useMemo(() => budgetData?.monthMap || {}, [budgetData?.monthMap])

  // ==========================================================================
  // BUDGET MUTATIONS
  // ==========================================================================

  const saveAccounts = useCallback(async (newAccounts: AccountsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await updateAccounts.mutateAsync({
      budgetId,
      accounts: newAccounts,
    })
  }, [budgetId, updateAccounts])

  const saveAccountGroups = useCallback(async (newGroups: AccountGroupsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await updateAccountGroups.mutateAsync({
      budgetId,
      accountGroups: newGroups,
    })
  }, [budgetId, updateAccountGroups])

  const saveCategories = useCallback(async (newCategories: CategoriesMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await updateCategories.mutateAsync({
      budgetId,
      categories: newCategories,
    })
  }, [budgetId, updateCategories])

  const saveCategoryGroups = useCallback(async (newGroups: CategoryGroup[]) => {
    if (!budgetId) throw new Error('No budget selected')
    await updateCategoryGroups.mutateAsync({
      budgetId,
      categoryGroups: newGroups,
    })
  }, [budgetId, updateCategoryGroups])

  const saveAccountsAndGroups = useCallback(async (newAccounts: AccountsMap, newGroups: AccountGroupsMap) => {
    if (!budgetId) throw new Error('No budget selected')
    await Promise.all([
      updateAccounts.mutateAsync({ budgetId, accounts: newAccounts }),
      updateAccountGroups.mutateAsync({ budgetId, accountGroups: newGroups }),
    ])
  }, [budgetId, updateAccounts, updateAccountGroups])

  const saveCategoriesAndGroups = useCallback(async (newCategories: CategoriesMap, newGroups: CategoryGroup[]) => {
    if (!budgetId) throw new Error('No budget selected')
    await Promise.all([
      updateCategories.mutateAsync({ budgetId, categories: newCategories }),
      updateCategoryGroups.mutateAsync({ budgetId, categoryGroups: newGroups }),
    ])
  }, [budgetId, updateCategories, updateCategoryGroups])

  const renameBudget = useCallback(async (newName: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await renameBudgetOp.mutateAsync({ budgetId, newName })
  }, [budgetId, renameBudgetOp])

  // ==========================================================================
  // USER/INVITE MUTATIONS
  // ==========================================================================

  const createBudget = useCallback(async (name: string) => {
    if (!currentUserId) throw new Error('Not authenticated')
    const result = await createBudgetOp.mutateAsync({
      name: name.trim() || 'My Budget',
      userId: currentUserId,
      userEmail: null, // Will be filled by mutation if available
    })
    return result
  }, [currentUserId, createBudgetOp])

  const inviteUser = useCallback(async (userId: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await inviteUserOp.mutateAsync({ budgetId, userId })
  }, [budgetId, inviteUserOp])

  const revokeUser = useCallback(async (userId: string) => {
    if (!budgetId) throw new Error('No budget selected')
    await revokeUserOp.mutateAsync({ budgetId, userId })
  }, [budgetId, revokeUserOp])

  const acceptInvite = useCallback(async (targetBudgetId: string) => {
    if (!currentUserId) throw new Error('Not authenticated')
    await acceptInviteOp.mutateAsync({
      budgetId: targetBudgetId,
      userId: currentUserId,
    })
  }, [currentUserId, acceptInviteOp])

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
    totalAvailable,
    monthMap,

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
