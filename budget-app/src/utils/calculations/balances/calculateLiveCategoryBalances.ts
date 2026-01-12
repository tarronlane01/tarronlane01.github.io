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

    // Calculate transfers for this category
    // Transfers TO this category add money (positive), transfers FROM subtract (negative)
    let transfers = 0
    if (currentMonth?.transfers) {
      currentMonth.transfers.forEach(t => {
        if (t.to_category_id === catId) {
          transfers += t.amount // Money coming in
        }
        if (t.from_category_id === catId) {
          transfers -= t.amount // Money going out
        }
      })
    }

    // Calculate adjustments for this category
    // Adjustment amount is applied directly (positive = add, negative = subtract)
    let adjustments = 0
    if (currentMonth?.adjustments) {
      adjustments = currentMonth.adjustments
        .filter(a => a.category_id === catId)
        .reduce((sum, a) => sum + a.amount, 0)
    }

    // end_balance = start + allocated + spent + transfers + adjustments
    balances[catId] = {
      category_id: catId,
      start_balance: startBalance,
      allocated,
      spent,
      transfers,
      adjustments,
      end_balance: startBalance + allocated + spent + transfers + adjustments,
    }
  })

  return balances
}

