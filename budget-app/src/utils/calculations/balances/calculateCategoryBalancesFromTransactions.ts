/**
 * Calculate category balances from stored data and transactions.
 * 
 * Pure function that calculates spent, transfers, adjustments, and end_balance
 * from transaction arrays. Used to convert stored balances to full calculated balances.
 */

import type { CategoryMonthBalance, CategoryMonthBalanceStored } from '@types'
import type { ExpenseTransaction, TransferTransaction, AdjustmentTransaction } from '@types'
import { roundCurrency } from '@utils'
import { isNoCategory } from '@data/constants'

/**
 * Calculate spent amount for a category from expenses array.
 */
function calculateSpent(
  categoryId: string,
  expenses: ExpenseTransaction[]
): number {
  return roundCurrency(
    expenses
      .filter(e => e.category_id === categoryId)
      .reduce((sum, e) => sum + e.amount, 0)
  )
}

/**
 * Calculate net transfers for a category from transfers array.
 */
function calculateTransfers(
  categoryId: string,
  transfers: TransferTransaction[]
): number {
  let total = 0
  for (const transfer of transfers) {
    if (transfer.from_category_id === categoryId && !isNoCategory(transfer.from_category_id)) {
      total -= transfer.amount // Money going out
    }
    if (transfer.to_category_id === categoryId && !isNoCategory(transfer.to_category_id)) {
      total += transfer.amount // Money coming in
    }
  }
  return roundCurrency(total)
}

/**
 * Calculate net adjustments for a category from adjustments array.
 */
function calculateAdjustments(
  categoryId: string,
  adjustments: AdjustmentTransaction[]
): number {
  return roundCurrency(
    adjustments
      .filter(a => a.category_id === categoryId && !isNoCategory(a.category_id))
      .reduce((sum, a) => sum + a.amount, 0)
  )
}

/**
 * Calculate full category balance from stored data and transactions.
 * 
 * @param stored - Stored balance data (start_balance, allocated)
 * @param expenses - Expenses array
 * @param transfers - Transfers array
 * @param adjustments - Adjustments array
 * @returns Full calculated balance
 */
export function calculateCategoryBalance(
  stored: CategoryMonthBalanceStored,
  expenses: ExpenseTransaction[],
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): CategoryMonthBalance {
  const spent = calculateSpent(stored.category_id, expenses)
  const transfersAmount = calculateTransfers(stored.category_id, transfers)
  const adjustmentsAmount = calculateAdjustments(stored.category_id, adjustments)
  
  const end_balance = roundCurrency(
    stored.start_balance + stored.allocated + spent + transfersAmount + adjustmentsAmount
  )

  return {
    ...stored,
    spent,
    transfers: transfersAmount,
    adjustments: adjustmentsAmount,
    end_balance,
  }
}

/**
 * Calculate full category balances array from stored data and transactions.
 * 
 * @param storedBalances - Array of stored balances
 * @param expenses - Expenses array
 * @param transfers - Transfers array
 * @param adjustments - Adjustments array
 * @returns Array of full calculated balances
 */
export function calculateCategoryBalances(
  storedBalances: CategoryMonthBalanceStored[],
  expenses: ExpenseTransaction[],
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): CategoryMonthBalance[] {
  return storedBalances.map(stored =>
    calculateCategoryBalance(stored, expenses, transfers, adjustments)
  )
}
