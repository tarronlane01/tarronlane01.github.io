/**
 * Delete Income Hook
 *
 * Deletes an income transaction from the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { readMonthForEdit } from '@data'
import type { MonthDocument } from '@types'
import { useWriteMonthData } from '..'

export function useDeleteIncome() {
  const { writeData } = useWriteMonthData()

  const deleteIncome = async (
    budgetId: string,
    year: number,
    month: number,
    incomeId: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'delete income')

    const updatedIncomeList = (monthData.income || []).filter(inc => inc.id !== incomeId)

    const updatedMonth: MonthDocument = {
      ...monthData,
      income: updatedIncomeList,
      total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'delete income' })

    return { updatedMonth }
  }

  return {
    deleteIncome,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

