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

  // Ensure all window months exist in the map
  for (const ordinal of windowOrdinals) {
    if (!updatedMonthMap[ordinal]) {
      updatedMonthMap[ordinal] = { needs_recalculation: false }
    }
  }

  // Mark current month AND all months AFTER as needing recalculation
  let markedCount = 0
  for (const ordinal of windowOrdinals) {
    if (ordinal >= editedMonthOrdinal) {
      if (!updatedMonthMap[ordinal]?.needs_recalculation) {
        updatedMonthMap[ordinal] = { needs_recalculation: true }
        markedCount++
      }
    }
  }

  // Check if budget is already marked as needing recalculation
  const budgetAlreadyMarked = budgetData.is_needs_recalculation === true

  // If nothing changed AND budget is already marked, skip the write
  if (markedCount === 0 && budgetAlreadyMarked) {
    return { markedCount: 0, budgetUpdated: false }
  }

  // Clean up old months outside the window
  const cleanedMonthMap = cleanupMonthMap(updatedMonthMap)

  // Update cache before writing to Firestore
  updateCacheWithMarking(budgetId, editedMonthOrdinal, cleanedMonthMap)

  // Write to Firestore in a single operation
  await updateDocByPath('budgets', budgetId, {
    is_needs_recalculation: true,
    month_map: cleanedMonthMap,
    updated_at: new Date().toISOString(),
  }, `marking budget and ${markedCount} future months as needing recalculation`)

  return { markedCount, budgetUpdated: true }
}

/**
 * Mark a specific month as needing recalculation (used when creating a new month).
 * Does NOT mark other months - only adds/updates a single month entry.
 */
export async function setMonthInBudgetMap(
  budgetId: string,
  year: number,
  month: number,
  needsRecalculation: boolean = false
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
  const updatedMonthMap: MonthMap = { ...existingMonthMap, [monthOrdinal]: { needs_recalculation: needsRecalculation } }
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
 * Mark all existing months from a starting point onwards as needing recalculation.
 * Used after seed data import to ensure balances cascade correctly.
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
    `marking months for recalc: querying all months for budget ${budgetId}`,
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
    'budgets', budgetId, 'reading budget for historical month marking'
  )

  if (!exists || !budgetData) {
    console.warn(`[markAllMonthsFromOrdinal] Budget ${budgetId} not found`)
    return { markedCount: 0, budgetUpdated: false }
  }

  const existingMonthMap: MonthMap = budgetData.month_map || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  // Mark all months >= startingOrdinal as needing recalculation
  let markedCount = 0
  for (const ordinal of existingOrdinals) {
    if (ordinal >= startingOrdinal) {
      updatedMonthMap[ordinal] = { needs_recalculation: true }
      markedCount++
    } else if (!updatedMonthMap[ordinal]) {
      updatedMonthMap[ordinal] = { needs_recalculation: false }
    }
  }

  if (markedCount === 0) {
    return { markedCount: 0, budgetUpdated: false }
  }

  updateCacheWithAllMonthsMarked(budgetId, updatedMonthMap)

  await updateDocByPath('budgets', budgetId, {
    is_needs_recalculation: true,
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `marking ${markedCount} months from ${startingYear}/${startingMonth} as needing recalculation`)

  return { markedCount, budgetUpdated: true }
}
