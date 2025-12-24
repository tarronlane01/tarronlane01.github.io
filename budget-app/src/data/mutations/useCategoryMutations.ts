/**
 * Category Mutations Hook
 *
 * Provides mutation functions for category-level changes:
 * - Update categories
 * - Update category groups
 * - Save category balances snapshot
 * - Recalculate category balances
 *
 * All mutations use optimistic updates and update the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/useBudgetQuery'
import type {
  CategoriesMap,
  CategoryGroup,
  CategoryBalancesSnapshot,
} from '../../types/budget'
import type { CategoryBalance } from '../../hooks/useCategoryBalances'
import { readDoc, writeDoc, type FirestoreData } from '../firestore/operations'

/**
 * Clean categories for Firestore (removes undefined values)
 */
function cleanCategoriesForFirestore(categories: CategoriesMap): FirestoreData {
  const cleaned: FirestoreData = {}
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

interface UpdateCategoriesParams {
  budgetId: string
  categories: CategoriesMap
}

interface UpdateCategoryGroupsParams {
  budgetId: string
  categoryGroups: CategoryGroup[]
}

interface SaveCategoryBalancesSnapshotParams {
  budgetId: string
  balances: Record<string, CategoryBalance>
  year: number
  month: number
}

interface RecalculateCategoryBalancesParams {
  budgetId: string
  categories: CategoriesMap
  balances: Record<string, CategoryBalance>
  year: number
  month: number
}

/**
 * Hook providing mutation functions for category-level data
 */
export function useCategoryMutations() {
  const queryClient = useQueryClient()

  /**
   * Update categories in budget document
   */
  const updateCategories = useMutation({
    mutationFn: async ({ budgetId, categories }: UpdateCategoriesParams) => {
      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'reading budget before updating categories (need current state)'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      const cleanedCategories = cleanCategoriesForFirestore(categories)

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          categories: cleanedCategories,
        },
        'saving updated categories (user edited category settings)'
      )

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
      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'reading budget before updating category groups (need current state)'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          category_groups: categoryGroups,
        },
        'saving updated category groups (user edited group settings)'
      )

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
   * Save category balances snapshot to budget document
   * Used when recalculating category balances from month data
   */
  const saveCategoryBalancesSnapshot = useMutation({
    mutationFn: async ({ budgetId, balances, year, month }: SaveCategoryBalancesSnapshotParams) => {
      const newSnapshot: CategoryBalancesSnapshot = {
        computed_at: new Date().toISOString(),
        computed_for_year: year,
        computed_for_month: month,
        is_stale: false,
        balances: balances,
      }

      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'reading budget before saving category balances snapshot'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          category_balances_snapshot: newSnapshot,
        },
        'saving category balances snapshot (caching computed balances)'
      )

      return newSnapshot
    },
    onMutate: async ({ budgetId, balances, year, month }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      const newSnapshot: CategoryBalancesSnapshot = {
        computed_at: new Date().toISOString(),
        computed_for_year: year,
        computed_for_month: month,
        is_stale: false,
        balances: balances,
      }

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categoryBalancesSnapshot: newSnapshot,
        })
      }

      return { previousData }
    },
    onSuccess: (snapshot, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categoryBalancesSnapshot: snapshot,
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
   * Recalculate and save category balances + snapshot
   * Updates both categories (with new balance values) and the snapshot in one write
   */
  const recalculateCategoryBalances = useMutation({
    mutationFn: async ({ budgetId, categories, balances, year, month }: RecalculateCategoryBalancesParams) => {
      const newSnapshot: CategoryBalancesSnapshot = {
        computed_at: new Date().toISOString(),
        computed_for_year: year,
        computed_for_month: month,
        is_stale: false,
        balances: balances,
      }

      const { exists, data } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'reading budget before recalculating category balances'
      )

      if (!exists || !data) {
        throw new Error('Budget not found')
      }

      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          categories: cleanCategoriesForFirestore(categories),
          category_balances_snapshot: newSnapshot,
        },
        'saving recalculated category balances and snapshot (user triggered recalculation)'
      )

      return { categories, snapshot: newSnapshot }
    },
    onMutate: async ({ budgetId, categories, balances, year, month }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budget(budgetId) })
      const previousData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))

      const newSnapshot: CategoryBalancesSnapshot = {
        computed_at: new Date().toISOString(),
        computed_for_year: year,
        computed_for_month: month,
        is_stale: false,
        balances: balances,
      }

      if (previousData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...previousData,
          categories: categories,
          categoryBalancesSnapshot: newSnapshot,
        })
      }

      return { previousData }
    },
    onSuccess: ({ categories, snapshot }, { budgetId }) => {
      const currentData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
      if (currentData) {
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...currentData,
          categories: categories,
          categoryBalancesSnapshot: snapshot,
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
    updateCategories,
    updateCategoryGroups,
    saveCategoryBalancesSnapshot,
    recalculateCategoryBalances,
  }
}

