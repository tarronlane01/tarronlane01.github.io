/**
 * Allocation Mutations Hook
 *
 * Provides mutation functions for allocations:
 * - Save allocations (draft)
 * - Finalize allocations (applies to category balances)
 * - Unfinalize allocations
 *
 * All mutations use optimistic updates and update the cache with server response.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readDoc, getMonthDocId } from '../firestore/operations'
import { queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/useMonthQuery'
import { markNextMonthSnapshotStaleInCache } from '../queries/useMonthQuery'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { MonthDocument, CategoriesMap } from '../../types/budget'
import type { SaveAllocationsParams, FinalizeAllocationsParams, UnfinalizeAllocationsParams, DeleteAllocationsParams } from './monthMutationTypes'
import {
  saveMonthToFirestore,
  calculateCategoryBalancesForMonth,
  // Cache-only helpers (for onMutate)
  markMonthCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInCache,
  // Firestore-only helpers (for mutationFn)
  markCategoryBalancesSnapshotStaleInFirestore,
  markFutureMonthsCategoryBalancesStaleInFirestore,
} from './monthMutationHelpers'

export function useAllocationMutations() {
  const queryClient = useQueryClient()

  /**
   * Save allocations (draft)
   */
  const saveAllocations = useMutation({
    mutationFn: async (params: SaveAllocationsParams) => {
      const { budgetId, year, month, allocations } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'PRE-EDIT-READ'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations,
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      return { updatedMonth }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, allocations } = params
      const monthKey = queryKeys.month(budgetId, year, month)

      await queryClient.cancelQueries({ queryKey: monthKey })
      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)

      if (previousMonth) {
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            allocations,
          },
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)

      return { previousMonth }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
    },
    onError: (_err, params, context) => {
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(params.budgetId, params.year, params.month), context.previousMonth)
      }
    },
  })

  /**
   * Finalize allocations (affects category balances)
   */
  const finalizeAllocations = useMutation({
    mutationFn: async (params: FinalizeAllocationsParams) => {
      const { budgetId, year, month, allocations } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'PRE-EDIT-READ'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      // Get category IDs from existing month data for local calculation
      const categoryIds = monthData.category_balances?.map(cb => cb.category_id)
        ?? Object.keys(monthData.previous_month_snapshot?.category_balances_end ?? {})

      // Calculate fresh category balances for this month
      const categoryBalances = categoryIds.length > 0
        ? calculateCategoryBalancesForMonth(monthData, categoryIds, allocations, true)
        : monthData.category_balances

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations,
        allocations_finalized: true,
        category_balances: categoryBalances,
        category_balances_stale: false, // Fresh values, not stale
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Mark budget snapshot as stale (don't recalculate - lazy evaluation)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)

      // Mark future months as stale
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth }
    },
    onMutate: async (params) => {
      const { budgetId, year, month, allocations } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })
      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            allocations,
            allocations_finalized: true,
          },
        })
      }

      // Optimistically update category balances
      // Calculate the delta from old allocations (if month was already finalized) to new allocations
      if (previousBudget) {
        const oldAllocations = previousMonth?.month?.allocations_finalized
          ? previousMonth.month.allocations || []
          : []

        // Calculate delta for each category
        const deltas: Record<string, number> = {}
        for (const alloc of allocations) {
          deltas[alloc.category_id] = (deltas[alloc.category_id] || 0) + alloc.amount
        }
        for (const oldAlloc of oldAllocations) {
          deltas[oldAlloc.category_id] = (deltas[oldAlloc.category_id] || 0) - oldAlloc.amount
        }

        // Apply deltas to categories
        const updatedCategories: CategoriesMap = {}
        Object.entries(previousBudget.categories).forEach(([catId, cat]) => {
          updatedCategories[catId] = {
            ...cat,
            balance: cat.balance + (deltas[catId] || 0),
          }
        })

        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          categories: updatedCategories,
          categoryBalancesSnapshot: previousBudget.categoryBalancesSnapshot
            ? { ...previousBudget.categoryBalancesSnapshot, is_stale: true }
            : null,
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: this month + future months (budget snapshot already handled above)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)

      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })
      // Note: Budget categories are updated optimistically in onMutate.
      // Since snapshot is marked stale, accurate balances will be recalculated on demand.
    },
    onError: (_err, params, context) => {
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(params.budgetId, params.year, params.month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousBudget)
      }
    },
  })

  /**
   * Unfinalize allocations
   */
  const unfinalizeAllocations = useMutation({
    mutationFn: async (params: UnfinalizeAllocationsParams) => {
      const { budgetId, year, month } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'PRE-EDIT-READ'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      // Get category IDs from existing month data (no need to read budget)
      const categoryIds = monthData.category_balances?.map(cb => cb.category_id)
        ?? Object.keys(monthData.previous_month_snapshot?.category_balances_end ?? {})

      // Calculate fresh category balances (keep allocations but unfinalized, so allocated = 0)
      const categoryBalances = categoryIds.length > 0
        ? calculateCategoryBalancesForMonth(monthData, categoryIds, monthData.allocations ?? [], false)
        : monthData.category_balances

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations_finalized: false,
        category_balances: categoryBalances,
        category_balances_stale: false, // Fresh values, not stale
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Mark budget snapshot as stale
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)

      // Mark future months as stale
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth }
    },
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })
      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            allocations_finalized: false,
          },
        })
      }

      // Optimistically update category balances - subtract the allocations being un-finalized
      if (previousBudget && previousMonth?.month?.allocations_finalized) {
        const allocationsToRemove = previousMonth.month.allocations || []

        // Calculate how much to subtract from each category
        const deltas: Record<string, number> = {}
        for (const alloc of allocationsToRemove) {
          deltas[alloc.category_id] = (deltas[alloc.category_id] || 0) - alloc.amount
        }

        // Apply deltas to categories
        const updatedCategories: CategoriesMap = {}
        Object.entries(previousBudget.categories).forEach(([catId, cat]) => {
          updatedCategories[catId] = {
            ...cat,
            balance: cat.balance + (deltas[catId] || 0),
          }
        })

        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          categories: updatedCategories,
          categoryBalancesSnapshot: previousBudget.categoryBalancesSnapshot
            ? { ...previousBudget.categoryBalancesSnapshot, is_stale: true }
            : null,
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: this month + future months (budget snapshot already handled above)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
    },
    onError: (_err, params, context) => {
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(params.budgetId, params.year, params.month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousBudget)
      }
    },
  })

  /**
   * Delete allocations (clear allocations and set unfinalized)
   * This removes all allocations for the month and puts it back to unfinalized state
   */
  const deleteAllocations = useMutation({
    mutationFn: async (params: DeleteAllocationsParams) => {
      const { budgetId, year, month } = params

      // Read from Firestore (server truth), not cache
      const monthDocId = getMonthDocId(budgetId, year, month)
      const { exists, data: monthData } = await readDoc<MonthDocument>(
        'months',
        monthDocId,
        'PRE-EDIT-READ'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      // Get category IDs from existing month data (no need to read budget)
      // Use category_balances if available, otherwise from previous_month_snapshot
      const categoryIds = monthData.category_balances?.map(cb => cb.category_id)
        ?? Object.keys(monthData.previous_month_snapshot?.category_balances_end ?? {})

      // Calculate fresh category balances (no allocations, unfinalized)
      const categoryBalances = categoryIds.length > 0
        ? calculateCategoryBalancesForMonth(monthData, categoryIds, [], false)
        : monthData.category_balances

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations: [],
        allocations_finalized: false,
        category_balances: categoryBalances,
        category_balances_stale: false, // Fresh values, not stale
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Mark budget snapshot as stale
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)

      // Mark future months as stale
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth }
    },
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      await queryClient.cancelQueries({ queryKey: monthKey })
      await queryClient.cancelQueries({ queryKey: budgetKey })
      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)
      const previousBudget = queryClient.getQueryData<BudgetData>(budgetKey)

      if (previousMonth) {
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            allocations: [],
            allocations_finalized: false,
          },
        })
      }

      // Optimistically update category balances - subtract the allocations being deleted
      if (previousBudget && previousMonth?.month?.allocations_finalized) {
        const allocationsToRemove = previousMonth.month.allocations || []

        // Calculate how much to subtract from each category
        const deltas: Record<string, number> = {}
        for (const alloc of allocationsToRemove) {
          deltas[alloc.category_id] = (deltas[alloc.category_id] || 0) - alloc.amount
        }

        // Apply deltas to categories
        const updatedCategories: CategoriesMap = {}
        Object.entries(previousBudget.categories).forEach(([catId, cat]) => {
          updatedCategories[catId] = {
            ...cat,
            balance: cat.balance + (deltas[catId] || 0),
          }
        })

        queryClient.setQueryData<BudgetData>(budgetKey, {
          ...previousBudget,
          categories: updatedCategories,
          categoryBalancesSnapshot: previousBudget.categoryBalancesSnapshot
            ? { ...previousBudget.categoryBalancesSnapshot, is_stale: true }
            : null,
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: this month + future months (budget snapshot already handled above)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth, previousBudget }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      queryClient.setQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month), { month: data.updatedMonth })
    },
    onError: (_err, params, context) => {
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(params.budgetId, params.year, params.month), context.previousMonth)
      }
      if (context?.previousBudget) {
        queryClient.setQueryData(queryKeys.budget(params.budgetId), context.previousBudget)
      }
    },
  })

  return {
    saveAllocations,
    finalizeAllocations,
    unfinalizeAllocations,
    deleteAllocations,
  }
}

