/**
 * Calculate category balances from stored data and transactions.
 * 
 * Pure function that calculates spent, transfers, adjustments, and end_balance
 * from transaction arrays. Used to convert stored balances to full calculated balances.
 */

import type { CategoryMonthBalance, CategoryMonthBalanceStored } from '@types'
import type { ExpenseTransaction, TransferTransaction, AdjustmentTransaction } from '@types'
import { roundCurrency } from '@utils'
import {
  calculateCategorySpent,
  calculateCategoryTransfers,
  calculateCategoryAdjustments,
} from './calculateCategoryTransactionAmounts'

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
  const spent = calculateCategorySpent(stored.category_id, expenses)
  const transfersAmount = calculateCategoryTransfers(stored.category_id, transfers)
  const adjustmentsAmount = calculateCategoryAdjustments(stored.category_id, adjustments)
  
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
