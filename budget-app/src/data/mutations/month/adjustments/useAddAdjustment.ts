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
import { writeMonthData } from '@data'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, AdjustmentTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

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
    amount: params.amount,
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

      // Optimistically update the cache
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = retotalMonth({
          ...previousData.month,
          adjustments: [...(previousData.month.adjustments || []), newAdjustment],
          updated_at: new Date().toISOString(),
        })
        queryClient.setQueryData<MonthQueryData>(queryKey, { month: optimisticMonth })
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, adjustmentId, newAdjustment }
    },

    // mutationFn does the actual Firestore write
    mutationFn: async (params) => {
      // Context is not directly available here, but we can get from cache
      // which now has our optimistic update
      const { budgetId, year, month, accountId, amount } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new adjustment)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Write to Firestore
      await writeMonthData({ budgetId, month: updatedMonth, description: 'add adjustment' })

      // Update budget's account balance for real accounts
      if (!isNoAccount(accountId)) {
        await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])
      }

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
