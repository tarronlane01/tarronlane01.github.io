/**
 * Get Future Months
 *
 * Queries months for a budget from a starting point forward.
 * Uses Firestore index on budget_id + year_month_ordinal for efficient querying.
 * Caches each fetched month in React Query for subsequent individual access.
 */

import { queryCollection } from '@firestore'
import type { MonthDocument } from '@types'
import { getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys } from '@data/queryClient'
import type { MonthQueryData } from './readMonth'

// ============================================================================
// TYPES
// ============================================================================

/** Month document with its Firestore document ID */
export type MonthWithId = MonthDocument & { id: string }

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Query months for a budget after a given month.
 *
 * Uses a single Firestore query with year_month_ordinal for efficient filtering.
 * Each fetched month is cached in React Query for subsequent individual access.
 *
 * @param budgetId - The budget ID to query months for
 * @param startAfterYear - Year of the month to start after
 * @param startAfterMonth - Month to start after (1-12)
 * @returns Array of months after the specified month, sorted chronologically
 */
export async function getFutureMonths(
  budgetId: string,
  startAfterYear: number,
  startAfterMonth: number
): Promise<MonthWithId[]> {
  // Convert to ordinal for comparison (e.g., "202512")
  const startAfterOrdinal = getYearMonthOrdinal(startAfterYear, startAfterMonth)

  // Single query: get all months where year_month_ordinal > startAfterOrdinal
  const monthsResult = await queryCollection<MonthDocument>(
    'months',
    'getFutureMonths: querying months after specified month',
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>', value: startAfterOrdinal },
    ]
  )

  // Map to include document ID and sort chronologically
  const futureMonths: MonthWithId[] = monthsResult.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  // Cache each month in React Query for subsequent individual access
  for (const month of futureMonths) {
    queryClient.setQueryData<MonthQueryData>(
      queryKeys.month(budgetId, month.year, month.month),
      { month }
    )
  }

  return futureMonths
}

