/**
 * Recalculation Module
 *
 * Centralized location for all recalculation-related code.
 *
 * MAIN ENTRY POINT:
 * - triggerRecalculation - Called when is_needs_recalculation is detected
 *
 * MARKING AS STALE (when data changes):
 * - markBudgetNeedsRecalculation - Mark budget as needing recalculation
 * - markFutureMonthsNeedRecalculation - Mark future months as needing recalculation
 *
 * INTERNAL (used by triggerRecalculation):
 * - recalculateMonth - Pure calculation for a single month
 *
 * The pattern is:
 * 1. User edits data → writeMonthData → marks future months + budget as stale
 * 2. User views month/budget → read function detects stale flag → triggerRecalculation
 * 3. triggerRecalculation walks back to find valid starting point, then forward to recalculate
 */

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export { triggerRecalculation } from './triggerRecalculation'

// ============================================================================
// MARKING AS STALE
// ============================================================================

export { markBudgetNeedsRecalculation } from './markBudgetNeedsRecalculation'
export { markFutureMonthsNeedRecalculation } from './markFutureMonthsNeedRecalculation'

// ============================================================================
// INTERNAL HELPERS (exported for testing/advanced use)
// ============================================================================

export {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
