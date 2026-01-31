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
  FirestoreData,
} from '@types'
import { calculateTotalAvailable, isAccountOnBudget } from '@utils/calculations/balances/calculateTotalAvailable'

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
   * Total available amount (calculated on-the-fly from accounts and categories).
   * This is the "Ready to Assign" amount: on-budget account balances - positive category balances.
   */
  totalAvailable: number
  /**
   * Index of months in the budget (just tracks which months exist).
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
  // Create a new array reference to ensure React detects changes when groups are reordered
  const categoryGroups = useMemo(() => {
    const groups = budgetData?.categoryGroups || []
    // Return a new array reference to ensure memoization detects changes
    return groups.length > 0 ? [...groups] : []
  }, [budgetData?.categoryGroups])

  // Derived values
  const isOwner = budget?.owner_id === currentUserId
  const budgetUserIds = useMemo(() => budget?.user_ids || [], [budget?.user_ids])
  const acceptedUserIds = useMemo(() => budget?.accepted_user_ids || [], [budget?.accepted_user_ids])
  // Avail: total_available on-the-fly from stored data only (not stored in Firestore).
  // Must never factor in unfinalized draft allocations—only persisted category balances.
  const totalAvailable = useMemo(() => {
    if (!budget) return 0
    return calculateTotalAvailable(accounts as unknown as FirestoreData, categories as unknown as FirestoreData, accountGroups as unknown as FirestoreData)
  }, [budget, accounts, accountGroups, categories])
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
        budget: {
          ...cachedData.budget,
          categories: newCategories,
        },
      })
    }
  }, [budgetId])

  const setCategoryGroupsOptimistic = useCallback((newGroups: CategoryGroup[]) => {
    if (!budgetId) return
    const cachedData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
    if (cachedData) {
      // Create a new array reference to ensure React Query detects the change
      const newCategoryGroups = [...newGroups]
      queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
        ...cachedData,
        categoryGroups: newCategoryGroups,
        budget: {
          ...cachedData.budget,
          category_groups: newCategoryGroups,
        },
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

  // Same isAccountOnBudget logic as calculateTotalAvailable (Avail) and Settings > Accounts On-Budget
  const getOnBudgetTotal = useCallback((): number => {
    return Object.entries(accounts)
      .filter(([, acc]) => isAccountOnBudget(acc, accountGroups as unknown as FirestoreData))
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
