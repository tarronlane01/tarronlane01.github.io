/**
 * Trigger Recalculation - Main entry point for the recalculation process.
 * Called when readBudget detects is_needs_recalculation = true.
 * Uses month_map to determine which months need recalculation, then walks forward
 * from the first stale month recalculating each and updating balances.
 */

import type { FirestoreData, MonthDocument } from '@types'
import { readDocByPath, batchWriteDocs, type BatchWriteDoc } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { MAX_FUTURE_MONTHS } from '@constants'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
import { queryClient, queryKeys } from '../queryClient'
import type { MonthQueryData } from '../queries/month'
import { calculateTotalBalances } from '../cachedReads'
import { runRecalculationAssertions, logAssertionResults } from './assertions'
import { bannerQueue } from '@components/ui'

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
  getMonthsNeedingRecalc,
  getAllMonthOrdinals,
  fetchMonthsByOrdinals,
  clearBudgetRecalcFlag,
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

  const { exists: budgetExists, data: budgetData } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[recalc] reading budget for month_map'
  )

  if (!budgetExists || !budgetData) {
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  const monthMap = parseMonthMap(budgetData.month_map)
  const monthsNeedingRecalc = getMonthsNeedingRecalc(monthMap)

  if (monthsNeedingRecalc.length === 0 && !budgetData.is_needs_recalculation) {
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  // Step 2: Determine which months to fetch (optimization: don't fetch months we don't need)
  const allOrdinals = getAllMonthOrdinals(monthMap)
  const firstStaleOrdinal = monthsNeedingRecalc.length > 0 ? monthsNeedingRecalc[0] : null

  if (!firstStaleOrdinal) {
    await clearBudgetRecalcFlag(budgetId, monthMap)
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: true }
  }

  // Find the ordinal before the first stale month (for starting snapshot)
  const firstStaleOrdinalIndex = allOrdinals.indexOf(firstStaleOrdinal)
  const hasStartingMonth = firstStaleOrdinalIndex > 0

  // Step 3: Only fetch months we actually need
  let ordinalsToFetch = hasStartingMonth
    ? allOrdinals.slice(firstStaleOrdinalIndex - 1)
    : allOrdinals.slice(firstStaleOrdinalIndex)

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
    await clearBudgetRecalcFlag(budgetId, monthMap)
    onProgress?.({ phase: 'complete', monthsProcessed: 0, totalMonths: 0, percentComplete: 100 })
    return { monthsRecalculated: 0, budgetUpdated: true }
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
  onProgress?.({
    phase: 'saving',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 75,
  })

  const batchDocs: BatchWriteDoc[] = recalculatedMonths.map(month => ({
    collectionPath: 'months',
    docId: getMonthDocId(budgetId, month.year, month.month),
    data: month as unknown as FirestoreData,
  }))

  await batchWriteDocs(batchDocs, `[recalc] batch write ${recalculatedMonths.length} months`)

  // Update query cache for each recalculated month
  for (const month of recalculatedMonths) {
    queryClient.setQueryData<MonthQueryData>(
      queryKeys.month(budgetId, month.year, month.month),
      { month }
    )
  }

  // Step 7: Update budget with final balances and clear all recalc flags
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

  // Step 8: Run assertions to validate recalculation
  onProgress?.({
    phase: 'validating',
    monthsProcessed: monthsRecalculated,
    totalMonths: totalToRecalculate,
    percentComplete: 95,
  })

  // Read updated budget data for assertions
  const { data: updatedBudgetData } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[recalc] reading budget for assertions'
  )

  if (updatedBudgetData) {
    const assertionResults = await runRecalculationAssertions({
      budgetId,
      categories: updatedBudgetData.categories || {},
      totalAvailable: updatedBudgetData.total_available ?? 0,
      currentYear,
      currentMonth,
    })

    // Log results and show banners for failures
    const banners = logAssertionResults(assertionResults, '[Recalculation]')
    banners.forEach(banner => bannerQueue.add(banner))
  }

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
