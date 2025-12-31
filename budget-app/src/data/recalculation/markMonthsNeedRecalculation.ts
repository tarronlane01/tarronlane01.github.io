/**
 * Mark Months Need Recalculation
 *
 * Marks months as needing recalculation in the budget's month_map.
 * This is a single write operation to the budget document that:
 * 1. Marks all months AFTER the specified month as needing recalculation
 * 2. Marks the budget itself as needing recalculation
 *
 * The month_map on the budget document acts as an index for recent months
 * (current, 3 past, 3 future). This allows efficient queries without
 * needing to read individual month documents.
 *
 * WHEN TO CALL:
 * - After any month data changes that affect future months' start balances
 * - Called automatically by writeMonthData
 */

import { readDocByPath, updateDocByPath } from '@firestore'
import type { FirestoreData, MonthMap } from '@types'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import { getYearMonthOrdinal } from '@utils'

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
// HELPERS
// ============================================================================

/**
 * Get the 7-month window (3 past, current, 3 future) ordinals.
 */
function getMonthWindowOrdinals(): string[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  const ordinals: string[] = []

  // 3 months in the past
  for (let i = 3; i > 0; i--) {
    let year = currentYear
    let month = currentMonth - i
    while (month < 1) {
      month += 12
      year -= 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  // Current month
  ordinals.push(getYearMonthOrdinal(currentYear, currentMonth))

  // 3 months in the future
  for (let i = 1; i <= 3; i++) {
    let year = currentYear
    let month = currentMonth + i
    while (month > 12) {
      month -= 12
      year += 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  return ordinals
}

/**
 * Clean up the month_map to only include months in the 7-month window.
 */
function cleanupMonthMap(monthMap: MonthMap): MonthMap {
  const validOrdinals = new Set(getMonthWindowOrdinals())
  const cleaned: MonthMap = {}

  for (const [ordinal, info] of Object.entries(monthMap)) {
    if (validOrdinals.has(ordinal)) {
      cleaned[ordinal] = info
    }
  }

  return cleaned
}

// ============================================================================
// CACHE HELPERS
// ============================================================================

/**
 * Check if ALL months after the specified ordinal are already marked in cache.
 * Returns true only if the cache exists AND all relevant months are already marked.
 *
 * This optimization prevents unnecessary Firestore writes when the user
 * makes multiple edits to the same month in quick succession.
 */
function areAllFutureMonthsAlreadyMarkedInCache(budgetId: string, afterOrdinal: string): boolean {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (!cachedBudget?.monthMap) return false

  // Check if any future month in the cache is NOT marked
  for (const [ordinal, info] of Object.entries(cachedBudget.monthMap)) {
    if (ordinal > afterOrdinal && !info.needs_recalculation) {
      return false // Found a future month that's not marked
    }
  }

  return true // All future months (if any) are already marked
}

/**
 * Update the cache to mark the budget and months as needing recalculation.
 */
function updateCacheWithMarking(
  budgetId: string,
  _monthOrdinalToMark: string,
  updatedMonthMap: MonthMap
): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      isNeedsRecalculation: true,
      monthMap: updatedMonthMap,
      budget: {
        ...cachedBudget.budget,
        is_needs_recalculation: true,
        month_map: updatedMonthMap,
      },
    })
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Mark months AFTER the specified month as needing recalculation.
 * Also marks the budget as needing recalculation.
 *
 * This is a single write to the budget document that updates:
 * - is_needs_recalculation: true
 * - month_map: marks future months as needing recalculation
 *
 * OPTIMIZATION: If all future months are already marked in a fresh cache,
 * we skip the Firestore write entirely.
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
  // If so, we can skip the Firestore write entirely
  if (areAllFutureMonthsAlreadyMarkedInCache(budgetId, editedMonthOrdinal)) {
    console.log(`[markMonthsNeedRecalculation] All future months already marked in cache, skipping write`)
    return { markedCount: 0, budgetUpdated: false }
  }

  // Read current budget to get existing month_map
  const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    'reading budget for month_map update'
  )

  if (!exists || !budgetData) {
    console.warn(`[markMonthsNeedRecalculation] Budget ${budgetId} not found`)
    return { markedCount: 0, budgetUpdated: false }
  }

  // Parse existing month_map
  const existingMonthMap: MonthMap = budgetData.month_map || {}

  // Build updated month_map:
  // 1. Keep existing entries that are in the 7-month window
  // 2. Mark all months AFTER editedMonthOrdinal as needing recalculation
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  // Get all month ordinals in the window
  const windowOrdinals = getMonthWindowOrdinals()

  // Ensure all window months exist in the map
  for (const ordinal of windowOrdinals) {
    if (!updatedMonthMap[ordinal]) {
      updatedMonthMap[ordinal] = { needs_recalculation: false }
    }
  }

  // Mark months AFTER the edited month as needing recalculation
  let markedCount = 0
  for (const ordinal of windowOrdinals) {
    if (ordinal > editedMonthOrdinal) {
      if (!updatedMonthMap[ordinal]?.needs_recalculation) {
        updatedMonthMap[ordinal] = { needs_recalculation: true }
        markedCount++
      }
    }
  }

  // If nothing changed (all already marked in Firestore too), skip the write
  if (markedCount === 0) {
    console.log(`[markMonthsNeedRecalculation] No new months to mark, skipping write`)
    return { markedCount: 0, budgetUpdated: false }
  }

  // Clean up old months outside the window
  const cleanedMonthMap = cleanupMonthMap(updatedMonthMap)

  // Update cache before writing to Firestore
  updateCacheWithMarking(budgetId, editedMonthOrdinal, cleanedMonthMap)

  // Write to Firestore in a single operation
  await updateDocByPath(
    'budgets',
    budgetId,
    {
      is_needs_recalculation: true,
      month_map: cleanedMonthMap,
      updated_at: new Date().toISOString(),
    },
    `marking budget and ${markedCount} future months as needing recalculation`
  )

  return {
    markedCount,
    budgetUpdated: true,
  }
}

/**
 * Mark a specific month as needing recalculation (used when creating a new month).
 * Does NOT mark other months - only adds/updates a single month entry.
 *
 * @param budgetId - The budget ID
 * @param year - Year of the month to mark
 * @param month - Month to mark (1-12)
 * @param needsRecalculation - Whether the month needs recalculation
 */
export async function setMonthInBudgetMap(
  budgetId: string,
  year: number,
  month: number,
  needsRecalculation: boolean = false
): Promise<void> {
  const monthOrdinal = getYearMonthOrdinal(year, month)

  // Read current budget to get existing month_map
  const { exists, data: budgetData } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    'reading budget for month_map update (add month)'
  )

  if (!exists || !budgetData) {
    console.warn(`[setMonthInBudgetMap] Budget ${budgetId} not found`)
    return
  }

  // Parse existing month_map
  const existingMonthMap: MonthMap = budgetData.month_map || {}

  // Add/update the month entry
  const updatedMonthMap: MonthMap = {
    ...existingMonthMap,
    [monthOrdinal]: { needs_recalculation: needsRecalculation },
  }

  // Clean up old months outside the window
  const cleanedMonthMap = cleanupMonthMap(updatedMonthMap)

  // Update cache
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      monthMap: cleanedMonthMap,
      budget: {
        ...cachedBudget.budget,
        month_map: cleanedMonthMap,
      },
    })
  }

  // Write to Firestore
  await updateDocByPath(
    'budgets',
    budgetId,
    {
      month_map: cleanedMonthMap,
      updated_at: new Date().toISOString(),
    },
    `adding month ${year}/${month} to budget month_map`
  )
}

