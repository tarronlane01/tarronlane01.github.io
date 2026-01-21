/**
 * Add Income Hook
 *
 * Adds a new income transaction to the month.
 *
 * Uses React Query's native optimistic update pattern:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore using the optimistic data
 * 3. onError: Rollback to previous state
 * 4. onSuccess: Cache is already correct from optimistic update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, IncomeTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { savePayeeIfNew } from '../../payees'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'
import { roundCurrency } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

interface AddIncomeParams {
  budgetId: string
  year: number
  month: number
  amount: number
  accountId: string
  date: string
  payee?: string
  description?: string
}

interface AddIncomeResult {
  updatedMonth: MonthDocument
  newIncome: IncomeTransaction
}

interface MutationContext {
  previousData: MonthQueryData | undefined
  incomeId: string
  newIncome: IncomeTransaction
}

// ============================================================================
// HELPER: Create income object
// ============================================================================

function createIncomeObject(
  params: AddIncomeParams,
  incomeId: string
): IncomeTransaction {
  const newIncome: IncomeTransaction = {
    id: incomeId,
    // Round amount to ensure 2 decimal precision before storing
    amount: roundCurrency(params.amount),
    account_id: params.accountId,
    date: params.date,
    created_at: new Date().toISOString(),
  }
  if (params.payee?.trim()) newIncome.payee = params.payee.trim()
  if (params.description) newIncome.description = params.description
  return newIncome
}

// ============================================================================
// HOOK
// ============================================================================

export function useAddIncome() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade, trackChange } = useMonthMutationHelpers()

  const mutation = useMutation<AddIncomeResult, Error, AddIncomeParams, MutationContext>({
    // onMutate runs BEFORE mutationFn - this is where we do optimistic updates
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<MonthQueryData>(queryKey)

      // Generate income ID upfront so optimistic and actual use same ID
      const incomeId = `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newIncome = createIncomeObject(params, incomeId)

      // Optimistically update the cache with the new transaction
      // Retotalling and recalculation will happen in recalculateMonthAndCascade
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = {
          ...previousData.month,
          income: [...(previousData.month.income || []), newIncome],
          updated_at: new Date().toISOString(),
        }
        updateMonthCacheAndTrack(budgetId, year, month, optimisticMonth)
      }

      // Recalculate month, all future months, and budget - all in one call
      try {
        await recalculateMonthAndCascade(budgetId, year, month)
      } catch (error) {
        console.warn('[useAddIncome] Failed to recalculate month and cascade:', error)
        // Continue even if recalculation fails
      }

      // Save payee if new (this still writes immediately since it's just adding to a list)
      if (params.payee?.trim()) {
        const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
        const updatedPayees = await savePayeeIfNew(budgetId, params.payee, cachedPayees)
        if (updatedPayees) {
          queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
          trackChange({ type: 'payees', budgetId })
        }
      }

      // Save current document immediately if it's the one being viewed
      const isCurrentDocument = currentViewingDocument.type === 'month' &&
        currentViewingDocument.year === year &&
        currentViewingDocument.month === month

      if (isCurrentDocument) {
        try {
          await saveCurrentDocument(budgetId, 'month', year, month)
        } catch (error) {
          console.warn('[useAddIncome] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, incomeId, newIncome }
    },

    // mutationFn no longer writes to Firestore - just returns the updated data
    mutationFn: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new income)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Find the income we added (last one in the array)
      const newIncome = updatedMonth.income?.[updatedMonth.income.length - 1]
      if (!newIncome) {
        throw new Error('Could not find new income in updated month')
      }

      return { updatedMonth, newIncome }
    },

    // onError rolls back the optimistic update
    onError: (_error, params, context) => {
      if (context?.previousData) {
        const { budgetId, year, month } = params
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousData)
      }
    },
  })

  const addIncome = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    return mutation.mutateAsync({
      budgetId,
      year,
      month,
      amount,
      accountId,
      date,
      payee,
      description,
    })
  }

  return {
    addIncome,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
