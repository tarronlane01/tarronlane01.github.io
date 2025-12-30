/**
 * Update Budget Account Balance (utility function)
 *
 * Updates account balances in the React Query CACHE ONLY for immediate UI feedback.
 * Does NOT write to Firestore - the actual budget document is updated during recalculation.
 *
 * This avoids excessive Firestore reads/writes when adding multiple income/expense lines.
 * The budget is already marked for recalculation by the month write operation.
 *
 * This is a non-hook utility for use inside mutation functions.
 * For component use, prefer useUpdateAccountBalance hook.
 */

import { queryKeys, queryClient } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'

interface BalanceDelta {
  accountId: string
  delta: number
}

/**
 * Calculate the delta to total_available based on which account(s) changed.
 * Only on-budget and active accounts contribute to total_available.
 */
function calculateTotalAvailableDelta(
  cachedBudget: BudgetData,
  deltas: BalanceDelta[]
): number {
  let totalDelta = 0
  for (const { accountId, delta } of deltas) {
    const account = cachedBudget.accounts[accountId]
    if (!account) continue

    // Determine effective on_budget and is_active (group overrides account if set)
    const group = account.account_group_id ? cachedBudget.accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)

    // Only count delta if account is on-budget and active
    if (effectiveOnBudget && effectiveActive) {
      totalDelta += delta
    }
  }
  return totalDelta
}

/**
 * Update one or more account balances in the React Query cache.
 * Also updates the cached total_available for immediate UI updates.
 *
 * NOTE: This does NOT write to Firestore. The budget document is updated
 * during recalculation, which is triggered automatically after month changes.
 *
 * @param budgetId - The budget ID
 * @param deltas - Array of account deltas to apply
 */
export async function updateBudgetAccountBalances(
  budgetId: string,
  deltas: BalanceDelta[]
): Promise<void> {
  if (deltas.length === 0) return

  // Filter out zero deltas
  const nonZeroDeltas = deltas.filter(d => d.delta !== 0)
  if (nonZeroDeltas.length === 0) return

  // Update React Query cache only (no Firestore read/write)
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    // If no cached budget, nothing to update - recalculation will handle it
    return
  }

  // Calculate delta to total_available (only on-budget/active accounts contribute)
  const totalAvailableDelta = calculateTotalAvailableDelta(cachedBudget, nonZeroDeltas)

  // Update account balances in cache
  const updatedAccounts = { ...cachedBudget.accounts }
  for (const { accountId, delta } of nonZeroDeltas) {
    if (updatedAccounts[accountId]) {
      updatedAccounts[accountId] = {
        ...updatedAccounts[accountId],
        balance: updatedAccounts[accountId].balance + delta,
      }
    }
  }

  // Update budget.total_available in cache
  const updatedBudget = cachedBudget.budget ? {
    ...cachedBudget.budget,
    total_available: cachedBudget.budget.total_available + totalAvailableDelta,
  } : cachedBudget.budget

  queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
    ...cachedBudget,
    accounts: updatedAccounts,
    budget: updatedBudget,
  })
}


