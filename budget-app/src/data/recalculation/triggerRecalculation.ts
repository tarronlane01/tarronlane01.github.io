/**
 * Trigger Recalculation - Main entry point for the recalculation process.
 * Called manually or on-demand when recalculation is needed.
 * Uses month_map to determine which months to recalculate, then walks forward
 * from the first month recalculating each and updating balances.
 */

import type { FirestoreData, MonthDocument } from '@types'
import { readDocByPath, batchWriteDocs, type BatchWriteDoc } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { MAX_FUTURE_MONTHS } from '@constants'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
import type { MonthQueryData } from '../queries/month'
import { calculateTotalBalances } from '../cachedReads'

// Import types
import type {
  RecalculationProgress,
  TriggerRecalculationOptions,
  RecalculationResult,
  BudgetDocument,
} from './triggerRecalculationTypes'
import { MONTH_NAMES } from './triggerRecalculationTypes'

// Import helpers
import {
  parseMonthMap,
  getAllMonthOrdinals,
  fetchMonthsByOrdinals,
  updateBudgetBalances,
} from './triggerRecalculationHelpers'

// Re-export types for consumers
export type { RecalculationProgress, TriggerRecalculationOptions, RecalculationResult }

// Track in-progress recalculations to prevent duplicates when multiple components detect stale data
const inProgressRecalculations = new Map<string, Promise<RecalculationResult>>()

// === MAIN FUNCTION ===

/**
 * Trigger the recalculation process.
 *
 * This function is deduplicated per budget - if a recalculation is already
 * in progress for a budget, subsequent calls will wait for and share the result.
 *
 * @param budgetId - The budget ID
 * @param options - Optional configuration
 * @returns Result of the recalculation
 */
export async function triggerRecalculation(
  budgetId: string,
  options: TriggerRecalculationOptions = {}
): Promise<RecalculationResult> {
  // Check if recalculation is already in progress for this budget
  const existing = inProgressRecalculations.get(budgetId)
  if (existing) {
    return existing
  }

  // Create the recalculation promise and track it
  const recalcPromise = executeRecalculation(budgetId, options)
  inProgressRecalculations.set(budgetId, recalcPromise)

  try {
    return await recalcPromise
  } finally {
    // Clean up tracking once complete (success or failure)
    inProgressRecalculations.delete(budgetId)
  }
}

/**
 * Internal implementation of recalculation.
 * Called by triggerRecalculation after deduplication check.
 */
async function executeRecalculation(
  budgetId: string,
  options: TriggerRecalculationOptions = {}
): Promise<RecalculationResult> {
  const { onProgress } = options

  // Step 1: Read budget to get month_map
  onProgress?.({
    phase: 'reading-budget',
    monthsProcessed: 0,
    totalMonths: 0,
    percentComplete: 5,
  })

  // CRITICAL: Check React Query cache first to use cached budget data
  // This prevents duplicate reads when budget is already in cache
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  let budgetData: BudgetDocument | null = null
  
  if (cachedBudget?.budget) {
    // Use cached budget data
    budgetData = cachedBudget.budget as unknown as BudgetDocument
  } else {
    // Not in cache - read from Firestore
    const { exists, data } = await readDocByPath<BudgetDocument>(
      'budgets',
      budgetId,
      '[recalc] reading budget for month_map'
    )
    if (!exists || !data) {
      onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
      return { monthsRecalculated: 0, budgetUpdated: false }
    }
    budgetData = data
  }

  const monthMap = parseMonthMap(budgetData.month_map)
  
  // Step 2: Determine which months to fetch (all months in the window)
  // Since we don't track flags, we recalculate all months in the window when called
  const allOrdinals = getAllMonthOrdinals(monthMap)
  
  // If no months in map, nothing to recalculate
  if (allOrdinals.length === 0) {
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  // Step 3: Fetch all months in the map (or use triggering month if specified)
  const triggeringOrdinal = options.triggeringMonthOrdinal
  let ordinalsToFetch: string[]
  
  if (triggeringOrdinal) {
    // Recalculate from triggering month onwards
    const triggeringIndex = allOrdinals.indexOf(triggeringOrdinal)
    const hasStartingMonth = triggeringIndex > 0
    ordinalsToFetch = hasStartingMonth
      ? allOrdinals.slice(triggeringIndex - 1)
      : allOrdinals.slice(triggeringIndex)
  } else {
    // Recalculate all months in the map
    ordinalsToFetch = allOrdinals
  }
  
  const hasStartingMonth = ordinalsToFetch.length > 0 && allOrdinals.indexOf(ordinalsToFetch[0]) > 0

  // Filter out months that are too far in the future (beyond MAX_FUTURE_MONTHS)
  // These months may be in the monthMap but don't exist in Firestore yet
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const maxFutureOrdinal = getYearMonthOrdinal(
    currentYear + Math.floor((currentMonth + MAX_FUTURE_MONTHS - 1) / 12),
    ((currentMonth + MAX_FUTURE_MONTHS - 1) % 12) + 1
  )
  
  ordinalsToFetch = ordinalsToFetch.filter(ordinal => ordinal <= maxFutureOrdinal)

  const estimatedToRecalculate = hasStartingMonth ? ordinalsToFetch.length - 1 : ordinalsToFetch.length

  onProgress?.({
    phase: 'fetching-months',
    monthsFetched: 0,
    totalMonthsToFetch: ordinalsToFetch.length,
    monthsProcessed: 0,
    totalMonths: estimatedToRecalculate,
    percentComplete: 10,
  })

  const months = await fetchMonthsByOrdinals(budgetId, ordinalsToFetch, (fetched, total) => {
    const fetchPercent = fetched === 0 ? 10 : 30
    onProgress?.({
      phase: 'fetching-months',
      monthsFetched: fetched,
      totalMonthsToFetch: total,
      monthsProcessed: 0,
      totalMonths: estimatedToRecalculate,
      percentComplete: fetchPercent,
    })
  })

  if (months.length === 0) {
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  // Step 4: Determine recalculation bounds
  const firstRecalcIndex = hasStartingMonth ? 1 : 0
  const lastRecalcIndex = months.length - 1
  const totalToRecalculate = lastRecalcIndex - firstRecalcIndex + 1

  // Get the starting snapshot from the month before first stale
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  if (hasStartingMonth && months.length > 0) {
    prevSnapshot = extractSnapshotFromMonth(months[0])
  }

  // Step 5: Pre-compute all recalculated months in memory
  const recalculatedMonths: MonthDocument[] = []
  let monthsRecalculated = 0

  for (let i = firstRecalcIndex; i <= lastRecalcIndex; i++) {
    const month = months[i]
    const monthLabel = `${MONTH_NAMES[month.month - 1]} ${month.year}`

    onProgress?.({
      phase: 'recalculating',
      currentMonth: monthLabel,
      monthsProcessed: monthsRecalculated,
      totalMonths: totalToRecalculate,
      percentComplete: Math.round(30 + (monthsRecalculated / totalToRecalculate) * 40),
    })

    const recalculated = recalculateMonth(month, prevSnapshot)
    recalculatedMonths.push(recalculated)

    prevSnapshot = extractSnapshotFromMonth(recalculated)
    monthsRecalculated++
  }

  // Step 6: Batch write all recalculated months to Firestore
  // Convert to stored format before writing (only saves start_balance for months at/before window)
  onProgress?.({
    phase: 'saving',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 75,
  })

  const { convertMonthBalancesToStored } = await import('@data/firestore/converters/monthBalances')
  const storedMonths = recalculatedMonths.map(month => convertMonthBalancesToStored(month))

  const batchDocs: BatchWriteDoc[] = storedMonths.map(month => ({
    collectionPath: 'months',
    docId: getMonthDocId(budgetId, month.year, month.month),
    data: month as unknown as FirestoreData,
  }))

  await batchWriteDocs(batchDocs, `[recalc] batch write ${recalculatedMonths.length} months`)

  // CRITICAL: Ensure all recalculated months are in month_map to prevent gaps
  const { ensureMonthsInMapBatch } = await import('./monthMap')
  const monthsToEnsure = recalculatedMonths.map(m => ({ year: m.year, month: m.month }))
  try {
    await ensureMonthsInMapBatch(budgetId, monthsToEnsure)
  } catch (error) {
    // Log but don't throw - month_map update is important but shouldn't fail the recalculation
    console.warn(`[triggerRecalculation] Failed to update month_map:`, error)
  }

  // Update query cache for each recalculated month
  for (const month of recalculatedMonths) {
    queryClient.setQueryData<MonthQueryData>(
      queryKeys.month(budgetId, month.year, month.month),
      { month }
    )
  }

  // Step 7: Update budget with final balances
  onProgress?.({
    phase: 'saving',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 92,
  })

  const finalAccountBalances = prevSnapshot.accountEndBalances
  
  // Calculate total category balances (including future allocations) to match what's stored in budget document
  // The budget document stores total balances (all-time including future), not just current month's end_balance
  const currentCategoryBalances = prevSnapshot.categoryEndBalances
  const categoryIds = Object.keys(budgetData.categories || {})
  const finalCategoryBalances = await calculateTotalBalances(
    budgetId,
    categoryIds,
    currentCategoryBalances,
    currentYear,
    currentMonth
  )

  await updateBudgetBalances(
    budgetId,
    finalAccountBalances,
    finalCategoryBalances,
    monthMap
  )

  onProgress?.({
    phase: 'validating',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 95,
  })

  // Assertions removed - no longer needed with new calculation approach
  // if (updatedBudgetData) {
  //   const assertionResults = await runRecalculationAssertions({...})
  //   const banners = logAssertionResults(assertionResults, '[Recalculation]')
  //   banners.forEach(banner => bannerQueue.add(banner))
  // }

  onProgress?.({
    phase: 'complete',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 100,
  })

  return {
    monthsRecalculated,
    budgetUpdated: true,
    finalAccountBalances,
  }
}
