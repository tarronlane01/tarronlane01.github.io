/**
 * useBudgetData Hook
 *
 * Provides budget-level data (read-only).
 * Gets selectedBudgetId and currentUserId from BudgetContext internally.
 *
 * For mutations, import mutation hooks directly:
 *   import { useUpdateAccounts, useUpdateCategories } from '@data/mutations/budget'
 *   import { useCreateBudget, useInviteUser } from '@data/mutations/user'
 *
 * Usage:
 *   const { budget, accounts, categories, isLoading } = useBudgetData()
 */

import { useCallback, useMemo } from 'react'
import {
  useBudgetQuery,
  queryClient,
  queryKeys,
  type BudgetData,
} from '@data'
import { useBudget } from '@contexts'
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

  // Cache utilities (for optimistic updates in page hooks)
  setAccountsOptimistic: (accounts: AccountsMap) => void
  setAccountGroupsOptimistic: (groups: AccountGroupsMap) => void
  setCategoriesOptimistic: (categories: CategoriesMap) => void
  setCategoryGroupsOptimistic: (groups: CategoryGroup[]) => void
  refreshBudget: () => Promise<void>

  // Computed helpers
  getOnBudgetTotal: () => number
}

export function useBudgetData(): UseBudgetDataReturn {
  // Get IDs from context
  const { selectedBudgetId: budgetId, currentUserId } = useBudget()

  // Query
  const budgetQuery = useBudgetQuery(budgetId)

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
  // CACHE UTILITIES (for optimistic updates in page hooks)
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
