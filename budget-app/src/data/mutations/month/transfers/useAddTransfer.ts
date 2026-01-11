/**
 * Add Transfer Hook
 *
 * Adds a new transfer transaction to the month.
 * Transfers move money between accounts and/or categories.
 *
 * USES ENFORCED OPTIMISTIC UPDATES via createOptimisticMutation:
 * 1. Factory REQUIRES optimisticUpdate function - won't compile without it
 * 2. Updates cache instantly (form can close immediately)
 * 3. In background: reads fresh data from Firestore, merges, writes
 * 4. On error: automatic rollback to previous cache state
 */

import { createOptimisticMutation } from '../../infrastructure'
import { readMonthForEdit, writeMonthData } from '@data'
import { queryKeys } from '@data/queryClient'
import type { MonthDocument, TransferTransaction } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

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
  // Internal: used to share transfer ID between optimistic update and mutation
  _transferId?: string
}

interface AddTransferResult {
  updatedMonth: MonthDocument
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
    amount: params.amount,
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
// INTERNAL HOOK
// ============================================================================

const useAddTransferInternal = createOptimisticMutation<
  AddTransferParams,
  AddTransferResult,
  MonthQueryData
>({
  optimisticUpdate: (params) => {
    const { budgetId, year, month } = params

    // Generate transfer ID upfront so optimistic and actual use same ID
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    params._transferId = transferId

    const newTransfer = createTransferObject(params, transferId)

    return {
      cacheKey: queryKeys.month(budgetId, year, month),
      transform: (cachedData) => {
        if (!cachedData?.month) {
          return cachedData as MonthQueryData
        }

        const optimisticMonth: MonthDocument = retotalMonth({
          ...cachedData.month,
          transfers: [...(cachedData.month.transfers || []), newTransfer],
          updated_at: new Date().toISOString(),
        })

        return { month: optimisticMonth }
      },
    }
  },

  mutationFn: async (params) => {
    const { budgetId, year, month, fromAccountId, toAccountId, amount, _transferId } = params

    const transferId = _transferId!
    const newTransfer = createTransferObject(params, transferId)

    // Read fresh data from Firestore, merge, write
    const freshMonthData = await readMonthForEdit(budgetId, year, month, 'add transfer')

    const updatedTransfers = [...(freshMonthData.transfers || []), newTransfer]
    const updatedMonth: MonthDocument = retotalMonth({
      ...freshMonthData,
      transfers: updatedTransfers,
      updated_at: new Date().toISOString(),
    })

    // Write to Firestore
    await writeMonthData({ budgetId, month: updatedMonth, description: 'add transfer' })

    // Update budget's account balances for transfers between real accounts
    const balanceUpdates: { accountId: string; delta: number }[] = []
    if (!isNoAccount(fromAccountId)) {
      balanceUpdates.push({ accountId: fromAccountId, delta: -amount })
    }
    if (!isNoAccount(toAccountId)) {
      balanceUpdates.push({ accountId: toAccountId, delta: amount })
    }
    if (balanceUpdates.length > 0) {
      await updateBudgetAccountBalances(budgetId, balanceUpdates)
    }

    return { updatedMonth, newTransfer }
  },
})

// ============================================================================
// PUBLIC HOOK
// ============================================================================

export function useAddTransfer() {
  const { mutateAsync, isPending, isError, error } = useAddTransferInternal()

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
    return mutateAsync({
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
    isPending,
    isError,
    error,
  }
}
