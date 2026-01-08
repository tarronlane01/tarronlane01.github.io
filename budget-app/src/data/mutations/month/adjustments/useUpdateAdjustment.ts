/**
 * Update Adjustment Hook
 *
 * Updates an existing adjustment transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument, AdjustmentTransaction } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

/**
 * Check if adjustment values have actually changed (no-op detection)
 */
function hasAdjustmentChanges(
  oldAdjustment: AdjustmentTransaction | undefined,
  amount: number,
  accountId: string,
  categoryId: string,
  date: string,
  description?: string,
  cleared?: boolean
): boolean {
  if (!oldAdjustment) return true // New adjustment, always save

  const oldDescription = oldAdjustment.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldAdjustment.amount ||
    accountId !== oldAdjustment.account_id ||
    categoryId !== oldAdjustment.category_id ||
    date !== oldAdjustment.date ||
    newDescription !== oldDescription ||
    cleared !== oldAdjustment.cleared
  )
}

export function useUpdateAdjustment() {
  const { writeData } = useWriteMonthData()

  const updateAdjustment = async (
    budgetId: string,
    year: number,
    month: number,
    adjustmentId: string,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'update adjustment')

    // Find old adjustment to calculate delta and check for changes
    const oldAdjustment = (monthData.adjustments || []).find(a => a.id === adjustmentId)

    // No-op detection: skip write if nothing changed
    if (!hasAdjustmentChanges(oldAdjustment, amount, accountId, categoryId, date, description, cleared)) {
      return { updatedMonth: monthData, noOp: true }
    }

    const oldAmount = oldAdjustment?.amount ?? 0
    const oldAccountId = oldAdjustment?.account_id ?? accountId

    const updatedAdjustment: AdjustmentTransaction = {
      id: adjustmentId,
      amount,
      account_id: accountId,
      category_id: categoryId,
      date,
      created_at: monthData.adjustments?.find(a => a.id === adjustmentId)?.created_at || new Date().toISOString(),
    }
    if (description) updatedAdjustment.description = description
    if (cleared !== undefined) updatedAdjustment.cleared = cleared

    const updatedAdjustmentsList = (monthData.adjustments || []).map(a => a.id === adjustmentId ? updatedAdjustment : a)

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      adjustments: updatedAdjustmentsList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update adjustment' })

    // Update budget's account balances
    // Reverse old effect and apply new effect
    if (!isNoAccount(oldAccountId) && oldAccountId === accountId) {
      // Same account - just apply delta
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount - oldAmount }])
    } else {
      // Different accounts
      const balanceUpdates: { accountId: string; delta: number }[] = []
      if (!isNoAccount(oldAccountId)) {
        balanceUpdates.push({ accountId: oldAccountId, delta: -oldAmount })
      }
      if (!isNoAccount(accountId)) {
        balanceUpdates.push({ accountId, delta: amount })
      }
      if (balanceUpdates.length > 0) {
        await updateBudgetAccountBalances(budgetId, balanceUpdates)
      }
    }

    return { updatedMonth }
  }

  return {
    updateAdjustment,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}


