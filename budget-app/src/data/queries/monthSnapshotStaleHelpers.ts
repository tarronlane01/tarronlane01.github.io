/**
 * Month Snapshot Stale Helpers
 *
 * Functions to mark the next month's snapshot as stale when the current month is edited.
 * Split from useMonthQuery for file length.
 */

import type { MonthDocument } from '../../types/budget'
import { getMonthDocId, readDoc, writeDoc, type FirestoreData } from '../firestore/operations'
import { queryClient, queryKeys } from '../queryClient'
import type { MonthQueryData } from './useMonthQuery'

/**
 * Helper to mark a month's snapshot as stale in cache only
 * Call this when editing a month that affects the next month's snapshot
 */
export function markNextMonthSnapshotStaleInCache(
  budgetId: string,
  year: number,
  month: number
) {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthKey = queryKeys.month(budgetId, nextYear, nextMonth)
  const cachedNextMonth = queryClient.getQueryData<MonthQueryData>(nextMonthKey)

  if (cachedNextMonth && !cachedNextMonth.month.previous_month_snapshot_stale) {
    queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
      month: {
        ...cachedNextMonth.month,
        previous_month_snapshot_stale: true,
      },
    })
  }
}

/**
 * Helper to mark next month as stale in Firestore (only if not already stale)
 * This is called once when the first edit to a month happens,
 * NOT on every subsequent edit.
 */
export async function markNextMonthSnapshotStaleInFirestore(
  budgetId: string,
  year: number,
  month: number
): Promise<void> {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthKey = queryKeys.month(budgetId, nextYear, nextMonth)
  const nextMonthDocId = getMonthDocId(budgetId, nextYear, nextMonth)

  // First check cache - if we have cached data, use it (avoids Firestore read)
  let monthData: MonthDocument | null = null
  const cachedData = queryClient.getQueryData<MonthQueryData>(nextMonthKey)

  if (cachedData?.month) {
    monthData = cachedData.month
  } else {
    // Not in cache - check Firestore directly (bypasses React Query error handling)
    // This avoids logging errors for months that don't exist yet
    const { exists, data } = await readDoc<FirestoreData>(
      'months',
      nextMonthDocId,
      'checking if next month exists to mark its snapshot stale'
    )

    // Month doesn't exist yet - no need to mark stale
    // It will get a fresh snapshot when created
    if (!exists || !data) {
      return
    }

    monthData = data as MonthDocument

    // Populate the cache with this data so future checks hit cache
    queryClient.setQueryData<MonthQueryData>(nextMonthKey, { month: monthData })
  }

  // If already stale, nothing to do
  if (monthData.previous_month_snapshot_stale) {
    return
  }

  // Not stale - mark it stale
  await writeDoc(
    'months',
    nextMonthDocId,
    {
      ...monthData,
      previous_month_snapshot_stale: true,
      updated_at: new Date().toISOString(),
    },
    'marking next month snapshot as stale (previous month was edited)'
  )

  // Update cache with stale flag
  queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
    month: {
      ...monthData,
      previous_month_snapshot_stale: true,
    },
  })
}

