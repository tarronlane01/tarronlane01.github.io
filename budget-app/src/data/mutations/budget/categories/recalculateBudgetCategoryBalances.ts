/**
 * Recalculate Budget Category Balances from Cache
 *
 * Recalculates category balances in the budget by walking through all months
 * in the cache. This ensures accuracy even if some local recalculations failed.
 *
 * IMPORTANT: Only finalized months are used. Unfinalized (draft) allocations—
 * including saved drafts—must never affect budget category balances or Avail.
 * We use the latest finalized month's end_balance as the base, not the current
 * calendar month's end_balance when that month is unfinalized.
 *
 * This function:
 * 1. Gets all months from cache
 * 2. Uses only finalized month data for base balances (Step 1) and future months (Step 2)
 * 3. Updates the budget cache with new category balances
 */

import { queryKeys, queryClient } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { MonthQueryData } from '@data/queries/month'
import { getYearMonthOrdinal, getNextMonth, roundCurrency } from '@utils'
import { MAX_FUTURE_MONTHS } from '@constants'

/**
 * Parse ordinal string to year/month
 */
function parseOrdinal(ordinal: string): { year: number; month: number } {
  return {
    year: parseInt(ordinal.substring(0, 4), 10),
    month: parseInt(ordinal.substring(4, 6), 10),
  }
}

/**
 * Recalculate budget category balances from all months in cache and update the cache.
 * This reads directly from the React Query cache (not Firestore) to ensure we use
 * the freshly recalculated month data.
 * 
 * Assumes all required months are already in cache and fresh.
 */
export async function recalculateBudgetCategoryBalancesFromCache(
  budgetId: string
): Promise<void> {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    console.warn('[recalculateBudgetCategoryBalancesFromCache] Budget not in cache')
    return
  }

  const categoryIds = Object.keys(cachedBudget.categories)
  if (categoryIds.length === 0) {
    return // No categories to calculate
  }

  // Use actual current month (today) for balance calculations
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonth)

  // Get monthMap to find all months
  const monthMap = cachedBudget.monthMap || {}

  // Initialize balances
  const balances: Record<string, number> = {}
  categoryIds.forEach(id => { balances[id] = 0 })

  const sortedOrdinals = Object.keys(monthMap).sort()

  let baseOrdinalUsed: string | null = null
  const futureMonthsAddedAllocationsFrom: string[] = []

  // Step 1: Find end_balance from cache for Avail/All-Time. We must use ONLY finalized months
  // so that saved-draft (unfinalized) allocations never affect Avail or budget category balances.
  const currentMonthKey = queryKeys.month(budgetId, currentYear, currentMonth)
  const currentMonthData = queryClient.getQueryData<MonthQueryData>(currentMonthKey)
  const currentMonthFinalized = currentMonthData?.month?.are_allocations_finalized === true

  if (currentMonthFinalized && currentMonthData?.month?.category_balances) {
    baseOrdinalUsed = currentOrdinal
    // Current month is finalized - use its end_balance
    for (const cb of currentMonthData.month.category_balances) {
      if (categoryIds.includes(cb.category_id)) {
        balances[cb.category_id] = cb.end_balance ?? 0
      }
    }
  } else {
    // Current month unfinalized or missing - use latest finalized month's end_balance
    let foundStart = false
    for (let i = sortedOrdinals.length - 1; i >= 0 && !foundStart; i--) {
      const ordinal = sortedOrdinals[i]
      if (ordinal > currentOrdinal) continue // Skip future months

      const { year, month } = parseOrdinal(ordinal)
      const monthKey = queryKeys.month(budgetId, year, month)
      const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)
      const m = monthData?.month

      if (m?.are_allocations_finalized && m.category_balances) {
        foundStart = true
        baseOrdinalUsed = ordinal
        for (const cb of m.category_balances) {
          if (categoryIds.includes(cb.category_id)) {
            balances[cb.category_id] = cb.end_balance ?? 0
          }
        }
      }
    }
    
    // If still no starting point, compute forward from earliest month
    if (!foundStart && sortedOrdinals.length > 0) {
      // Start from zero and compute forward through all months up to current
      for (const ordinal of sortedOrdinals) {
        if (ordinal > currentOrdinal) break
        
        const { year, month } = parseOrdinal(ordinal)
        const monthKey = queryKeys.month(budgetId, year, month)
        const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)
        
        if (monthData?.month) {
          const m = monthData.month
          // Add allocations if finalized
          if (m.are_allocations_finalized && m.category_balances) {
            for (const cb of m.category_balances) {
              if (categoryIds.includes(cb.category_id)) {
                balances[cb.category_id] = (balances[cb.category_id] || 0) + (cb.allocated || 0)
              }
            }
          }
          // Subtract expenses
          if (m.expenses) {
            for (const exp of m.expenses) {
              if (categoryIds.includes(exp.category_id)) {
                balances[exp.category_id] = (balances[exp.category_id] || 0) - exp.amount
              }
            }
          }
          // Add adjustments (adjustments are already in category_balances.end_balance for recalculated months,
          // but we need to include them when computing forward from earliest month)
          if (m.adjustments) {
            for (const adj of m.adjustments) {
              if (adj.category_id && categoryIds.includes(adj.category_id)) {
                balances[adj.category_id] = (balances[adj.category_id] || 0) + adj.amount
              }
            }
          }
          // Add transfers (transfers TO category add, transfers FROM category subtract)
          if (m.transfers) {
            for (const transfer of m.transfers) {
              if (transfer.to_category_id && categoryIds.includes(transfer.to_category_id)) {
                balances[transfer.to_category_id] = (balances[transfer.to_category_id] || 0) + transfer.amount
              }
              if (transfer.from_category_id && categoryIds.includes(transfer.from_category_id)) {
                balances[transfer.from_category_id] = (balances[transfer.from_category_id] || 0) - transfer.amount
              }
            }
          }
        }
      }
    }
  }

  // Step 2: Walk forward through future months to calculate total balances
  const maxFutureOrdinal = getYearMonthOrdinal(
    currentYear + Math.floor((currentMonth + MAX_FUTURE_MONTHS - 1) / 12),
    ((currentMonth + MAX_FUTURE_MONTHS - 1) % 12) + 1
  )

  let walkYear = currentYear
  let walkMonth = currentMonth
  for (let i = 0; i < MAX_FUTURE_MONTHS * 2; i++) {
    const next = getNextMonth(walkYear, walkMonth)
    walkYear = next.year
    walkMonth = next.month
    const monthOrdinal = getYearMonthOrdinal(walkYear, walkMonth)

    if (monthOrdinal > maxFutureOrdinal || !(monthOrdinal in monthMap)) {
      break
    }

    const monthKey = queryKeys.month(budgetId, walkYear, walkMonth)
    const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)

    if (!monthData?.month) {
      break // Month not in cache
    }

    const m = monthData.month

    // Add allocations if finalized
    if (m.are_allocations_finalized && m.category_balances) {
      futureMonthsAddedAllocationsFrom.push(monthOrdinal)
      for (const cb of m.category_balances) {
        if (categoryIds.includes(cb.category_id)) {
          balances[cb.category_id] = (balances[cb.category_id] || 0) + (cb.allocated || 0)
        }
      }
    }

    // Subtract expenses
    if (m.expenses) {
      for (const exp of m.expenses) {
        if (categoryIds.includes(exp.category_id)) {
          balances[exp.category_id] = (balances[exp.category_id] || 0) - exp.amount
        }
      }
    }
  }

  // Round all balances
  const totalBalances: Record<string, number> = {}
  for (const catId of categoryIds) {
    totalBalances[catId] = roundCurrency(balances[catId] || 0)
  }

  // Update categories in cache with new total balances
  const updatedCategories: BudgetData['categories'] = {}
  for (const [categoryId, category] of Object.entries(cachedBudget.categories)) {
    updatedCategories[categoryId] = {
      ...category,
      balance: roundCurrency(totalBalances[categoryId] ?? category.balance),
    }
  }

  // Update budget cache with new category balances (don't save total_available - it's calculated on-the-fly)
  // This is the source of truth - useCategoryBalances reads directly from this cache.
  queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
    ...cachedBudget,
    categories: updatedCategories,
    budget: {
      ...cachedBudget.budget,
      categories: updatedCategories,
      // Don't save total_available - it's calculated on-the-fly
    },
  })

  lastBaseOrdinalUsed = baseOrdinalUsed
  lastFutureMonthsAdded = [...futureMonthsAddedAllocationsFrom]

  // Note: We don't save budget-level category balances to Firestore here.
  // Budget-level category.balance fields are also calculated/derived and should
  // be calculated on-the-fly, not stored. Only start_balance for months at/before
  // window should be saved to Firestore.
}

/** Last base month ordinal used by recalculateBudgetCategoryBalancesFromCache (for debug breakdown). */
let lastBaseOrdinalUsed: string | null = null
/** Last future months we added allocations from (for debug breakdown). */
let lastFutureMonthsAdded: string[] = []

/**
 * Return the base month and future months used in the last recalc (for debug).
 * Only set when recalculateBudgetCategoryBalancesFromCache runs.
 */
export function getLastRecalcBaseMonthForDebug(): { baseOrdinal: string | null; futureMonthsAdded: string[] } {
  return { baseOrdinal: lastBaseOrdinalUsed, futureMonthsAdded: lastFutureMonthsAdded }
}

/**
 * Return the distinct list of month ordinals (YYYYMM) whose category balances
 * are rolled up into the budget category balances (and thus into the all-time total).
 * Used for debugging: call from the categories page to see which months contribute.
 */
export function getMonthsContributingToBudgetCategoryBalances(budgetId: string): string[] {
  const contributing: string[] = []
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget || Object.keys(cachedBudget.categories).length === 0) return contributing

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentOrdinal = getYearMonthOrdinal(currentYear, currentMonth)
  const monthMap = cachedBudget.monthMap || {}
  const sortedOrdinals = Object.keys(monthMap).sort()

  const currentMonthData = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, currentYear, currentMonth))
  const currentMonthFinalized = currentMonthData?.month?.are_allocations_finalized === true

  let baseOrdinal: string
  if (currentMonthFinalized && currentMonthData?.month?.category_balances) {
    baseOrdinal = currentOrdinal
  } else {
    let found = false
    for (let i = sortedOrdinals.length - 1; i >= 0 && !found; i--) {
      const ordinal = sortedOrdinals[i]
      if (ordinal > currentOrdinal) continue
      const { year, month } = parseOrdinal(ordinal)
      const monthData = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month))
      const m = monthData?.month
      if (m?.are_allocations_finalized && m.category_balances) {
        baseOrdinal = ordinal
        found = true
      }
    }
    if (!found) return contributing
  }
  contributing.push(baseOrdinal!)

  const maxFutureOrdinal = getYearMonthOrdinal(
    currentYear + Math.floor((currentMonth + MAX_FUTURE_MONTHS - 1) / 12),
    ((currentMonth + MAX_FUTURE_MONTHS - 1) % 12) + 1
  )
  let walkYear = currentYear
  let walkMonth = currentMonth
  for (let i = 0; i < MAX_FUTURE_MONTHS * 2; i++) {
    const next = getNextMonth(walkYear, walkMonth)
    walkYear = next.year
    walkMonth = next.month
    const monthOrdinal = getYearMonthOrdinal(walkYear, walkMonth)
    if (monthOrdinal > maxFutureOrdinal || !(monthOrdinal in monthMap)) break
    const monthData = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, walkYear, walkMonth))
    if (!monthData?.month) break
    // Only include months we actually add allocations from (finalized); unfinalized months don't contribute
    if (monthData.month.are_allocations_finalized && monthData.month.category_balances) {
      contributing.push(monthOrdinal)
    }
  }

  return [...new Set(contributing)].sort()
}
