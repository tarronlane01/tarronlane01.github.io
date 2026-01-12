/**
 * Update Income Hook
 *
 * Updates an existing income transaction.
 * Uses writeMonthData which handles optimistic updates and marks budget for recalculation.
 * Includes no-op detection to avoid unnecessary Firestore writes.
 */

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@data'
import { readMonth } from '@data/queries/month'
import type { MonthDocument, IncomeTransaction } from '@types'
import { savePayeeIfNew } from '../../payees'
import { useWriteMonthData } from '..'
import { retotalMonth } from '../retotalMonth'
import { updateBudgetAccountBalances } from '../../budget/accounts/updateBudgetAccountBalance'

/**
 * Check if income values have actually changed (no-op detection)
 */
function hasIncomeChanges(
  oldIncome: IncomeTransaction | undefined,
  amount: number,
  accountId: string,
  date: string,
  payee?: string,
  description?: string
): boolean {
  if (!oldIncome) return true // New income, always save

  // Normalize payee/description for comparison (undefined vs empty string)
  const oldPayee = oldIncome.payee || undefined
  const newPayee = payee?.trim() || undefined
  const oldDescription = oldIncome.description || undefined
  const newDescription = description || undefined

  return (
    amount !== oldIncome.amount ||
    accountId !== oldIncome.account_id ||
    date !== oldIncome.date ||
    newPayee !== oldPayee ||
    newDescription !== oldDescription
  )
}

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
    // Read month data (uses cache if fresh, fetches if stale via React Query's fetchQuery)
    const monthData = await readMonth(budgetId, year, month)
    if (!monthData) throw new Error(`Month not found: ${year}/${month}`)

    // Find old income to calculate delta and check for changes
    const oldIncome = (monthData.income || []).find(i => i.id === incomeId)

    // No-op detection: skip write if nothing changed
    if (!hasIncomeChanges(oldIncome, amount, accountId, date, payee, description)) {
      return { updatedMonth: monthData, noOp: true }
    }

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
