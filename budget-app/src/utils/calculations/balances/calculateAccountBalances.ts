import type { FinancialAccount } from '@contexts/budget_context'
import type { AccountMonthBalance, MonthDocument } from '@types'
import { roundCurrency } from '@utils'

/**
 * Calculates account balances for a given month
 * Computes income, expenses, transfers, adjustments, and net change for each account
 */
export function calculateAccountBalances(
  currentMonth: MonthDocument | null | undefined,
  accounts: Record<string, FinancialAccount>
): Record<string, AccountMonthBalance> {
  // Build a map of existing account balances for quick lookup
  const existingBalances: Record<string, AccountMonthBalance> = {}
  if (currentMonth?.account_balances) {
    currentMonth.account_balances.forEach(ab => {
      existingBalances[ab.account_id] = ab
    })
  }

  const balances: Record<string, AccountMonthBalance> = {}
  Object.entries(accounts).forEach(([accountId, account]) => {
    const existing = existingBalances[accountId]
    // Start balance from existing or account's current balance if first month
    // Round to ensure 2 decimal precision
    const startBalance = roundCurrency(existing?.start_balance ?? account.balance)

    // Calculate income deposited to this account this month
    // Round to ensure 2 decimal precision
    let income = 0
    if (currentMonth?.income) {
      income = roundCurrency(
        currentMonth.income
          .filter(i => i.account_id === accountId)
          .reduce((sum, i) => sum + i.amount, 0)
      )
    }

    // Calculate expenses from this account this month
    // Note: expense.amount follows CSV convention: negative = money out, positive = money in
    // Round to ensure 2 decimal precision
    let expenses = 0
    if (currentMonth?.expenses) {
      expenses = roundCurrency(
        currentMonth.expenses
          .filter(e => e.account_id === accountId)
          .reduce((sum, e) => sum + e.amount, 0)
      )
    }

    // Calculate transfers for this account
    // Transfers TO this account add money (positive), transfers FROM subtract (negative)
    // Round to ensure 2 decimal precision
    let transfers = 0
    if (currentMonth?.transfers) {
      let transfersTotal = 0
      currentMonth.transfers.forEach(t => {
        if (t.to_account_id === accountId) {
          transfersTotal += t.amount // Money coming in
        }
        if (t.from_account_id === accountId) {
          transfersTotal -= t.amount // Money going out
        }
      })
      transfers = roundCurrency(transfersTotal)
    }

    // Calculate adjustments for this account
    // Adjustment amount is applied directly (positive = add, negative = subtract)
    // Round to ensure 2 decimal precision
    let adjustments = 0
    if (currentMonth?.adjustments) {
      adjustments = roundCurrency(
        currentMonth.adjustments
          .filter(a => a.account_id === accountId)
          .reduce((sum, a) => sum + a.amount, 0)
      )
    }

    // Net change = income + expenses + transfers + adjustments
    // Round to ensure 2 decimal precision
    const netChange = roundCurrency(income + expenses + transfers + adjustments)

    // Round end_balance to ensure 2 decimal precision
    balances[accountId] = {
      account_id: accountId,
      start_balance: startBalance,
      income,
      expenses,
      transfers,
      adjustments,
      net_change: netChange,
      end_balance: roundCurrency(startBalance + netChange),
    }
  })

  return balances
}

