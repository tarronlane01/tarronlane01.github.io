/**
 * Update Transfer Hook
 *
 * Updates an existing transfer transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument, TransferTransaction } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

/**
 * Check if transfer values have actually changed (no-op detection)
 */
function hasTransferChanges(
  oldTransfer: TransferTransaction | undefined,
  amount: number,
  fromAccountId: string,
  toAccountId: string,
  fromCategoryId: string,
  toCategoryId: string,
  date: string,
  description?: string,
  cleared?: boolean
): boolean {
  if (!oldTransfer) return true // New transfer, always save

  const oldDescription = oldTransfer.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldTransfer.amount ||
    fromAccountId !== oldTransfer.from_account_id ||
    toAccountId !== oldTransfer.to_account_id ||
    fromCategoryId !== oldTransfer.from_category_id ||
    toCategoryId !== oldTransfer.to_category_id ||
    date !== oldTransfer.date ||
    newDescription !== oldDescription ||
    cleared !== oldTransfer.cleared
  )
}

export function useUpdateTransfer() {
  const { writeData } = useWriteMonthData()

  const updateTransfer = async (
    budgetId: string,
    year: number,
    month: number,
    transferId: string,
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'update transfer')

    // Find old transfer to calculate delta and check for changes
    const oldTransfer = (monthData.transfers || []).find(t => t.id === transferId)

    // No-op detection: skip write if nothing changed
    if (!hasTransferChanges(oldTransfer, amount, fromAccountId, toAccountId, fromCategoryId, toCategoryId, date, description, cleared)) {
      return { updatedMonth: monthData, noOp: true }
    }

    const oldAmount = oldTransfer?.amount ?? 0
    const oldFromAccountId = oldTransfer?.from_account_id ?? fromAccountId
    const oldToAccountId = oldTransfer?.to_account_id ?? toAccountId

    const updatedTransfer: TransferTransaction = {
      id: transferId,
      amount,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      from_category_id: fromCategoryId,
      to_category_id: toCategoryId,
      date,
      created_at: monthData.transfers?.find(t => t.id === transferId)?.created_at || new Date().toISOString(),
    }
    if (description) updatedTransfer.description = description
    if (cleared !== undefined) updatedTransfer.cleared = cleared

    const updatedTransfersList = (monthData.transfers || []).map(t => t.id === transferId ? updatedTransfer : t)

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      transfers: updatedTransfersList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update transfer' })

    // Update budget's account balances
    // Need to reverse old effects and apply new effects
    const balanceUpdates: { accountId: string; delta: number }[] = []

    // Reverse old from-account effect (was -oldAmount, so add back)
    if (!isNoAccount(oldFromAccountId)) {
      balanceUpdates.push({ accountId: oldFromAccountId, delta: oldAmount })
    }
    // Reverse old to-account effect (was +oldAmount, so subtract)
    if (!isNoAccount(oldToAccountId)) {
      balanceUpdates.push({ accountId: oldToAccountId, delta: -oldAmount })
    }
    // Apply new from-account effect
    if (!isNoAccount(fromAccountId)) {
      balanceUpdates.push({ accountId: fromAccountId, delta: -amount })
    }
    // Apply new to-account effect
    if (!isNoAccount(toAccountId)) {
      balanceUpdates.push({ accountId: toAccountId, delta: amount })
    }

    if (balanceUpdates.length > 0) {
      await updateBudgetAccountBalances(budgetId, balanceUpdates)
    }

    return { updatedMonth }
  }

  return {
    updateTransfer,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

