/**
 * Add Adjustment Hook
 *
 * Adds a new adjustment transaction to the month.
 * Adjustments are one-sided corrections that can affect account and/or category balances.
 * Allows NO_ACCOUNT_ID or NO_CATEGORY_ID for adjustments that don't affect one side.
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
import type { MonthDocument, AdjustmentTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'
import { isMonthCacheFresh, getMonthForMutation } from '../cacheAwareMonthRead'

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
  // Internal: shared between optimistic update and mutation
  _adjustmentId?: string
  _cacheWasFresh?: boolean
}

interface AddAdjustmentResult {
  updatedMonth: MonthDocument
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
// INTERNAL HOOK
// ============================================================================

const useAddAdjustmentInternal = createOptimisticMutation<
  AddAdjustmentParams,
  AddAdjustmentResult,
  MonthQueryData
>({
  optimisticUpdate: (params) => {
    const { budgetId, year, month } = params

    // Check cache freshness BEFORE transforming (for mutationFn to use)
    params._cacheWasFresh = isMonthCacheFresh(budgetId, year, month)

    // Generate adjustment ID upfront so optimistic and actual use same ID
    const adjustmentId = `adjustment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    params._adjustmentId = adjustmentId

    const newAdjustment = createAdjustmentObject(params, adjustmentId)

    return {
      cacheKey: queryKeys.month(budgetId, year, month),
      transform: (cachedData) => {
        if (!cachedData?.month) {
          return cachedData as MonthQueryData
        }

        const optimisticMonth: MonthDocument = retotalMonth({
          ...cachedData.month,
          adjustments: [...(cachedData.month.adjustments || []), newAdjustment],
          updated_at: new Date().toISOString(),
        })

        return { month: optimisticMonth }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, year, month, accountId, amount, _adjustmentId, _cacheWasFresh } = params

    const adjustmentId = _adjustmentId!
    const newAdjustment = createAdjustmentObject(params, adjustmentId)

    let updatedMonth: MonthDocument

    if (_cacheWasFresh) {
      // Cache was fresh - optimistic data is accurate, just get it and write
      const cachedMonth = await getMonthForMutation(budgetId, year, month, true)
      updatedMonth = cachedMonth // Already has the adjustment from optimistic update
    } else {
      // Cache was stale - fetch fresh, add adjustment, compute totals
      const freshMonth = await getMonthForMutation(budgetId, year, month, false)
      updatedMonth = retotalMonth({
        ...freshMonth,
        adjustments: [...(freshMonth.adjustments || []), newAdjustment],
        updated_at: new Date().toISOString(),
      })
    }

    // Write to Firestore
    await writeMonthData({ budgetId, month: updatedMonth, description: 'add adjustment' })

    // Update budget's account balance for real accounts
    if (!isNoAccount(accountId)) {
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])
    }

    return { updatedMonth, newAdjustment }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useAddAdjustment() {
  const { mutateAsync, isPending, isError, error } = useAddAdjustmentInternal()

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
    return mutateAsync({
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
    isPending,
    isError,
    error,
  }
}
