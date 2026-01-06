/**
 * Add Adjustment Hook
 *
 * Adds a new adjustment transaction to the month.
 * Adjustments are one-sided corrections that can affect account and/or category balances.
 * Allows NO_ACCOUNT_ID or NO_CATEGORY_ID for adjustments that don't affect one side.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument, AdjustmentTransaction } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'
import { isNoAccount } from '../../../constants'

export function useAddAdjustment() {
  const { writeData } = useWriteMonthData()

  const addAdjustment = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'add adjustment')

    const newAdjustment: AdjustmentTransaction = {
      id: `adjustment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      account_id: accountId,
      category_id: categoryId,
      date,
      created_at: new Date().toISOString(),
    }
    if (description) newAdjustment.description = description
    if (cleared !== undefined) newAdjustment.cleared = cleared

    const updatedAdjustments = [...(monthData.adjustments || []), newAdjustment]

    // Re-total to update all derived values
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      adjustments: updatedAdjustments,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'add adjustment' })

    // Update budget's account balance for real accounts
    if (!isNoAccount(accountId)) {
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount }])
    }

    return { updatedMonth, newAdjustment }
  }

  return {
    addAdjustment,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

