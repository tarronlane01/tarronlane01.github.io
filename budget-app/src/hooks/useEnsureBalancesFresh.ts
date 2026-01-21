/**
 * Hook to ensure months are fresh in cache before calculating balances.
 * 
 * This hook:
 * 1. Checks if months needed for balance calculations are in cache and fresh
 * 2. If stale or missing, shows loading overlay and refetches them
 * 3. Then recalculates both account and category balances from cache
 * 
 * Use this in settings pages to ensure balances are calculated from fresh cache data.
 */

import { useEffect, useRef } from 'react'
import { useBudget } from '@contexts'
import { useApp } from '@contexts'
import { ensureMonthsFreshAndRecalculateBalances } from '@data/mutations/month/ensureMonthsFresh'

/**
 * Hook to ensure balance calculations use fresh cache data.
 * 
 * This should be called in settings pages (Accounts, Categories) to ensure
 * that when navigating to the page, if cache is stale, it's refreshed before
 * calculating balances.
 * 
 * Only runs once when enabled becomes true (when page loads and data is ready).
 * 
 * @param enabled - Whether to run the check (default: true)
 */
export function useEnsureBalancesFresh(enabled: boolean = true) {
  const { selectedBudgetId } = useBudget()
  const { addLoadingHold, removeLoadingHold } = useApp()
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!enabled || !selectedBudgetId || hasRunRef.current) return

    // Mark as run to prevent re-running
    hasRunRef.current = true

    let loadingKey: string | null = null

    ensureMonthsFreshAndRecalculateBalances(
      selectedBudgetId,
      (isLoading, message) => {
        if (isLoading) {
          loadingKey = 'ensure-balances-fresh'
          addLoadingHold(loadingKey, message)
        } else {
          if (loadingKey) {
            removeLoadingHold(loadingKey)
            loadingKey = null
          }
        }
      }
    ).catch((error) => {
      console.error('[useEnsureBalancesFresh] Failed to ensure balances fresh:', error)
      if (loadingKey) {
        removeLoadingHold(loadingKey)
      }
    })
  }, [enabled, selectedBudgetId, addLoadingHold, removeLoadingHold])

  // Reset ref when budget changes so it can run again for new budget
  useEffect(() => {
    if (!selectedBudgetId) {
      hasRunRef.current = false
    }
  }, [selectedBudgetId])
}
