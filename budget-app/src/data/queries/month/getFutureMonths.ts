/**
 * Get Future Months
 *
 * Queries months for a budget from a starting point forward.
 * Uses Firestore index on budget_id + year_month_ordinal for efficient querying.
 *
 * NOTE: The budget's month_map now serves as the primary index for recent months
 * (3 past to 3 future). This function is still used for:
 * - Querying months older than 3 months ago (for recalculation lookback)
 * - Getting full month documents when needed
 */

import { queryCollection } from '@firestore'
import type { MonthDocument } from '@types'
import { getYearMonthOrdinal } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

/** Month document with its Firestore document ID */
export type MonthWithId = MonthDocument & { id: string }

// ============================================================================
// TYPES (OPTIONS)
// ============================================================================

export interface GetFutureMonthsOptions {
  /**
   * Skip the cache and always fetch fresh data from Firestore.
   * Use this during recalculation to ensure accurate data.
   * Default: false
   */
  skipCache?: boolean
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Query months for a budget after a given month.
 *
 * Queries Firestore directly for months with year_month_ordinal > startAfterOrdinal.
 *
 * @param budgetId - The budget ID to query months for
 * @param startAfterYear - Year of the month to start after
 * @param startAfterMonth - Month to start after (1-12)
 * @param _options - Optional configuration (skipCache is no longer used)
 * @returns Array of months after the specified month, sorted chronologically
 */
export async function getFutureMonths(
  budgetId: string,
  startAfterYear: number,
  startAfterMonth: number,
  _options?: GetFutureMonthsOptions
): Promise<MonthWithId[]> {
  const startAfterOrdinal = getYearMonthOrdinal(startAfterYear, startAfterMonth)

  const monthsResult = await queryCollection<MonthDocument>(
    'months',
    'getFutureMonths: querying months after specified month',
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>', value: startAfterOrdinal },
    ]
  )

  // Map to include document ID and sort chronologically
  const months: MonthWithId[] = monthsResult.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  return months
}
