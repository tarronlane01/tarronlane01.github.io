/**
 * Mark Months Need Recalculation
 *
 * Marks months as needing recalculation in the budget's month_map.
 * This is a single write operation to the budget document that:
 * 1. Marks the current month AND all months after as needing recalculation
 * 2. Marks the budget itself as needing recalculation
 *
 * WHEN TO CALL:
 * - After any month data changes that affect current or future months' balances
 * - Called automatically by writeMonthData
 */

import { readDocByPath, updateDocByPath } from '@firestore'
import type { FirestoreData, MonthMap } from '@types'
import { getYearMonthOrdinal } from '@utils'
import {
  getMonthWindowOrdinals,
  cleanupMonthMap,
  areAllFutureMonthsAlreadyMarkedInCache,
  updateCacheWithMarking,
  updateCacheWithMonth,
  updateCacheWithAllMonthsMarked,
} from './markMonthsHelpers'

// ============================================================================
// TYPES
// ============================================================================

interface MarkMonthsResult {
  /** Number of months marked as needing recalculation */
  markedCount: number
  /** Whether the budget was updated */
  budgetUpdated: boolean
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Mark months AFTER the specified month as needing recalculation.
 * Also marks the budget as needing recalculation.
 *
 * @param budgetId - The budget ID
 * @param currentYear - Year of the month that was edited
 * @param currentMonth - Month that was edited (1-12)
 * @returns Summary of marking operation
 */
export async function markMonthsNeedRecalculation(
  budgetId: string,
  currentYear: number,
  currentMonth: number
): Promise<MarkMonthsResult> {
  const editedMonthOrdinal = getYearMonthOrdinal(currentYear, currentMonth)

  // OPTIMIZATION: Check if all future months are already marked in cache
  if (areAllFutureMonthsAlreadyMarkedInCache(budgetId, editedMonthOrdinal)) {
    return { markedCount: 0, budgetUpdated: false }
  }

  // Read current budget to get existing month_map
  const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets', budgetId, 'reading budget for month_map update'
  )

  if (!exists || !budgetData) {
    console.warn(`[markMonthsNeedRecalculation] Budget ${budgetId} not found`)
    return { markedCount: 0, budgetUpdated: false }
  }

  // Parse existing month_map
  const existingMonthMap: MonthMap = budgetData.month_map || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }
  const windowOrdinals = getMonthWindowOrdinals()

  // Ensure all window months exist in the map (just add them if missing)
  let addedCount = 0
  for (const ordinal of windowOrdinals) {
    if (ordinal >= editedMonthOrdinal && !(ordinal in updatedMonthMap)) {
      updatedMonthMap[ordinal] = {}
      addedCount++
    }
  }

  // If nothing changed, skip the write
  if (addedCount === 0) {
    return { markedCount: 0, budgetUpdated: false }
  }

  // Clean up old months outside the window (if needed)
  const cleanedMonthMap = cleanupMonthMap(updatedMonthMap)

  // Update cache before writing to Firestore
  updateCacheWithMarking(budgetId, editedMonthOrdinal, cleanedMonthMap)

  // Write to Firestore - only update month_map (no flags)
  await updateDocByPath('budgets', budgetId, {
    month_map: cleanedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding ${addedCount} month(s) to budget month_map`)

  // Note: updateCacheWithMarking (called above) updates the React Query cache via setQueryData,
  // which should trigger re-renders in components using useBudgetData/useBudgetQuery.
  // No invalidation needed - the cache update is sufficient.

  return { markedCount: addedCount, budgetUpdated: true }
}

/**
 * Mark a specific month as needing recalculation (used when creating a new month).
 * Does NOT mark other months - only adds/updates a single month entry.
 */
export async function setMonthInBudgetMap(
  budgetId: string,
  year: number,
  month: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter kept for API compatibility
  _needsRecalculation: boolean = false
): Promise<void> {
  const monthOrdinal = getYearMonthOrdinal(year, month)

  const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets', budgetId, 'reading budget for month_map update (add month)'
  )

  if (!exists || !budgetData) {
    console.warn(`[setMonthInBudgetMap] Budget ${budgetId} not found`)
    return
  }

  const existingMonthMap: MonthMap = budgetData.month_map || {}
  // Only add if not already present
  if (monthOrdinal in existingMonthMap) {
    return // Already in map
  }

  const updatedMonthMap: MonthMap = { ...existingMonthMap, [monthOrdinal]: {} }
  const cleanedMonthMap = cleanupMonthMap(updatedMonthMap)

  updateCacheWithMonth(budgetId, cleanedMonthMap)

  await updateDocByPath('budgets', budgetId, {
    month_map: cleanedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding month ${year}/${month} to budget month_map`)
}

// ============================================================================
// MARK ALL MONTHS FROM STARTING POINT (FOR HISTORICAL IMPORTS)
// ============================================================================

/**
 * Add all existing months from a starting point onwards to the month_map.
 * Used after seed data import to ensure month_map is up to date.
 */
export async function markAllMonthsFromOrdinal(
  budgetId: string,
  startingYear: number,
  startingMonth: number
): Promise<MarkMonthsResult> {
  const startingOrdinal = getYearMonthOrdinal(startingYear, startingMonth)

  // Query all months for this budget
  const { queryCollection } = await import('@firestore')
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    `adding months to map: querying all months for budget ${budgetId}`,
    [{ field: 'budget_id', op: '==', value: budgetId }]
  )

  // Build list of all month ordinals that exist
  const existingOrdinals: string[] = []
  for (const monthDoc of monthsResult.docs) {
    const data = monthDoc.data
    if (data.year && data.month) {
      existingOrdinals.push(getYearMonthOrdinal(data.year as number, data.month as number))
    }
  }
  existingOrdinals.sort()

  const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets', budgetId, 'reading budget for historical month map update'
  )

  if (!exists || !budgetData) {
    console.warn(`[markAllMonthsFromOrdinal] Budget ${budgetId} not found`)
    return { markedCount: 0, budgetUpdated: false }
  }

  const existingMonthMap: MonthMap = budgetData.month_map || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  // Add all months >= startingOrdinal to the map
  let addedCount = 0
  for (const ordinal of existingOrdinals) {
    if (ordinal >= startingOrdinal && !(ordinal in updatedMonthMap)) {
      updatedMonthMap[ordinal] = {}
      addedCount++
    }
  }

  if (addedCount === 0) {
    return { markedCount: 0, budgetUpdated: false }
  }

  updateCacheWithAllMonthsMarked(budgetId, updatedMonthMap)

  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding ${addedCount} months from ${startingYear}/${startingMonth} to month_map`)

  return { markedCount: addedCount, budgetUpdated: true }
}
