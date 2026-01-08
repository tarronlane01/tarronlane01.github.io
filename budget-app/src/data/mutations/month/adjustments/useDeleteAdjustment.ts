/**
 * Delete Adjustment Hook
 *
 * Deletes an adjustment transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

export function useDeleteAdjustment() {
  const { writeData } = useWriteMonthData()

  const deleteAdjustment = async (
    budgetId: string,
    year: number,
    month: number,
    adjustmentId: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'delete adjustment')

    // Find adjustment being deleted to get amount and account
    const deletedAdjustment = (monthData.adjustments || []).find(a => a.id === adjustmentId)
    const deletedAmount = deletedAdjustment?.amount ?? 0
    const deletedAccountId = deletedAdjustment?.account_id

    const updatedAdjustmentsList = (monthData.adjustments || []).filter(a => a.id !== adjustmentId)

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      adjustments: updatedAdjustmentsList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete adjustment' })

    // Update budget's account balance - reverse the deleted adjustment's effect
    if (deletedAccountId && !isNoAccount(deletedAccountId) && deletedAmount !== 0) {
      await updateBudgetAccountBalances(budgetId, [{ accountId: deletedAccountId, delta: -deletedAmount }])
    }

    return { updatedMonth }
  }

  return {
    deleteAdjustment,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}


