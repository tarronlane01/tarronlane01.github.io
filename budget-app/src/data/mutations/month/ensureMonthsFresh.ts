/**
 * Ensure Months Fresh and Recalculate Balances
 *
 * Single recalc: chain months at or before "today" (one cache write per month),
 * add future months for budget category all-time, write budget once. No refetching.
 */

import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { recalculateAllBalancesFromCache } from '@data/recalculation'

/**
 * Run the single balance recalc (chain months, write each month once, write budget once).
 * Does not refetch months; uses whatever is already in cache.
 *
 * @param budgetId - The budget ID
 * @param onLoadingChange - Optional callback (unused; kept for API compatibility)
 * @param alwaysRecalculate - If true, run recalc. If false (e.g. settings nav), skip.
 */
export async function ensureMonthsFreshAndRecalculateBalances(
  budgetId: string,
  _onLoadingChange?: (isLoading: boolean, message: string) => void,
  alwaysRecalculate: boolean = true
): Promise<void> {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    console.warn('[ensureMonthsFreshAndRecalculateBalances] Budget not in cache')
    return
  }

  if (!alwaysRecalculate) {
    return
  }

  await recalculateAllBalancesFromCache(budgetId)
}
