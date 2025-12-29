/**
 * Update Income Hook
 *
 * Updates an existing income transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, readMonthForEdit } from '@data'
import type { MonthDocument, IncomeTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'

export function useUpdateIncome() {
  const queryClient = useQueryClient()
  const { writeData } = useWriteMonthData()

  const updateIncome = async (
    budgetId: string,
    year: number,
    month: number,
    incomeId: string,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    const monthData = await readMonthForEdit(budgetId, year, month, 'update income')

    const updatedIncome: IncomeTransaction = {
      id: incomeId,
      amount,
      account_id: accountId,
      date,
      created_at: (monthData.income || []).find(i => i.id === incomeId)?.created_at || new Date().toISOString(),
    }
    if (payee?.trim()) updatedIncome.payee = payee.trim()
    if (description) updatedIncome.description = description

    const updatedIncomeList = (monthData.income || []).map(inc => inc.id === incomeId ? updatedIncome : inc)

    const updatedMonth: MonthDocument = {
      ...monthData,
      income: updatedIncomeList,
      total_income: updatedIncomeList.reduce((sum, inc) => sum + inc.amount, 0),
      updated_at: new Date().toISOString(),
    }

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update income' })

    // Save payee if new
    if (payee?.trim()) {
      const cachedPayees = queryClient.getQueryData<string[]>(queryKeys.payees(budgetId)) || []
      const updatedPayees = await savePayeeIfNew(budgetId, payee, cachedPayees)
      if (updatedPayees) {
        queryClient.setQueryData<string[]>(queryKeys.payees(budgetId), updatedPayees)
      }
    }

    return { updatedMonth }
  }

  return {
    updateIncome,
    isPending: writeData.isPending,
    isError: writeData.isError,
    error: writeData.error,
  }
}

