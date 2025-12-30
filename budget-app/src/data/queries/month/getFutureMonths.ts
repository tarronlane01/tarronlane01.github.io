/**
 * Get Future Months
 *
 * Queries months for a budget from a starting point forward.
 * Uses Firestore index on budget_id + year_month_ordinal for efficient querying.
 *
 * CACHING STRATEGY:
 * - Caches a list of month identifiers (id, year, month) in React Query
 * - Individual month data is cached separately via readMonth
 * - On cache hit: only reads individual months (no Firestore query)
 * - On cache miss: queries Firestore, caches the list and individual months
 *
 * INVALIDATION:
 * - Cache is invalidated when a new month is created (see createMonth.ts)
 * - Cache expires after 5 minutes (STALE_TIME)
 */

import { queryCollection } from '@firestore'
import type { MonthDocument } from '@types'
import { getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys, STALE_TIME } from '@data/queryClient'
import type { MonthQueryData } from './readMonth'
import { readMonth } from './readMonth'

// ============================================================================
// TYPES
// ============================================================================

/** Month document with its Firestore document ID */
export type MonthWithId = MonthDocument & { id: string }

/** Minimal month identifier for caching the "which months exist" list */
interface MonthIdentifier {
  id: string
  year: number
  month: number
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Fetch the list of future month identifiers from Firestore.
 * This is the actual query that hits Firestore.
 */
async function fetchFutureMonthIdsFromFirestore(
  budgetId: string,
  startAfterOrdinal: string
): Promise<{ identifiers: MonthIdentifier[]; fullMonths: MonthWithId[] }> {
  const monthsResult = await queryCollection<MonthDocument>(
    'months',
    'getFutureMonths: querying months after specified month',
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>', value: startAfterOrdinal },
    ]
  )

  // Map to include document ID and sort chronologically
  const fullMonths: MonthWithId[] = monthsResult.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data,
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  // Extract just the identifiers for caching
  const identifiers: MonthIdentifier[] = fullMonths.map(m => ({
    id: m.id,
    year: m.year,
    month: m.month,
  }))

  return { identifiers, fullMonths }
}

/**
 * Read months using cached identifiers.
 * Uses readMonth for each, which leverages React Query cache.
 */
async function readMonthsFromIdentifiers(
  budgetId: string,
  identifiers: MonthIdentifier[]
): Promise<MonthWithId[]> {
  const months: MonthWithId[] = []

  for (const { id, year, month } of identifiers) {
    // Use readMonth which handles caching - disable recalc trigger since
    // we just want the data, not to trigger recalculation for all future months
    const monthData = await readMonth(budgetId, year, month, {
      triggerRecalc: false,
      description: `getFutureMonths: reading cached month ${year}/${month}`,
    })

    if (monthData) {
      months.push({ ...monthData, id })
    }
  }

  return months
}

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
 * Uses React Query to cache the list of month identifiers. On subsequent calls,
 * only reads individual months (which are also cached) instead of re-querying
 * Firestore for the list.
 *
 * @param budgetId - The budget ID to query months for
 * @param startAfterYear - Year of the month to start after
 * @param startAfterMonth - Month to start after (1-12)
 * @param options - Optional configuration (e.g., skipCache for recalculation)
 * @returns Array of months after the specified month, sorted chronologically
 */
export async function getFutureMonths(
  budgetId: string,
  startAfterYear: number,
  startAfterMonth: number,
  options?: GetFutureMonthsOptions
): Promise<MonthWithId[]> {
  const { skipCache = false } = options || {}
  const startAfterOrdinal = getYearMonthOrdinal(startAfterYear, startAfterMonth)

  // If not skipping cache, try to use cached data
  if (!skipCache) {
    const cacheKey = queryKeys.futureMonthIds(budgetId, startAfterOrdinal)
    const cachedIdentifiers = queryClient.getQueryData<MonthIdentifier[]>(cacheKey)

    // Check if cache is still fresh (not stale)
    const queryState = queryClient.getQueryState(cacheKey)
    const isCacheFresh = queryState?.dataUpdatedAt &&
      Date.now() - queryState.dataUpdatedAt < STALE_TIME

    if (cachedIdentifiers && isCacheFresh) {
      // Cache hit - read individual months (also cached)
      return readMonthsFromIdentifiers(budgetId, cachedIdentifiers)
    }
  }

  // Cache miss, stale, or skipCache - fetch fresh from Firestore
  const { identifiers, fullMonths } = await fetchFutureMonthIdsFromFirestore(
    budgetId,
    startAfterOrdinal
  )

  // Cache the list of identifiers (even when skipCache, for future non-recalc reads)
  const cacheKey = queryKeys.futureMonthIds(budgetId, startAfterOrdinal)
  queryClient.setQueryData<MonthIdentifier[]>(cacheKey, identifiers)

  // Cache each individual month for subsequent reads
  for (const month of fullMonths) {
    queryClient.setQueryData<MonthQueryData>(
      queryKeys.month(budgetId, month.year, month.month),
      { month }
    )
  }

  return fullMonths
}

