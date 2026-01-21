/**
 * Add Transfer Hook
 *
 * Adds a new transfer transaction to the month.
 * Transfers move money between accounts and/or categories.
 *
 * Uses React Query's native optimistic update pattern:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore using the optimistic data
 * 3. onError: Rollback to previous state
 * 4. onSuccess: Cache is already correct from optimistic update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, TransferTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

interface AddTransferParams {
  budgetId: string
  year: number
  month: number
  amount: number
  fromAccountId: string
  toAccountId: string
  fromCategoryId: string
  toCategoryId: string
  date: string
  description?: string
  cleared?: boolean
}

interface AddTransferResult {
  updatedMonth: MonthDocument
  newTransfer: TransferTransaction
}

interface MutationContext {
  previousData: MonthQueryData | undefined
  transferId: string
  newTransfer: TransferTransaction
}

// ============================================================================
// HELPER: Create transfer object
// ============================================================================

function createTransferObject(
  params: AddTransferParams,
  transferId: string
): TransferTransaction {
  const newTransfer: TransferTransaction = {
    id: transferId,
    // Round amount to ensure 2 decimal precision before storing
    amount: roundCurrency(params.amount),
    from_account_id: params.fromAccountId,
    to_account_id: params.toAccountId,
    from_category_id: params.fromCategoryId,
    to_category_id: params.toCategoryId,
    date: params.date,
    created_at: new Date().toISOString(),
  }
  if (params.description) newTransfer.description = params.description
  if (params.cleared !== undefined) newTransfer.cleared = params.cleared
  return newTransfer
}

// ============================================================================
// HOOK
// ============================================================================

export function useAddTransfer() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
      const { updateMonthCacheAndTrack, recalculateMonthAndCascade } = useMonthMutationHelpers()

  const mutation = useMutation<AddTransferResult, Error, AddTransferParams, MutationContext>({
    // onMutate runs BEFORE mutationFn - this is where we do optimistic updates
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<MonthQueryData>(queryKey)

      // Generate transfer ID upfront so optimistic and actual use same ID
      const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newTransfer = createTransferObject(params, transferId)

      // Optimistically update the cache with the new transaction
      // Retotalling and recalculation will happen in recalculateMonthAndCascade
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = {
          ...previousData.month,
          transfers: [...(previousData.month.transfers || []), newTransfer],
          updated_at: new Date().toISOString(),
        }
        updateMonthCacheAndTrack(budgetId, year, month, optimisticMonth)
      }

      // Recalculate month, all future months, and budget - all in one call
      try {
        await recalculateMonthAndCascade(budgetId, year, month)
      } catch (error) {
        console.warn('[useAddTransfer] Failed to recalculate month and cascade:', error)
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
          console.warn('[useAddTransfer] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, transferId, newTransfer }
    },

    // mutationFn no longer writes to Firestore - just returns the updated data
    mutationFn: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new transfer)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Find the transfer we added (last one in the array)
      const newTransfer = updatedMonth.transfers?.[updatedMonth.transfers.length - 1]
      if (!newTransfer) {
        throw new Error('Could not find new transfer in updated month')
      }

      return { updatedMonth, newTransfer }
    },

    // onError rolls back the optimistic update
    onError: (_error, params, context) => {
      if (context?.previousData) {
        const { budgetId, year, month } = params
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousData)
      }
    },
  })

  const addTransfer = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    return mutation.mutateAsync({
      budgetId,
      year,
      month,
      amount,
      fromAccountId,
      toAccountId,
      fromCategoryId,
      toCategoryId,
      date,
      description,
      cleared,
    })
  }

  return {
    addTransfer,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
