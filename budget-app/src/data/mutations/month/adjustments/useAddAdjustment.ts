/**
 * Add Adjustment Hook
 *
 * Adds a new adjustment transaction to the month.
 * Adjustments are one-sided corrections that can affect account and/or category balances.
 * Allows NO_ACCOUNT_ID or NO_CATEGORY_ID for adjustments that don't affect one side.
 *
 * Uses React Query's native optimistic update pattern:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore using the optimistic data
 * 3. onError: Rollback to previous state
 * 4. onSuccess: Cache is already correct from optimistic update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, AdjustmentTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

interface AddAdjustmentParams {
  budgetId: string
  year: number
  month: number
  amount: number
  accountId: string
  categoryId: string
  date: string
  payee?: string
  description?: string
  cleared?: boolean
}

interface AddAdjustmentResult {
  updatedMonth: MonthDocument
  newAdjustment: AdjustmentTransaction
}

interface MutationContext {
  previousData: MonthQueryData | undefined
  adjustmentId: string
  newAdjustment: AdjustmentTransaction
}

// ============================================================================
// HELPER: Create adjustment object
// ============================================================================

function createAdjustmentObject(
  params: AddAdjustmentParams,
  adjustmentId: string
): AdjustmentTransaction {
  const newAdjustment: AdjustmentTransaction = {
    id: adjustmentId,
    // Round amount to ensure 2 decimal precision before storing
    amount: roundCurrency(params.amount),
    account_id: params.accountId,
    category_id: params.categoryId,
    date: params.date,
    created_at: new Date().toISOString(),
  }
  if (params.payee?.trim()) newAdjustment.payee = params.payee.trim()
  if (params.description) newAdjustment.description = params.description
  if (params.cleared !== undefined) newAdjustment.cleared = params.cleared
  return newAdjustment
}

// ============================================================================
// HOOK
// ============================================================================

export function useAddAdjustment() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const mutation = useMutation<AddAdjustmentResult, Error, AddAdjustmentParams, MutationContext>({
    // onMutate runs BEFORE mutationFn - this is where we do optimistic updates
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<MonthQueryData>(queryKey)

      // Generate adjustment ID upfront so optimistic and actual use same ID
      const adjustmentId = `adjustment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newAdjustment = createAdjustmentObject(params, adjustmentId)

      // Optimistically update the cache with the new transaction
      // Retotalling and recalculation will happen in recalculateMonthAndCascade
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = {
          ...previousData.month,
          adjustments: [...(previousData.month.adjustments || []), newAdjustment],
          updated_at: new Date().toISOString(),
        }
        updateMonthCacheAndTrack(budgetId, year, month, optimisticMonth)
      }

      // Recalculate month, all future months, and budget - all in one call
      try {
        await recalculateMonthAndCascade(budgetId, year, month)
      } catch (error) {
        console.warn('[useAddAdjustment] Failed to recalculate month and cascade:', error)
        // Continue even if recalculation fails
      }

      // Save current document immediately if it's the one being viewed
      const isCurrentDocument = currentViewingDocument.type === 'month' &&
        currentViewingDocument.year === year &&
        currentViewingDocument.month === month

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'month', year, month)
        } catch (error) {
          console.warn('[useAddAdjustment] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, adjustmentId, newAdjustment }
    },

    // mutationFn no longer writes to Firestore - just returns the updated data
    mutationFn: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new adjustment)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Find the adjustment we added (last one in the array)
      const newAdjustment = updatedMonth.adjustments?.[updatedMonth.adjustments.length - 1]
      if (!newAdjustment) {
        throw new Error('Could not find new adjustment in updated month')
      }

      return { updatedMonth, newAdjustment }
    },

    // onError rolls back the optimistic update
    onError: (_error, params, context) => {
      if (context?.previousData) {
        const { budgetId, year, month } = params
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousData)
      }
    },

    // onSuccess - cache is already correct from optimistic update
    // writeMonthData also updates the cache, so we're in sync
  })

  const addAdjustment = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    return mutation.mutateAsync({
      budgetId,
      year,
      month,
      amount,
      accountId,
      categoryId,
      date,
      payee,
      description,
      cleared,
    })
  }

  return {
    addAdjustment,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
