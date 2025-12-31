/**
 * Recalculation Module
 *
 * Centralized location for all recalculation-related code.
 *
 * MAIN ENTRY POINT:
 * - triggerRecalculation - Called when is_needs_recalculation is detected
 *
 * MARKING AS STALE (when data changes):
 * - markMonthsNeedRecalculation - Single write that marks budget and future months
 * - setMonthInBudgetMap - Add/update a single month in the budget's month_map
 *
 * INTERNAL (used by triggerRecalculation):
 * - recalculateMonth - Pure calculation for a single month
 *
 * The pattern is:
 * 1. User edits data → writeMonthData → marks budget + updates month_map in single write
 * 2. User views month/budget → read function detects stale flag → triggerRecalculation
 * 3. triggerRecalculation uses month_map to find which months need recalculation
 */

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export { triggerRecalculation } from './triggerRecalculation'

// ============================================================================
// MARKING AS STALE
// ============================================================================

export {
  markMonthsNeedRecalculation,
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
