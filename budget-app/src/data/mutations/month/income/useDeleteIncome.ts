/**
 * Delete Income Hook
 *
 * Deletes an income transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

export function useDeleteIncome() {
  const { writeData } = useWriteMonthData()

  const deleteIncome = async (
    budgetId: string,
    year: number,
    month: number,
    incomeId: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'delete income')

    // Find income being deleted to get amount and account
    const deletedIncome = (monthData.income || []).find(inc => inc.id === incomeId)
    const deletedAmount = deletedIncome?.amount ?? 0
    const deletedAccountId = deletedIncome?.account_id

    const updatedIncomeList = (monthData.income || []).filter(inc => inc.id !== incomeId)

    // Re-total to update all derived values (totals, account_balances, etc.)
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      income: updatedIncomeList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete income' })

    // Update budget's account balance (income deletion decreases balance)
    if (deletedAccountId && deletedAmount > 0) {
      await updateBudgetAccountBalances(budgetId, [{ accountId: deletedAccountId, delta: -deletedAmount }])
    }

    return { updatedMonth }
  }

  return {
    deleteIncome,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

