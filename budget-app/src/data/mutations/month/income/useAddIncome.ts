/**
 * Add Income Hook
 *
 * Adds a new income transaction to the month.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation:
 * 1. Factory REQUIRES optimisticUpdate function - won't compile without it
 * 2. Updates cache instantly (form can close immediately)
 * 3. In background: reads fresh data from Firestore, merges, writes
 * 4. On error: automatic rollback to previous cache state
 */

import { createOptimisticMutation } from '../../infrastructure'
import { readMonthForEdit, writeMonthData } from '@data'
import { queryKeys, queryClient } from '@data/queryClient'
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
  // Internal: used to share income ID between optimistic update and mutation
  _incomeId?: string
}

interface AddIncomeResult {
  updatedMonth: MonthDocument
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
// INTERNAL HOOK
// ============================================================================

const useAddIncomeInternal = createOptimisticMutation<
  AddIncomeParams,
  AddIncomeResult,
  MonthQueryData
>({
  optimisticUpdate: (params) => {
    const { budgetId, year, month } = params

    // Generate income ID upfront so optimistic and actual use same ID
    const incomeId = `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    params._incomeId = incomeId

    const newIncome = createIncomeObject(params, incomeId)

    return {
      cacheKey: queryKeys.month(budgetId, year, month),
      transform: (cachedData) => {
        if (!cachedData?.month) {
          return cachedData as MonthQueryData
        }

        const optimisticMonth: MonthDocument = retotalMonth({
          ...cachedData.month,
          income: [...(cachedData.month.income || []), newIncome],
          updated_at: new Date().toISOString(),
        })

        return { month: optimisticMonth }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, year, month, accountId, payee, amount, _incomeId } = params

    const incomeId = _incomeId!
    const newIncome = createIncomeObject(params, incomeId)

    // Read fresh data from Firestore, merge, write
    const freshMonthData = await readMonthForEdit(budgetId, year, month, 'add income')

    const updatedIncome = [...(freshMonthData.income || []), newIncome]
    const updatedMonth: MonthDocument = retotalMonth({
      ...freshMonthData,
      income: updatedIncome,
      updated_at: new Date().toISOString(),
    })

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

    return { updatedMonth, newIncome }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useAddIncome() {
  const { mutateAsync, isPending, isError, error } = useAddIncomeInternal()

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
    return mutateAsync({
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
    isPending,
    isError,
    error,
  }
}
