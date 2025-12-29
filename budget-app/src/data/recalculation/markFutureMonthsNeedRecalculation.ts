/**
 * Mark Future Months Need Recalculation
 *
 * Marks all months AFTER the specified month as needing recalculation.
 * Uses cache-aware logic to avoid redundant Firestore writes.
 *
 * This is the ONLY way to set is_needs_recalculation = true on month documents.
 *
 * WHEN TO CALL:
 * - After any month data changes that affect future months' start balances
 * - Called automatically by writeMonthData
 *
 * WHAT HAPPENS ON READ:
 * - When month is loaded with is_needs_recalculation = true
 * - triggerRecalculation rebuilds balances from previous month
 * - See: triggerRecalculation.ts
 */

import { updateDocByPath } from '@firestore'
import type { MonthDocument } from '@types'
import { queryClient, queryKeys } from '../queryClient'
import { getFutureMonths, type MonthWithId } from '../queries/month'
import type { MonthQueryData } from '../queries/month'

// ============================================================================
// TYPES
// ============================================================================

interface MarkFutureMonthsResult {
  /** Number of months that were marked (Firestore writes sent) */
  markedCount: number
  /** Number of months that were skipped (already marked in cache) */
  skippedCount: number
  /** Total future months found */
  totalFutureMonths: number
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Check if a month is already marked as needing recalculation in cache.
 * Returns true if the month is in cache AND already marked.
 */
function isAlreadyMarkedInCache(budgetId: string, year: number, month: number): boolean {
  const monthKey = queryKeys.month(budgetId, year, month)
  const cachedMonth = queryClient.getQueryData<MonthQueryData>(monthKey)

  // If not in cache, we can't skip - need to send the write
  if (!cachedMonth?.month) return false

  // If in cache and already marked, skip
  return cachedMonth.month.is_needs_recalculation === true
}

/**
 * Update or create cache entry to mark a month as needing recalculation.
 * Uses the month data we already have from getFutureMonths to ensure the
 * month is always cached after marking, preventing redundant Firestore writes.
 */
function markInCache(budgetId: string, monthData: MonthWithId): void {
  const monthKey = queryKeys.month(budgetId, monthData.year, monthData.month)

  // Always set cache with is_needs_recalculation: true
  // This ensures the month is cached even if it wasn't before
  const updatedMonth: MonthDocument = {
    ...monthData,
    is_needs_recalculation: true,
  }

  queryClient.setQueryData<MonthQueryData>(monthKey, {
    month: updatedMonth,
  })
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Mark all months AFTER the specified month as needing recalculation.
 *
 * Optimizations:
 * - Fetches future months and caches them
 * - Checks cache before each write - skips if already marked
 * - Updates cache immediately to prevent duplicate writes from concurrent calls
 * - Uses updateDocByPath with minimal payload (only is_needs_recalculation + updated_at)
 *
 * @param budgetId - The budget ID
 * @param currentYear - Year of the month that was edited (marks months AFTER this)
 * @param currentMonth - Month that was edited (1-12) (marks months AFTER this)
 * @returns Summary of marking operation
 */
export async function markFutureMonthsNeedRecalculation(
  budgetId: string,
  currentYear: number,
  currentMonth: number
): Promise<MarkFutureMonthsResult> {
  // Get all months after the current month (also caches them)
  const futureMonths = await getFutureMonths(budgetId, currentYear, currentMonth)

  if (futureMonths.length === 0) {
    return { markedCount: 0, skippedCount: 0, totalFutureMonths: 0 }
  }

  let markedCount = 0
  let skippedCount = 0

  // Process each future month
  const updatePromises: Promise<void>[] = []

  for (const month of futureMonths) {
    // Check cache - skip if already marked
    if (isAlreadyMarkedInCache(budgetId, month.year, month.month)) {
      skippedCount++
      continue
    }

    // Update cache immediately with full month data to prevent duplicate writes
    markInCache(budgetId, month)

    // Queue the Firestore update
    updatePromises.push(
      updateDocByPath(
        'months',
        month.id,
        {
          is_needs_recalculation: true,
          updated_at: new Date().toISOString(),
        },
        `marking month ${month.year}/${month.month} as is_needs_recalculation`
      )
    )
    markedCount++
  }

  // Send all updates in parallel
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises)
  }

  return {
    markedCount,
    skippedCount,
    totalFutureMonths: futureMonths.length,
  }
}

