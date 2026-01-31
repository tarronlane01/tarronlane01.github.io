/**
 * Recalculation Module
 *
 * Centralized location for all recalculation-related code.
 *
 * MAIN ENTRY POINT:
 * - triggerRecalculation - Called manually or on-demand (no flags tracked)
 *
 * MONTH MAP MANAGEMENT (when data changes):
 * - ensureMonthsInMap - Ensures edited month and future months are in the month_map
 * - addMonthToMap - Add a single month to the budget's month_map
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
// MONTH MAP MANAGEMENT
// ============================================================================

export {
  ensureMonthsInMap,
  ensureMonthsInMapBatch,
  addAllMonthsFromOrdinal,
  addMonthToMap,
  type AddMonthsResult,
} from './monthMap'

// ============================================================================
// INTERNAL HELPERS (exported for testing/advanced use)
// ============================================================================

export {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'

export {
  recalculateAllBalancesFromCache,
  getLastRecalcBaseMonthForDebug,
  type RecalculateAllBalancesOptions,
} from './recalculateAllBalancesFromCache'
