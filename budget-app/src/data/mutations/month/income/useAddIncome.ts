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
import { writeMonthData } from '@data'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, IncomeTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { savePayeeIfNew } from '../../payees'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

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
    amount: params.amount,
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

      // Optimistically update the cache
      if (previousData?.month) {
        const optimisticMonth: MonthDocument = retotalMonth({
          ...previousData.month,
          income: [...(previousData.month.income || []), newIncome],
          updated_at: new Date().toISOString(),
        })
        queryClient.setQueryData<MonthQueryData>(queryKey, { month: optimisticMonth })
      }

      // Return context for rollback and for mutationFn to use
      return { previousData, incomeId, newIncome }
    },

    // mutationFn does the actual Firestore write
    mutationFn: async (params) => {
      const { budgetId, year, month, accountId, payee, amount } = params
      const queryKey = queryKeys.month(budgetId, year, month)

      // Get the optimistic data we just set (includes the new income)
      const cachedData = queryClient.getQueryData<MonthQueryData>(queryKey)
      if (!cachedData?.month) {
        throw new Error('No month data in cache after optimistic update')
      }

      const updatedMonth = cachedData.month

      // Write to Firestore
      await writeMonthData({ budgetId, month: updatedMonth, description: 'add income' })

      // Update budget's account balance (income increases balance)
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])

      // Save payee if new
      if (payee?.trim()) {
        const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
        const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
        if (updatedPayees) {
          queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
        }
      }

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
