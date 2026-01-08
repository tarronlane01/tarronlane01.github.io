/**
 * Add Transfer Hook
 *
 * Adds a new transfer transaction to the month.
 * Transfers move money between accounts and/or categories.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument, TransferTransaction } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

export function useAddTransfer() {
  const { writeData } = useWriteMonthData()

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
    const monthData = await readMonthForEdit(budgetId, year, month, 'add transfer')

    const newTransfer: TransferTransaction = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      from_category_id: fromCategoryId,
      to_category_id: toCategoryId,
      date,
      created_at: new Date().toISOString(),
    }
    if (description) newTransfer.description = description
    if (cleared !== undefined) newTransfer.cleared = cleared

    const updatedTransfers = [...(monthData.transfers || []), newTransfer]

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      transfers: updatedTransfers,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'add transfer' })

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
  }

  return {
    addTransfer,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}


