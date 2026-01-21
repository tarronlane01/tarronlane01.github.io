/**
 * Calculate account balances from stored data and transactions.
 * 
 * Pure function that calculates income, expenses, transfers, adjustments, net_change, and end_balance
 * from transaction arrays. Used to convert stored balances to full calculated balances.
 */

import type { AccountMonthBalance, AccountMonthBalanceStored } from '@types'
import type { IncomeTransaction, ExpenseTransaction, TransferTransaction, AdjustmentTransaction } from '@types'
import { roundCurrency } from '@utils'
import { isNoAccount } from '@data/constants'

/**
 * Calculate income amount for an account from income array.
 */
function calculateIncome(
  accountId: string,
  income: IncomeTransaction[]
): number {
  return roundCurrency(
    income
      .filter(i => i.account_id === accountId)
      .reduce((sum, i) => sum + i.amount, 0)
  )
}

/**
 * Calculate expenses amount for an account from expenses array.
 */
function calculateExpenses(
  accountId: string,
  expenses: ExpenseTransaction[]
): number {
  // Note: expense.amount follows CSV convention: negative = money out, positive = money in
  return roundCurrency(
    expenses
      .filter(e => e.account_id === accountId)
      .reduce((sum, e) => sum + e.amount, 0)
  )
}

/**
 * Calculate net transfers for an account from transfers array.
 */
function calculateTransfers(
  accountId: string,
  transfers: TransferTransaction[]
): number {
  let total = 0
  for (const transfer of transfers) {
    if (transfer.from_account_id === accountId && !isNoAccount(transfer.from_account_id)) {
      total -= transfer.amount // Money going out
    }
    if (transfer.to_account_id === accountId && !isNoAccount(transfer.to_account_id)) {
      total += transfer.amount // Money coming in
    }
  }
  return roundCurrency(total)
}

/**
 * Calculate net adjustments for an account from adjustments array.
 */
function calculateAdjustments(
  accountId: string,
  adjustments: AdjustmentTransaction[]
): number {
  return roundCurrency(
    adjustments
      .filter(a => a.account_id === accountId && !isNoAccount(a.account_id))
      .reduce((sum, a) => sum + a.amount, 0)
  )
}

/**
 * Calculate full account balance from stored data and transactions.
 * 
 * @param stored - Stored balance data (start_balance)
 * @param income - Income array
 * @param expenses - Expenses array
 * @param transfers - Transfers array
 * @param adjustments - Adjustments array
 * @returns Full calculated balance
 */
export function calculateAccountBalance(
  stored: AccountMonthBalanceStored,
  income: IncomeTransaction[],
  expenses: ExpenseTransaction[],
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): AccountMonthBalance {
  const incomeAmount = calculateIncome(stored.account_id, income)
  const expensesAmount = calculateExpenses(stored.account_id, expenses)
  const transfersAmount = calculateTransfers(stored.account_id, transfers)
  const adjustmentsAmount = calculateAdjustments(stored.account_id, adjustments)
  
  const net_change = roundCurrency(
    incomeAmount + expensesAmount + transfersAmount + adjustmentsAmount
  )
  
  const end_balance = roundCurrency(stored.start_balance + net_change)

  return {
    ...stored,
    income: incomeAmount,
    expenses: expensesAmount,
    transfers: transfersAmount,
    adjustments: adjustmentsAmount,
    net_change,
    end_balance,
  }
}

/**
 * Calculate full account balances array from stored data and transactions.
 * 
 * @param storedBalances - Array of stored balances
 * @param income - Income array
 * @param expenses - Expenses array
 * @param transfers - Transfers array
 * @param adjustments - Adjustments array
 * @returns Array of full calculated balances
 */
export function calculateAccountBalances(
  storedBalances: AccountMonthBalanceStored[],
  income: IncomeTransaction[],
  expenses: ExpenseTransaction[],
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): AccountMonthBalance[] {
  return storedBalances.map(stored =>
    calculateAccountBalance(stored, income, expenses, transfers, adjustments)
  )
}
