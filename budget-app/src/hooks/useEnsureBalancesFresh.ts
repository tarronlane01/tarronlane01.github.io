/**
 * Hook to ensure months are fresh in cache before calculating balances.
 * 
 * This hook:
 * 1. Checks if months needed for balance calculations are in cache and fresh
 * 2. If stale or missing, shows loading overlay and refetches them
 * 3. Then recalculates both account and category balances from cache
 * 
 * Use in settings pages (Accounts, Categories) or on the main Budget view (with
 * alwaysRecalculate: true so we recalc on every load/reload, since fetchBudget
 * sets category balance to 0 and we need to repopulate from month cache).
 */

import { useEffect, useRef } from 'react'
import { useBudget } from '@contexts'
import { useApp } from '@contexts'
import { ensureMonthsFreshAndRecalculateBalances } from '@data/mutations/month/ensureMonthsFresh'

export interface UseEnsureBalancesFreshOptions {
  /** When true, always run recalc (e.g. on budget view load after full page reload). Default false for settings pages. */
  alwaysRecalculate?: boolean
}

/**
 * Hook to ensure balance calculations use fresh cache data.
 * 
 * Only runs once when enabled becomes true (when page loads and data is ready).
 * 
 * @param enabled - Whether to run the check (default: true)
 * @param options - alwaysRecalculate: set true on the main Budget view so we recalc on every load (budget category balance is 0 after fetch; recalc repopulates it).
 */
export function useEnsureBalancesFresh(enabled: boolean = true, options: UseEnsureBalancesFreshOptions = {}) {
  const { alwaysRecalculate = false } = options
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
      },
      alwaysRecalculate
    ).catch((error) => {
      console.error('[useEnsureBalancesFresh] Failed to ensure balances fresh:', error)
      if (loadingKey) {
        removeLoadingHold(loadingKey)
      }
    })
  }, [enabled, selectedBudgetId, alwaysRecalculate, addLoadingHold, removeLoadingHold])

  // Reset ref when budget changes so it can run again for new budget
  useEffect(() => {
    if (!selectedBudgetId) {
      hasRunRef.current = false
    }
  }, [selectedBudgetId])
}
