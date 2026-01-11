/**
 * Delete Transfer Hook
 *
 * Deletes a transfer transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 *
 * CACHE-AWARE PATTERN:
 * - If cache is fresh: uses cached data (0 reads)
 * - If cache is stale: fetches fresh data (1 read)
 */

import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'
import { isMonthCacheFresh, getMonthForMutation } from '../cacheAwareMonthRead'

export function useDeleteTransfer() {
  const { writeData } = useWriteMonthData()

  const deleteTransfer = async (
    budgetId: string,
    year: number,
    month: number,
    transferId: string
  ) => {
    // Use cache if fresh, fetch if stale
    const cacheIsFresh = isMonthCacheFresh(budgetId, year, month)
    const monthData = await getMonthForMutation(budgetId, year, month, cacheIsFresh)

    // Find transfer being deleted to get amount and accounts
    const deletedTransfer = (monthData.transfers || []).find(t => t.id === transferId)
    const deletedAmount = deletedTransfer?.amount ?? 0
    const deletedFromAccountId = deletedTransfer?.from_account_id
    const deletedToAccountId = deletedTransfer?.to_account_id

    const updatedTransfersList = (monthData.transfers || []).filter(t => t.id !== transferId)

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      transfers: updatedTransfersList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete transfer' })

    // Update budget's account balances - reverse the deleted transfer's effect
    const balanceUpdates: { accountId: string; delta: number }[] = []

    // Reverse from-account effect (was -amount, so add back)
    if (deletedFromAccountId && !isNoAccount(deletedFromAccountId) && deletedAmount !== 0) {
      balanceUpdates.push({ accountId: deletedFromAccountId, delta: deletedAmount })
    }
    // Reverse to-account effect (was +amount, so subtract)
    if (deletedToAccountId && !isNoAccount(deletedToAccountId) && deletedAmount !== 0) {
      balanceUpdates.push({ accountId: deletedToAccountId, delta: -deletedAmount })
    }

    if (balanceUpdates.length > 0) {
      await updateBudgetAccountBalances(budgetId, balanceUpdates)
    }

    return { updatedMonth }
  }

  return {
    deleteTransfer,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}



