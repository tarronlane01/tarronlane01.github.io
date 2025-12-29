/**
 * Read Month
 *
 * Single source of truth for reading month documents.
 * All month reads should go through this file.
 *
 * Handles:
 * - Cache-first reads (React Query cache)
 * - Firestore fetches when not cached
 * - Automatic triggering of recalculation when is_needs_recalculation is true
 *
 * RECALCULATION:
 * When a month has is_needs_recalculation = true and triggerRecalc is enabled,
 * this module calls triggerRecalculation which handles the full walk-back/walk-forward
 * process to ensure all affected months are properly recalculated.
 *
 * See: recalculation/triggerRecalculation.ts
 */

import type { MonthDocument, FirestoreData } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys, STALE_TIME } from '@data/queryClient'
import { triggerRecalculation } from '@data/recalculation/triggerRecalculation'

// ============================================================================
// TYPES
// ============================================================================

export interface MonthQueryData {
  month: MonthDocument
}

export interface ReadMonthOptions {
  /** Description for logging */
  description?: string
  /**
   * Whether to trigger recalculation if is_needs_recalculation is true.
   * Default: true
   * Set to false when calling from within recalculation logic to avoid infinite loops.
   */
  triggerRecalc?: boolean
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse raw Firestore month data into typed MonthDocument
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  return {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    is_needs_recalculation: data.is_needs_recalculation ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ============================================================================
// MAIN READ FUNCTION
// ============================================================================

/**
 * Read a month document.
 *
 * This is the main entry point for all month reads.
 * - Uses React Query's fetchQuery (automatic cache check + fetch)
 * - Automatically triggers recalculation if is_needs_recalculation is true
 *
 * When recalculation is triggered, this function will:
 * 1. Call triggerRecalculation with the target month ordinal
 * 2. Re-read the month from cache (which should now be recalculated)
 * 3. Return the recalculated month
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param options - Read options
 * @returns Month document or null if doesn't exist
 */
export async function readMonth(
  budgetId: string,
  year: number,
  month: number,
  options?: ReadMonthOptions
): Promise<MonthDocument | null> {
  const opts: ReadMonthOptions = { triggerRecalc: true, ...options }
  const monthDocId = getMonthDocId(budgetId, year, month)

  // Use React Query's fetchQuery - automatically checks cache and fetches if needed
  // NOTE: fetchQuery does NOT inherit staleTime from queryClient defaults,
  // so we must explicitly pass it to avoid always refetching
  const result = await queryClient.fetchQuery<MonthQueryData | null>({
    queryKey: queryKeys.month(budgetId, year, month),
    queryFn: async () => {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'months',
        monthDocId,
        opts.description ?? `reading month ${year}/${month}`
      )

      if (!exists || !data) {
        return null
      }

      const parsedMonth = parseMonthData(data, budgetId, year, month)
      return { month: parsedMonth }
    },
    staleTime: STALE_TIME,
  })

  const monthDoc = result?.month ?? null

  if (!monthDoc) {
    return null
  }

  // If month needs recalculation and triggering is enabled, run the recalculation flow
  if (opts.triggerRecalc && monthDoc.is_needs_recalculation) {
    const monthOrdinal = getYearMonthOrdinal(year, month)

    console.log(`[readMonth] Month ${monthOrdinal} needs recalculation, triggering...`)

    // Trigger recalculation for this specific month
    // This will recalculate from the last valid month up to this month
    await triggerRecalculation(budgetId, { targetMonthOrdinal: monthOrdinal })

    // Re-read from cache - should now be recalculated
    // Use triggerRecalc: false to avoid infinite loop
    const recalculated = await readMonth(budgetId, year, month, {
      triggerRecalc: false,
      description: 'reading recalculated month',
    })

    return recalculated
  }

  return monthDoc
}

