import type { Category } from '@contexts/budget_context'
import type { CategoryMonthBalance, MonthDocument } from '@types'

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
    const startBalance = existing?.start_balance ?? 0
    const spent = existing?.spent ?? 0

    // Use live draft allocation when in draft mode, otherwise use finalized
    let allocated = 0
    if (isDraftMode) {
      allocated = getAllocationAmount(catId, cat)
    } else if (allocationsFinalized && existing) {
      allocated = existing.allocated
    }

    // end_balance = start + allocated + spent (spent is negative for money out)
    balances[catId] = {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      end_balance: startBalance + allocated + spent,
    }
  })

  return balances
}

