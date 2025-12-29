/**
 * Add Income Hook
 *
 * Adds a new income transaction to the month.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, readMonthForEdit } from '@data'
import type { MonthDocument, IncomeTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'

export function useAddIncome() {
  const queryClient = useQueryClient()
  const { writeData } = useWriteMonthData()

  const addIncome = async (
    budgetId: string,
    year: number,
    month: number,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'add income')

    const newIncome: IncomeTransaction = {
      id: `income_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount,
      account_id: accountId,
      date,
      created_at: new Date().toISOString(),
    }
    if (payee?.trim()) newIncome.payee = payee.trim()
    if (description) newIncome.description = description

    const updatedIncome = [...(monthData.income || []), newIncome]

    const updatedMonth: MonthDocument = {
      ...monthData,
      income: updatedIncome,
      total_income: updatedIncome.reduce((sum, inc) => sum + inc.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'add income' })

    // Save payee if new
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
      }
    }

    return { updatedMonth, newIncome }
  }

  return {
    addIncome,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

