/**
 * Add Expense Hook
 *
 * Adds a new expense transaction to the month.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation:
 * 1. Factory REQUIRES optimisticUpdate function - won't compile without it
 * 2. Updates cache instantly (form can close immediately)
 * 3. In background: uses cache if fresh, fetches if stale, then writes
 * 4. On error: automatic rollback to previous cache state
 *
 * CACHE-AWARE PATTERN:
 * - If cache is fresh: writes optimistic data directly (0 reads)
 * - If cache is stale: fetches fresh, applies change, writes (1 read)
 */

import { createOptimisticMutation } from '../../infrastructure'
import { writeMonthData } from '@data'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, ExpenseTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { savePayeeIfNew } from '../../payees'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { queryClient } from '@data/queryClient'
import { isMonthCacheFresh, getMonthForMutation } from '../cacheAwareMonthRead'

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
  // Internal: shared between optimistic update and mutation
  _expenseId?: string
  _cacheWasFresh?: boolean
}

interface AddExpenseResult {
  updatedMonth: MonthDocument
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
// INTERNAL HOOK - Created via factory with REQUIRED optimistic update
// ============================================================================

/**
 * Internal hook created via factory with enforced optimistic updates.
 *
 * ENFORCEMENT: This uses createOptimisticMutation which REQUIRES the
 * optimisticUpdate function. If you try to create this without it:
 *
 * ```ts
 * // TypeScript ERROR: Property 'optimisticUpdate' is missing
 * createOptimisticMutation({
 *   mutationFn: async (params) => { ... },
 * })
 * ```
 *
 * This architectural pattern makes it impossible to forget optimistic updates.
 */
const useAddExpenseInternal = createOptimisticMutation<
  AddExpenseParams,
  AddExpenseResult,
  MonthQueryData
>({
  optimisticUpdate: (params) => {
    const { budgetId, year, month } = params

    // Check cache freshness BEFORE transforming (for mutationFn to use)
    params._cacheWasFresh = isMonthCacheFresh(budgetId, year, month)

    // Generate expense ID upfront so optimistic and actual use same ID
    const expenseId = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    params._expenseId = expenseId

    const newExpense = createExpenseObject(params, expenseId)

    return {
      cacheKey: queryKeys.month(budgetId, year, month),
      transform: (cachedData) => {
        if (!cachedData?.month) {
          return cachedData as MonthQueryData
        }

        const optimisticMonth: MonthDocument = retotalMonth({
          ...cachedData.month,
          expenses: [...(cachedData.month.expenses || []), newExpense],
          updated_at: new Date().toISOString(),
        })

        return { month: optimisticMonth }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, year, month, accountId, payee, amount, _expenseId, _cacheWasFresh } = params

    const expenseId = _expenseId!
    const newExpense = createExpenseObject(params, expenseId)

    let updatedMonth: MonthDocument

    if (_cacheWasFresh) {
      // Cache was fresh - optimistic data is accurate, just get it and write
      const cachedMonth = await getMonthForMutation(budgetId, year, month, true)
      updatedMonth = cachedMonth // Already has the expense from optimistic update
    } else {
      // Cache was stale - fetch fresh, add expense, compute totals
      const freshMonth = await getMonthForMutation(budgetId, year, month, false)
      updatedMonth = retotalMonth({
        ...freshMonth,
        expenses: [...(freshMonth.expenses || []), newExpense],
        updated_at: new Date().toISOString(),
      })
    }

    // Write to Firestore
    await writeMonthData({ budgetId, month: updatedMonth, description: 'add expense' })

    // Update budget's account balance
    await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])

    // Save payee if new
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
      }
    }

    return { updatedMonth, newExpense }
  },
})

// ============================================================================
// PUBLIC HOOK - Maintains backwards-compatible API
// ============================================================================

/**
 * Public hook that wraps the factory-created mutation with the original API.
 * This maintains backwards compatibility with existing code.
 */
export function useAddExpense() {
  const { mutateAsync, isPending, isError, error } = useAddExpenseInternal()

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
    return mutateAsync({
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
    isPending,
    isError,
    error,
  }
}
