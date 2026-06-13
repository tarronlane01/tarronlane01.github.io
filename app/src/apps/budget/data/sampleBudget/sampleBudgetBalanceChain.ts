/**
 * Chain start_balance/end_balance across generated sample months.
 */

import { roundCurrency } from '@utils'
import { SAMPLE_ACCOUNTS } from './sampleBudgetDefinition'
import type { GeneratedMonth } from './generateSampleBudget'

/**
 * Chain balances across months: each month's start_balance = previous month's end_balance.
 * First month uses initial balances from account definitions.
 */
export function chainSampleBudgetBalances(rawMonths: GeneratedMonth[]): GeneratedMonth[] {
  const categoryEndBalances: Record<string, number> = {}
  const accountEndBalances: Record<string, number> = {}
  for (const [accountId, account] of Object.entries(SAMPLE_ACCOUNTS)) {
    accountEndBalances[accountId] = account.initialBalance
  }

  let isFirstMonth = true
  return rawMonths.map((m) => {
    const updatedCategoryBalances = m.data.category_balances.map((cb) => {
      const startBalance = categoryEndBalances[cb.category_id] || 0
      const endBalance = roundCurrency(
        startBalance + cb.allocated + cb.spent + cb.transfers + cb.adjustments
      )
      categoryEndBalances[cb.category_id] = endBalance
      return { ...cb, start_balance: startBalance, end_balance: endBalance }
    })

    const updatedAccountBalances = m.data.account_balances.map((ab) => {
      const startBalance = isFirstMonth
        ? (SAMPLE_ACCOUNTS[ab.account_id]?.initialBalance || 0)
        : (accountEndBalances[ab.account_id] || 0)
      const endBalance = roundCurrency(startBalance + ab.net_change)
      accountEndBalances[ab.account_id] = endBalance
      return { ...ab, start_balance: startBalance, end_balance: endBalance }
    })

    isFirstMonth = false
    return {
      ...m,
      data: {
        ...m.data,
        category_balances: updatedCategoryBalances,
        account_balances: updatedAccountBalances,
      },
    }
  })
}
