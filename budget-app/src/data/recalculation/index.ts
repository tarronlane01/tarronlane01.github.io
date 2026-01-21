/**
 * Recalculation Module
 *
 * Centralized location for all recalculation-related code.
 *
 * MAIN ENTRY POINT:
 * - triggerRecalculation - Called manually or on-demand (no flags tracked)
 *
 * MARKING AS STALE (when data changes):
 * - markMonthsNeedRecalculation - Single write that marks budget and future months
 * - setMonthInBudgetMap - Add/update a single month in the budget's month_map
 *
 * INTERNAL (used by triggerRecalculation):
 * - recalculateMonth - Pure calculation for a single month
 *
 * The pattern is:
 * 1. User edits data → writeMonthData → updates month_map in single write
 * 2. User views month/budget → recalculation happens on-demand when needed
 * 3. triggerRecalculation uses month_map to find which months to recalculate
 * 4. All balances are calculated on-the-fly and stored only in cache
 */

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export { triggerRecalculation, type RecalculationProgress } from './triggerRecalculation'

// ============================================================================
// MARKING AS STALE
// ============================================================================

export {
  markMonthsNeedRecalculation,
  markAllMonthsFromOrdinal,
  setMonthInBudgetMap,
} from './markMonthsNeedRecalculation'

// ============================================================================
// INTERNAL HELPERS (exported for testing/advanced use)
// ============================================================================

export {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
