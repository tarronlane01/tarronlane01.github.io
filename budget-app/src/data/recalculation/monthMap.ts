/**
 * Month Map Management
 *
 * Manages the budget's month_map structure, which tracks which months exist in the budget.
 * The month_map is used to determine which months to recalculate and display.
 *
 * WHEN TO CALL:
 * - After any month data changes that affect current or future months' balances
 * - Called automatically by writeMonthData
 */

import { readDocByPath, updateDocByPath } from '@firestore'
import type { FirestoreData, MonthMap } from '@types'
import { getYearMonthOrdinal } from '@utils'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import {
  getMonthWindowOrdinals,
  areAllFutureMonthsInCache,
  updateCacheWithMonthMap,
  updateCacheWithSingleMonth,
  updateCacheWithAllMonths,
} from './monthMapHelpers'

// ============================================================================
// TYPES
// ============================================================================

export interface AddMonthsResult {
  /** Number of months added to the map */
  addedCount: number
  /** Whether the budget was updated */
  budgetUpdated: boolean
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Ensure months are in the month_map when data changes.
 * Adds the edited month and all future months to the map.
 *
 * @param budgetId - The budget ID
 * @param currentYear - Year of the month that was edited
 * @param currentMonth - Month that was edited (1-12)
 * @returns Summary of the operation
 */
export async function ensureMonthsInMap(
  budgetId: string,
  currentYear: number,
  currentMonth: number
): Promise<AddMonthsResult> {
  const editedMonthOrdinal = getYearMonthOrdinal(currentYear, currentMonth)

  // OPTIMIZATION: Check if all future months are already in cache
  if (areAllFutureMonthsInCache(budgetId, editedMonthOrdinal)) {
    return { addedCount: 0, budgetUpdated: false }
  }

  // CRITICAL: Check React Query cache first to use cached budget data
  // This prevents duplicate reads when budget is already in cache
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  
  let budgetData: FirestoreData | null = null
  if (cachedBudget?.budget) {
    // Use cached budget data
    budgetData = cachedBudget.budget as unknown as FirestoreData
  } else {
    // Not in cache - read from Firestore
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets', budgetId, 'reading budget for month_map update'
    )
    if (!exists || !data) {
      console.warn(`[ensureMonthsInMap] Budget ${budgetId} not found`)
      return { addedCount: 0, budgetUpdated: false }
    }
    budgetData = data
  }

  // Parse existing month_map
  const existingMonthMap: MonthMap = budgetData.month_map || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }
  const windowOrdinals = getMonthWindowOrdinals()

  // CRITICAL: Always ensure the edited month itself is in the map (even if outside window)
  // This prevents gaps when writing months outside the window
  let addedCount = 0
  if (!(editedMonthOrdinal in updatedMonthMap)) {
    updatedMonthMap[editedMonthOrdinal] = {}
    addedCount++
  }

  // Ensure all window months >= edited month exist in the map (just add them if missing)
  for (const ordinal of windowOrdinals) {
    if (ordinal >= editedMonthOrdinal && !(ordinal in updatedMonthMap)) {
      updatedMonthMap[ordinal] = {}
      addedCount++
    }
  }

  // If nothing changed, skip the write
  if (addedCount === 0) {
    return { addedCount: 0, budgetUpdated: false }
  }

  // Update cache before writing to Firestore
  updateCacheWithMonthMap(budgetId, editedMonthOrdinal, updatedMonthMap)

  // Write to Firestore - only update month_map
  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding ${addedCount} month(s) to budget month_map`)

  // Note: updateCacheWithMonthMap (called above) updates the React Query cache via setQueryData,
  // which should trigger re-renders in components using useBudgetData/useBudgetQuery.
  // No invalidation needed - the cache update is sufficient.

  return { addedCount, budgetUpdated: true }
}

/**
 * Ensure multiple months are in the month_map (used after batch writes).
 * Adds all provided months to the map if they're missing.
 *
 * @param budgetId - The budget ID
 * @param months - Array of {year, month} to ensure are in the map
 * @returns Summary of the operation
 */
export async function ensureMonthsInMapBatch(
  budgetId: string,
  months: Array<{ year: number; month: number }>
): Promise<AddMonthsResult> {
  if (months.length === 0) {
    return { addedCount: 0, budgetUpdated: false }
  }

  // CRITICAL: Check React Query cache first to use cached budget data
  // This prevents duplicate reads when budget is already in cache
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  
  let budgetData: FirestoreData | null = null
  if (cachedBudget?.budget) {
    // Use cached budget data
    budgetData = cachedBudget.budget as unknown as FirestoreData
  } else {
    // Not in cache - read from Firestore
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets', budgetId, 'reading budget for batch month_map update'
    )
    if (!exists || !data) {
      console.warn(`[ensureMonthsInMapBatch] Budget ${budgetId} not found`)
      return { addedCount: 0, budgetUpdated: false }
    }
    budgetData = data
  }

  // Parse existing month_map
  const existingMonthMap: MonthMap = budgetData.month_map || {}
  const updatedMonthMap: MonthMap = { ...existingMonthMap }

  // Add all provided months to the map if missing
  let addedCount = 0
  for (const { year, month } of months) {
    const ordinal = getYearMonthOrdinal(year, month)
    if (!(ordinal in updatedMonthMap)) {
      updatedMonthMap[ordinal] = {}
      addedCount++
    }
  }

  // If nothing changed, skip the write
  if (addedCount === 0) {
    return { addedCount: 0, budgetUpdated: false }
  }

  // Update cache before writing to Firestore
  updateCacheWithAllMonths(budgetId, updatedMonthMap)

  // Write to Firestore - only update month_map
  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding ${addedCount} month(s) to budget month_map (batch)`)

  return { addedCount, budgetUpdated: true }
}

/**
 * Add a specific month to the month_map (used when creating a new month).
 * Does NOT add other months - only adds/updates a single month entry.
 */
export async function addMonthToMap(
  budgetId: string,
  year: number,
  month: number
): Promise<void> {
  const monthOrdinal = getYearMonthOrdinal(year, month)

  // CRITICAL: Check React Query cache first to use cached budget data
  // This prevents duplicate reads when budget is already in cache
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  
  let budgetData: FirestoreData | null = null
  if (cachedBudget?.budget) {
    // Use cached budget data
    budgetData = cachedBudget.budget as unknown as FirestoreData
  } else {
    // Not in cache - read from Firestore
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets', budgetId, 'reading budget for month_map update (add month)'
    )
    if (!exists || !data) {
      console.warn(`[addMonthToMap] Budget ${budgetId} not found`)
      return
    }
    budgetData = data
  }

  const existingMonthMap: MonthMap = budgetData.month_map || {}
  // Only add if not already present
  if (monthOrdinal in existingMonthMap) {
    return // Already in map
  }

  const updatedMonthMap: MonthMap = { ...existingMonthMap, [monthOrdinal]: {} }

  updateCacheWithSingleMonth(budgetId, updatedMonthMap)

  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding month ${year}/${month} to budget month_map`)
}

// ============================================================================
// ADD ALL MONTHS FROM STARTING POINT (FOR HISTORICAL IMPORTS)
// ============================================================================

/**
 * Add all existing months from a starting point onwards to the month_map.
 * Used after seed data import to ensure month_map is up to date.
 */
export async function addAllMonthsFromOrdinal(
  budgetId: string,
  startingYear: number,
  startingMonth: number
): Promise<AddMonthsResult> {
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

  // CRITICAL: Check React Query cache first to use cached budget data
  // This prevents duplicate reads when budget is already in cache
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)
  
  let budgetData: FirestoreData | null = null
  if (cachedBudget?.budget) {
    // Use cached budget data
    budgetData = cachedBudget.budget as unknown as FirestoreData
  } else {
    // Not in cache - read from Firestore
    const { exists, data } = await readDocByPath<FirestoreData>(
      'budgets', budgetId, 'reading budget for historical month map update'
    )
    if (!exists || !data) {
      console.warn(`[addAllMonthsFromOrdinal] Budget ${budgetId} not found`)
      return { addedCount: 0, budgetUpdated: false }
    }
    budgetData = data
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
    return { addedCount: 0, budgetUpdated: false }
  }

  updateCacheWithAllMonths(budgetId, updatedMonthMap)

  await updateDocByPath('budgets', budgetId, {
    month_map: updatedMonthMap,
    updated_at: new Date().toISOString(),
  }, `adding ${addedCount} months from ${startingYear}/${startingMonth} to month_map`)

  return { addedCount, budgetUpdated: true }
}
