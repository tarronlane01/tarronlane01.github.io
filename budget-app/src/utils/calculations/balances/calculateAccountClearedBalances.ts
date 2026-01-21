import type { FinancialAccount } from '@contexts/budget_context'
import type { AccountMonthBalance, MonthDocument } from '@types'
import { roundCurrency } from '@utils'

/**
 * Account balance breakdown showing cleared and uncleared amounts
 */
export interface AccountClearedBalance {
  account_id: string
  cleared_balance: number  // Balance including only cleared transactions
  uncleared_balance: number // Balance including all transactions (cleared + uncleared)
}

/**
 * Calculates account balances broken down by cleared/uncleared status
 * Cleared balance = only transactions where cleared === true
 * Uncleared balance = all transactions (cleared + uncleared)
 */
export function calculateAccountClearedBalances(
  currentMonth: MonthDocument | null | undefined,
  accounts: Record<string, FinancialAccount>
): Record<string, AccountClearedBalance> {
  const balances: Record<string, AccountClearedBalance> = {}

  const existingBalances: Record<string, AccountMonthBalance> = {}
  if (currentMonth?.account_balances) {
    currentMonth.account_balances.forEach(ab => {
      existingBalances[ab.account_id] = ab
    })
  }

  // If no current month, return empty balances
  if (!currentMonth) {
    Object.entries(accounts).forEach(([accountId, account]) => {
      const balance = roundCurrency(account.balance ?? 0)
      balances[accountId] = {
        account_id: accountId,
        cleared_balance: balance,
        uncleared_balance: balance,
      }
    })
    return balances
  }

  Object.entries(accounts).forEach(([accountId, account]) => {
    const existing = existingBalances[accountId]
    // Start balance from existing or account's current balance if first month
    // Round to ensure 2 decimal precision
    const startBalance = roundCurrency(existing?.start_balance ?? account.balance)

    // Calculate cleared and uncleared income
    let clearedIncome = 0
    let unclearedIncome = 0
    if (currentMonth?.income) {
      currentMonth.income
        .filter(i => i.account_id === accountId)
        .forEach(i => {
          // Income is always included (no cleared field for income)
          unclearedIncome += i.amount
          clearedIncome += i.amount
        })
    }

    // Calculate cleared and uncleared expenses
    // Note: expense.amount follows CSV convention: negative = money out, positive = money in
    let clearedExpenses = 0
    let unclearedExpenses = 0
    if (currentMonth?.expenses) {
      currentMonth.expenses
        .filter(e => e.account_id === accountId)
        .forEach(e => {
          unclearedExpenses += e.amount // All expenses
          if (e.cleared === true) {
            clearedExpenses += e.amount // Only cleared expenses
          }
        })
    }

    // Calculate cleared and uncleared transfers
    let clearedTransfers = 0
    let unclearedTransfers = 0
    if (currentMonth?.transfers) {
      currentMonth.transfers.forEach(t => {
        if (t.to_account_id === accountId) {
          unclearedTransfers += t.amount // Money coming in
          if (t.cleared === true) {
            clearedTransfers += t.amount
          }
        }
        if (t.from_account_id === accountId) {
          unclearedTransfers -= t.amount // Money going out
          if (t.cleared === true) {
            clearedTransfers -= t.amount
          }
        }
      })
    }

    // Calculate cleared and uncleared adjustments
    let clearedAdjustments = 0
    let unclearedAdjustments = 0
    if (currentMonth?.adjustments) {
      currentMonth.adjustments
        .filter(a => a.account_id === accountId)
        .forEach(a => {
          unclearedAdjustments += a.amount // All adjustments
          if (a.cleared === true) {
            clearedAdjustments += a.amount // Only cleared adjustments
          }
        })
    }

    // Calculate balances - round all values to ensure 2 decimal precision
    const clearedNetChange = roundCurrency(clearedIncome + clearedExpenses + clearedTransfers + clearedAdjustments)
    const unclearedNetChange = roundCurrency(unclearedIncome + unclearedExpenses + unclearedTransfers + unclearedAdjustments)

    balances[accountId] = {
      account_id: accountId,
      cleared_balance: roundCurrency(startBalance + clearedNetChange),
      uncleared_balance: roundCurrency(startBalance + unclearedNetChange),
    }
  })

  return balances
}

