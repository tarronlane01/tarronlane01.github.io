/**
 * Shared utilities for calculating category transaction amounts.
 * These functions are used across multiple calculation modules to ensure consistency.
 */

import type { ExpenseTransaction, TransferTransaction, AdjustmentTransaction } from '@types'
import { roundCurrency } from '@utils'
import { isNoCategory } from '@data/constants'

/**
 * Calculate spent amount for a category from expenses array.
 * 
 * @param categoryId - The category ID
 * @param expenses - Array of expense transactions
 * @returns Total spent amount (rounded to 2 decimal places)
 */
export function calculateCategorySpent(
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
 * Transfers TO the category add money, transfers FROM subtract money.
 * 
 * @param categoryId - The category ID
 * @param transfers - Array of transfer transactions
 * @returns Net transfer amount (rounded to 2 decimal places)
 */
export function calculateCategoryTransfers(
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
 * 
 * @param categoryId - The category ID
 * @param adjustments - Array of adjustment transactions
 * @returns Net adjustment amount (rounded to 2 decimal places)
 */
export function calculateCategoryAdjustments(
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
 * Calculate spent, transfers, and adjustments maps for all categories.
 * This is more efficient when calculating for multiple categories at once.
 * 
 * @param expenses - Array of expense transactions
 * @param transfers - Array of transfer transactions
 * @param adjustments - Array of adjustment transactions
 * @returns Maps of category_id -> amount for spent, transfers, and adjustments
 */
export function calculateCategoryTransactionMaps(
  expenses: ExpenseTransaction[],
  transfers: TransferTransaction[],
  adjustments: AdjustmentTransaction[]
): {
  spentMap: Record<string, number>
  transfersMap: Record<string, number>
  adjustmentsMap: Record<string, number>
} {
  const spentMap: Record<string, number> = {}
  const transfersMap: Record<string, number> = {}
  const adjustmentsMap: Record<string, number> = {}

  // Calculate spent per category from expenses
  for (const expense of expenses) {
    if (isNoCategory(expense.category_id)) continue
    spentMap[expense.category_id] = (spentMap[expense.category_id] || 0) + expense.amount
  }

  // Calculate transfers per category
  for (const transfer of transfers) {
    if (!isNoCategory(transfer.from_category_id)) {
      transfersMap[transfer.from_category_id] = (transfersMap[transfer.from_category_id] || 0) - transfer.amount
    }
    if (!isNoCategory(transfer.to_category_id)) {
      transfersMap[transfer.to_category_id] = (transfersMap[transfer.to_category_id] || 0) + transfer.amount
    }
  }

  // Calculate adjustments per category
  for (const adjustment of adjustments) {
    if (!isNoCategory(adjustment.category_id)) {
      adjustmentsMap[adjustment.category_id] = (adjustmentsMap[adjustment.category_id] || 0) + adjustment.amount
    }
  }

  // Round all values
  for (const catId of Object.keys(spentMap)) {
    spentMap[catId] = roundCurrency(spentMap[catId])
  }
  for (const catId of Object.keys(transfersMap)) {
    transfersMap[catId] = roundCurrency(transfersMap[catId])
  }
  for (const catId of Object.keys(adjustmentsMap)) {
    adjustmentsMap[catId] = roundCurrency(adjustmentsMap[catId])
  }

  return { spentMap, transfersMap, adjustmentsMap }
}
