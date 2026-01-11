/**
 * Cache-Aware Month Read for Mutations
 *
 * Provides utilities for month mutations to efficiently read data:
 * - If cache is fresh: use cached data (no network request)
 * - If cache is stale: fetch fresh data from Firestore
 *
 * This is the ONLY approved way to read month data in mutations.
 * Direct readMonthForEdit imports are blocked by ESLint.
 */

import { queryClient, queryKeys, STALE_TIME } from '@data/queryClient'
import { readMonth } from '@data/queries/month'
import type { MonthDocument } from '@types'
import type { MonthQueryData } from '@data/queries/month'

// ============================================================================
// CACHE FRESHNESS CHECK
// ============================================================================

/**
 * Check if the month cache is fresh (not stale).
 * Call this in optimisticUpdate and store result on params for mutationFn.
 */
export function isMonthCacheFresh(budgetId: string, year: number, month: number): boolean {
  const queryState = queryClient.getQueryState(queryKeys.month(budgetId, year, month))

  if (!queryState?.dataUpdatedAt) {
    return false // No cached data
  }

  const dataAge = Date.now() - queryState.dataUpdatedAt
  return dataAge < STALE_TIME
}

// ============================================================================
// GET MONTH DATA FOR MUTATION
// ============================================================================

/**
 * Get month data for a mutation, using cache if fresh or fetching if stale.
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param cacheWasFresh - Whether cache was fresh when optimistic update ran
 * @returns The month document to use for the mutation
 */
export async function getMonthForMutation(
  budgetId: string,
  year: number,
  month: number,
  cacheWasFresh: boolean
): Promise<MonthDocument> {
  if (cacheWasFresh) {
    // Cache was fresh - use the optimistic data already in cache
    const cached = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month))
    if (cached?.month) {
      return cached.month
    }
    // Fallback to fetch if cache somehow empty
  }

  // Cache was stale or empty - fetch fresh data
  const fresh = await readMonth(budgetId, year, month, {
    description: 'fetching fresh month data for mutation (cache was stale)',
  })

  if (!fresh) {
    throw new Error(`Month not found: ${year}/${month}`)
  }

  return fresh
}

// ============================================================================
// TYPE EXTENSIONS FOR MUTATION PARAMS
// ============================================================================

/**
 * Common fields added to mutation params by optimisticUpdate.
 * Extend your params interface with this.
 */
export interface CacheAwareMutationParams {
  /** Whether the cache was fresh when optimistic update ran */
  _cacheWasFresh?: boolean
}

