import type { Category } from '@contexts/budget_context'
import type { CategoryMonthBalance, MonthDocument } from '@types'
import { roundCurrency } from '@utils'
import {
  calculateCategorySpent,
  calculateCategoryTransfers,
  calculateCategoryAdjustments,
} from './calculateCategoryTransactionAmounts'

/**
 * Calculates live category balances that update as allocations change
 * In draft mode, uses the getAllocationAmount function for live values
 * When finalized, uses the stored allocation values
 */
export function calculateLiveCategoryBalances(
  currentMonth: MonthDocument | null | undefined,
  categories: Record<string, Category>,
  isDraftMode: boolean,
  allocationsFinalized: boolean,
  getAllocationAmount: (catId: string, cat: Category) => number
): Record<string, CategoryMonthBalance> {
  // Build a map of existing category balances for quick lookup
  const existingBalances: Record<string, CategoryMonthBalance> = {}
  if (currentMonth?.category_balances) {
    currentMonth.category_balances.forEach(cb => {
      existingBalances[cb.category_id] = cb
    })
  }

  const balances: Record<string, CategoryMonthBalance> = {}
  Object.entries(categories).forEach(([catId, cat]) => {
    const existing = existingBalances[catId]
    // Round start_balance to ensure 2 decimal precision
    const startBalance = roundCurrency(existing?.start_balance ?? 0)

    // Use live draft allocation when in draft mode, otherwise use finalized
    // Round allocated to ensure 2 decimal precision
    let allocated = 0
    if (isDraftMode) {
      allocated = roundCurrency(getAllocationAmount(catId, cat))
    } else if (allocationsFinalized && existing) {
      allocated = roundCurrency(existing.allocated)
    }

    // Calculate spent, transfers, and adjustments using shared utilities (already rounded)
    const spent = calculateCategorySpent(catId, currentMonth?.expenses || [])
    const transfers = calculateCategoryTransfers(catId, currentMonth?.transfers || [])
    const adjustments = calculateCategoryAdjustments(catId, currentMonth?.adjustments || [])

    // end_balance = start + allocated + spent + transfers + adjustments
    // Round final end_balance to ensure 2 decimal precision
    balances[catId] = {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      transfers,
      adjustments,
      end_balance: roundCurrency(startBalance + allocated + spent + transfers + adjustments),
    }
  })

  return balances
}

