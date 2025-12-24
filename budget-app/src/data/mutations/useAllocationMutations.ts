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
import { queryCollection, readDoc, writeDoc, getMonthDocId, type FirestoreData } from '../firestore/operations'
import { queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/useMonthQuery'
import { markNextMonthSnapshotStaleInCache } from '../queries/useMonthQuery'
import type { BudgetData } from '../queries/useBudgetQuery'
import type { MonthDocument, CategoriesMap } from '../../types/budget'
import type { SaveAllocationsParams, FinalizeAllocationsParams, UnfinalizeAllocationsParams } from './monthMutationTypes'
import {
  saveMonthToFirestore,
  // Cache-only helpers (for onMutate)
  markCategoryBalancesSnapshotStaleInCache,
  markMonthCategoryBalancesStaleInCache,
  markFutureMonthsCategoryBalancesStaleInCache,
  // Firestore-only helpers (for mutationFn)
  markCategoryBalancesSnapshotStaleInFirestore,
  markMonthCategoryBalancesStaleInFirestore,
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
        'reading month before saving allocations (need current state)'
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
        'reading month before saving allocations (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations,
        allocations_finalized: true,
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Recalculate category balances on budget document
      // Read budget from Firestore (server truth), not cache
      const { exists: budgetExists, data: budgetData } = await readDoc<FirestoreData>(
        'budgets',
        budgetId,
        'reading budget to recalculate category balances after finalizing allocations'
      )
      let updatedCategories: CategoriesMap | null = null

      if (budgetExists && budgetData) {
        // Sum allocations from all finalized months
        const monthsResult = await queryCollection<{
          allocations_finalized?: boolean
          allocations?: Array<{ category_id: string; amount: number }>
        }>(
          'months',
          'summing allocations from all finalized months to recalculate category balances',
          [{ field: 'budget_id', op: '==', value: budgetId }]
        )

        const balances: Record<string, number> = {}
        const existingCategories: CategoriesMap = budgetData.categories || {}
        Object.keys(existingCategories).forEach(catId => { balances[catId] = 0 })

        for (const docSnap of monthsResult.docs) {
          const data = docSnap.data
          if (data.allocations_finalized && data.allocations) {
            for (const alloc of data.allocations) {
              balances[alloc.category_id] = (balances[alloc.category_id] || 0) + alloc.amount
            }
          }
        }

        // Update categories with new balances
        const categoriesWithBalances: CategoriesMap = {}
        Object.entries(existingCategories).forEach(([catId, cat]) => {
          categoriesWithBalances[catId] = {
            ...cat,
            balance: balances[catId] ?? 0,
          }
        })
        updatedCategories = categoriesWithBalances

        // Save to budget document
        await writeDoc(
          'budgets',
          budgetId,
          {
            ...budgetData,
            categories: updatedCategories,
          },
          'saving recalculated category balances after finalizing allocations'
        )
      }

      // Mark stale in Firestore: budget snapshot + this month + future months
      // (Cache already updated in onMutate)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
      await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth, updatedCategories }
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
            allocations_finalized: true,
          },
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: budget snapshot + this month + future months
      markCategoryBalancesSnapshotStaleInCache(budgetId)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

      return { previousMonth }
    },
    onSuccess: (data, params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)
      const budgetKey = queryKeys.budget(budgetId)

      queryClient.setQueryData<MonthQueryData>(monthKey, { month: data.updatedMonth })

      if (data.updatedCategories) {
        const currentBudget = queryClient.getQueryData<BudgetData>(budgetKey)
        if (currentBudget) {
          queryClient.setQueryData<BudgetData>(budgetKey, {
            ...currentBudget,
            categories: data.updatedCategories,
          })
        }
      }
    },
    onError: (_err, params, context) => {
      if (context?.previousMonth) {
        queryClient.setQueryData(queryKeys.month(params.budgetId, params.year, params.month), context.previousMonth)
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
        'reading month before saving allocations (need current state)'
      )

      if (!exists || !monthData) {
        throw new Error('Month data not found in Firestore')
      }

      const updatedMonth: MonthDocument = {
        ...monthData,
        allocations_finalized: false,
        updated_at: new Date().toISOString(),
      }

      await saveMonthToFirestore(budgetId, updatedMonth)

      // Mark stale in Firestore: budget snapshot + this month + future months
      // (Cache already updated in onMutate)
      await markCategoryBalancesSnapshotStaleInFirestore(budgetId)
      await markMonthCategoryBalancesStaleInFirestore(budgetId, year, month)
      await markFutureMonthsCategoryBalancesStaleInFirestore(budgetId, year, month)

      return { updatedMonth }
    },
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const monthKey = queryKeys.month(budgetId, year, month)

      await queryClient.cancelQueries({ queryKey: monthKey })
      const previousMonth = queryClient.getQueryData<MonthQueryData>(monthKey)

      if (previousMonth) {
        queryClient.setQueryData<MonthQueryData>(monthKey, {
          ...previousMonth,
          month: {
            ...previousMonth.month,
            allocations_finalized: false,
          },
        })
      }

      // CROSS-MONTH: Mark next month as stale in cache immediately
      markNextMonthSnapshotStaleInCache(budgetId, year, month)
      // Mark stale in cache: budget snapshot + this month + future months
      markCategoryBalancesSnapshotStaleInCache(budgetId)
      markMonthCategoryBalancesStaleInCache(budgetId, year, month)
      markFutureMonthsCategoryBalancesStaleInCache(budgetId, year, month)

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

  return {
    saveAllocations,
    finalizeAllocations,
    unfinalizeAllocations,
  }
}

