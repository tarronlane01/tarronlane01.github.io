/**
 * Calculate Category Balances
 *
 * Pure function to calculate category balances for a month.
 * Used when finalizing allocations.
 */

import type { MonthDocument, CategoryMonthBalance } from '@types'

/**
 * Calculate category balances for a month.
 * Uses existing start_balance values from category_balances array,
 * applies allocations (if finalized), and subtracts expenses.
 *
 * @param monthData - The month document
 * @param categoryIds - List of all category IDs to calculate for
 * @param allocations - Map of category_id to allocation amount
 * @param allocationsFinalized - Whether allocations are finalized
 * @returns Calculated category balances array
 */
export function calculateCategoryBalancesForMonth(
  monthData: MonthDocument,
  categoryIds: string[],
  allocations: Record<string, number>,
  allocationsFinalized: boolean
): CategoryMonthBalance[] {
  // Build a map of existing category balances for quick lookup
  const existingBalances: Record<string, CategoryMonthBalance> = {}
  if (monthData.category_balances) {
    monthData.category_balances.forEach(cb => {
      existingBalances[cb.category_id] = cb
    })
  }

  const expenses = monthData.expenses ?? []

  return categoryIds.map(catId => {
    // Start balance comes from existing category balance (preserves previous month's end)
    const existingBal = existingBalances[catId]
    const startBalance = existingBal?.start_balance ?? 0

    // Allocated amount (only if finalized)
    const allocated = allocationsFinalized ? (allocations[catId] ?? 0) : 0

    // Sum expenses for this category
    const spent = expenses
      .filter(e => e.category_id === catId)
      .reduce((sum, e) => sum + e.amount, 0)

    return {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      end_balance: startBalance + allocated - spent,
    }
  })
}

