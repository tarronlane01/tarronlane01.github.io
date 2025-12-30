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
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

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

    // Find old income to calculate delta
    const oldIncome = (monthData.income || []).find(i => i.id === incomeId)
    const oldAmount = oldIncome?.amount ?? 0
    const oldAccountId = oldIncome?.account_id ?? accountId

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

    // Re-total to update all derived values (totals, account_balances, etc.)
    const updatedMonth: MonthDocument = retotalMonth({
      ...monthData,
      income: updatedIncomeList,
      updated_at: new Date().toISOString(),
    })

    await writeData.mutateAsync({ budgetId, month: updatedMonth, description: 'update income' })

    // Update budget's account balance
    // If account changed: remove from old, add to new
    // If same account: apply delta
    if (oldAccountId === accountId) {
      await updateBudgetAccountBalances(budgetId, [{ accountId, delta: amount - oldAmount }])
    } else {
      await updateBudgetAccountBalances(budgetId, [
        { accountId: oldAccountId, delta: -oldAmount },
        { accountId, delta: amount },
      ])
    }

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

