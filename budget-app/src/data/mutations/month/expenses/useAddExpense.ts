/**
 * Add Expense Hook
 *
 * Adds a new expense transaction to the month.
 *
 * Uses React Query's native optimistic update pattern:
 * 1. onMutate: Cancel queries, save previous state, apply optimistic update
 * 2. mutationFn: Write to Firestore using the optimistic data
 * 3. onError: Rollback to previous state
 * 4. onSuccess: Cache is already correct from optimistic update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, ExpenseTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { savePayeeIfNew } from '../../payees'
import { useBudget } from '@contexts'
import { useBackgroundSave } from '@hooks/useBackgroundSave'
import { useMonthMutationHelpers } from '../mutationHelpers'

// ============================================================================
// TYPES
// ============================================================================

interface AddExpenseParams {
  budgetId: string
  year: number
  month: number
  amount: number
  categoryId: string
  accountId: string
  date: string
  payee?: string
  description?: string
  cleared?: boolean
}

interface AddExpenseResult {
  updatedMonth: MonthDocument
  newExpense: ExpenseTransaction
}

interface MutationContext {
  previousData: MonthQueryData | undefined
  expenseId: string
  newExpense: ExpenseTransaction
}

// ============================================================================
// HELPER: Create expense object
// ============================================================================

function createExpenseObject(
  params: AddExpenseParams,
  expenseId: string
): ExpenseTransaction {
  const newExpense: ExpenseTransaction = {
    id: expenseId,
    amount: params.amount,
    category_id: params.categoryId,
    account_id: params.accountId,
    date: params.date,
    created_at: new Date().toISOString(),
  }
  if (params.payee?.trim()) newExpense.payee = params.payee.trim()
  if (params.description) newExpense.description = params.description
  if (params.cleared !== undefined) newExpense.cleared = params.cleared
  return newExpense
}

// ============================================================================
// HOOK
// ============================================================================

export function useAddExpense() {
  const queryClient = useQueryClient()
  const { currentViewingDocument } = useBudget()
  const { saveCurrentDocument } = useBackgroundSave()
  const { updateMonthCacheAndTrack, recalculateMonthAndCascade, trackChange } = useMonthMutationHelpers()

  const mutation = useMutation<AddExpenseResult, Error, AddExpenseParams, MutationContext>({
    // onMutate runs BEFORE mutationFn - this is where we do optimistic updates
    onMutate: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData<MonthQueryData>(queryKey)

      // Generate expense ID upfront so optimistic and actual use same ID
      const expenseId = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newExpense = createExpenseObject(params, expenseId)

      // Optimistically update the cache with the new transaction
      // Retotalling and recalculation will happen in recalculateMonthAndCascade
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = {
          ...previousData.month,
          expenses: [...(previousData.month.expenses || []), newExpense],
          updated_at: new Date().toISOString(),
        }
        updateMonthCacheAndTrack(budgetId, year, month, optimisticMonth)
      }

      // Recalculate month, all future months, and budget - all in one call
      try {
        await recalculateMonthAndCascade(budgetId, year, month)
      } catch (error) {
        console.warn('[useAddExpense] Failed to recalculate month and cascade:', error)
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
          console.warn('[useAddExpense] Failed to save current document immediately:', error)
          // Continue even if immediate save fails - background save will handle it
        }
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, expenseId, newExpense }
    },

    // mutationFn no longer writes to Firestore - just returns the updated data
    mutationFn: async (params) => {
      const { budgetId, year, month } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new expense)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Find the expense we added (last one in the array)
      const newExpense = updatedMonth.expenses?.[updatedMonth.expenses.length - 1]
      if (!newExpense) {
        throw new Error('Could not find new expense in updated month')
      }

      return { updatedMonth, newExpense }
    },

    // onError rolls back the optimistic update
    onError: (_error, params, context) => {
      if (context?.previousData) {
        const { budgetId, year, month } = params
        queryClient.setQueryData(queryKeys.month(budgetId, year, month), context.previousData)
      }
    },
  })

  const addExpense = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    categoryId: string,
    accountId: string,
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
      categoryId,
      accountId,
      date,
      payee,
      description,
      cleared,
    })
  }

  return {
    addExpense,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
