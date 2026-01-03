/**
 * Trigger Recalculation - Main entry point for the recalculation process.
 * Called when readBudget detects is_needs_recalculation = true.
 * Uses month_map to determine which months need recalculation, then walks forward
 * from the first stale month recalculating each and updating balances.
 */

import type { FirestoreData, MonthDocument, MonthMap } from '@types'
import { readDocByPath, writeDocByPath, batchWriteDocs, type BatchWriteDoc } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'
import type { MonthQueryData } from '../queries/month'

// Track in-progress recalculations to prevent duplicates when multiple components detect stale data
const inProgressRecalculations = new Map<string, Promise<RecalculationResult>>()

/**
 * Progress information for recalculation.
 * Reported via onProgress callback during recalculation.
 */
export interface RecalculationProgress {
  /** Current phase of recalculation */
  phase: 'reading-budget' | 'fetching-months' | 'recalculating' | 'saving' | 'complete'
  /** Human-readable label for current month being processed */
  currentMonth?: string
  /** Number of months fetched so far (during fetching-months phase) */
  monthsFetched?: number
  /** Total number of months to fetch (during fetching-months phase) */
  totalMonthsToFetch?: number
  /** Number of months processed so far */
  monthsProcessed: number
  /** Total number of months to process */
  totalMonths: number
  /** Percentage complete (0-100) */
  percentComplete: number
}

interface TriggerRecalculationOptions {
  /**
   * Month ordinal (YYYYMM format) that triggered this recalculation.
   * Used to optimize the query - we only fetch months from this point forward.
   * If not provided, defaults to current calendar month.
   */
  triggeringMonthOrdinal?: string
  /**
   * Optional callback to report progress during recalculation.
   */
  onProgress?: (progress: RecalculationProgress) => void
}

interface RecalculationResult {
  /** Number of months recalculated */
  monthsRecalculated: number
  /** Whether the budget was updated */
  budgetUpdated: boolean
  /** The final account balances (if budget was updated) */
  finalAccountBalances?: Record<string, number>
}

// Budget document structure from Firestore
interface BudgetDocument {
  name: string
  user_ids: string[]
  accepted_user_ids: string[]
  owner_id: string
  owner_email: string | null
  accounts: FirestoreData
  account_groups: FirestoreData
  categories: FirestoreData
  category_groups: FirestoreData[]
  total_available?: number
  is_needs_recalculation?: boolean
  month_map?: FirestoreData
  created_at?: string
  updated_at?: string
}

type MonthWithId = MonthDocument & { id: string }

// === HELPERS ===

function parseOrdinal(ordinal: string): { year: number; month: number } {
  return { year: parseInt(ordinal.slice(0, 4), 10), month: parseInt(ordinal.slice(4, 6), 10) }
}

function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  Object.entries(monthMapData).forEach(([ordinal, info]) => {
    monthMap[ordinal] = { needs_recalculation: (info as { needs_recalculation?: boolean })?.needs_recalculation ?? false }
  })
  return monthMap
}

function getMonthsNeedingRecalc(monthMap: MonthMap): string[] {
  return Object.entries(monthMap).filter(([, info]) => info.needs_recalculation).map(([ordinal]) => ordinal).sort()
}

function getAllMonthOrdinals(monthMap: MonthMap): string[] {
  return Object.keys(monthMap).sort()
}

async function fetchMonth(budgetId: string, ordinal: string): Promise<MonthWithId | null> {
  const { year, month } = parseOrdinal(ordinal)
  const monthDocId = getMonthDocId(budgetId, year, month)
  const { exists, data } = await readDocByPath<FirestoreData>('months', monthDocId, `[recalc] fetching month ${year}/${month}`)
  if (!exists || !data) return null
  return {
    id: monthDocId,
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

async function fetchMonthsByOrdinals(
  budgetId: string,
  ordinals: string[],
  onFetchProgress?: (fetched: number, total: number) => void
): Promise<MonthWithId[]> {
  // Fetch all months in parallel for better performance
  onFetchProgress?.(0, ordinals.length)

  const results = await Promise.all(
    ordinals.map(ordinal => fetchMonth(budgetId, ordinal))
  )

  onFetchProgress?.(ordinals.length, ordinals.length)

  // Filter out nulls (months that don't exist) and maintain order
  return results.filter((month): month is MonthWithId => month !== null)
}

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

/** Month name constants for progress reporting */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

  // Step 3: Only fetch months we actually need:
  // - The month before first stale (for snapshot) - if it exists
  // - All months from first stale onwards
  const ordinalsToFetch = hasStartingMonth
    ? allOrdinals.slice(firstStaleOrdinalIndex - 1)
    : allOrdinals.slice(firstStaleOrdinalIndex)

  // Estimate months to recalculate (all fetched minus the starting snapshot month if present)
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
    // Fetching phase goes from 10% to 30% of overall progress
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
  // If we have a starting month, it's at index 0 of our fetched array, stale months start at 1
  // If no starting month, stale months start at 0
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

    // Recalculate this month (in memory only)
    const recalculated = recalculateMonth(month, prevSnapshot)
    recalculatedMonths.push(recalculated)

    // Update snapshot for next iteration
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

  // Prepare batch write documents
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

  // prevSnapshot now contains the final balances from the last processed month
  const finalAccountBalances = prevSnapshot.accountEndBalances
  const finalCategoryBalances = prevSnapshot.categoryEndBalances

  // Update budget with final balances and clear all recalc flags in month_map
  await updateBudgetBalances(
    budgetId,
    finalAccountBalances,
    finalCategoryBalances,
    monthMap
  )

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

// === BUDGET UPDATE HELPERS ===

function clearMonthMapFlags(monthMap: MonthMap): MonthMap {
  const cleared: MonthMap = {}
  for (const ordinal of Object.keys(monthMap)) cleared[ordinal] = { needs_recalculation: false }
  return cleared
}

function calculateTotalAvailable(accounts: FirestoreData, categories: FirestoreData, accountGroups: FirestoreData): number {
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)
    return (effectiveOnBudget && effectiveActive) ? sum + (account.balance ?? 0) : sum
  }, 0)
  const totalPositiveCategoryBalances = Object.values(categories).reduce((sum, cat) => {
    const balance = (cat as { balance?: number }).balance ?? 0
    return sum + (balance > 0 ? balance : 0)
  }, 0)
  return onBudgetAccountTotal - totalPositiveCategoryBalances
}

async function updateBudgetBalances(budgetId: string, accountBalances: Record<string, number>, categoryBalances: Record<string, number>, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>('budgets', budgetId, '[recalc] reading budget for balance update')
  if (!exists || !data) return

  const updatedAccounts = { ...data.accounts }
  for (const [accountId, balance] of Object.entries(accountBalances)) {
    if (updatedAccounts[accountId]) updatedAccounts[accountId] = { ...updatedAccounts[accountId], balance }
  }
  const updatedCategories = { ...data.categories }
  for (const [categoryId, balance] of Object.entries(categoryBalances)) {
    if (updatedCategories[categoryId]) updatedCategories[categoryId] = { ...updatedCategories[categoryId], balance }
  }

  const clearedMonthMap = clearMonthMapFlags(monthMap)
  const totalAvailable = calculateTotalAvailable(updatedAccounts, updatedCategories, data.account_groups || {})

  await writeDocByPath('budgets', budgetId, {
    ...data,
    accounts: updatedAccounts,
    categories: updatedCategories,
    total_available: totalAvailable,
    is_needs_recalculation: false,
    month_map: clearedMonthMap,
    updated_at: new Date().toISOString(),
  }, '[recalc] saving balances and clearing flags')

  // Update cache with the new balances (not just flags)
  updateBudgetCacheWithBalances(budgetId, updatedAccounts, updatedCategories, totalAvailable, clearedMonthMap)
}

function updateBudgetCache(budgetId: string, clearedMonthMap: MonthMap): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      isNeedsRecalculation: false,
      monthMap: clearedMonthMap,
      budget: { ...cachedBudget.budget, is_needs_recalculation: false, month_map: clearedMonthMap },
    })
  }
}

/**
 * Update the budget cache with new account/category balances after recalculation.
 * This ensures the UI reflects the new balances without needing to re-fetch.
 */
function updateBudgetCacheWithBalances(
  budgetId: string,
  updatedAccounts: FirestoreData,
  updatedCategories: FirestoreData,
  totalAvailable: number,
  clearedMonthMap: MonthMap
): void {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    // Build updated accounts map with new balances
    const newAccounts: Record<string, BudgetData['accounts'][string]> = {}
    for (const [id, acc] of Object.entries(cachedBudget.accounts)) {
      const updatedAcc = updatedAccounts[id]
      newAccounts[id] = updatedAcc ? { ...acc, balance: updatedAcc.balance ?? acc.balance } : acc
    }

    // Build updated categories map with new balances
    const newCategories: Record<string, BudgetData['categories'][string]> = {}
    for (const [id, cat] of Object.entries(cachedBudget.categories)) {
      const updatedCat = updatedCategories[id]
      newCategories[id] = updatedCat ? { ...cat, balance: updatedCat.balance ?? cat.balance } : cat
    }

    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: newAccounts,
      categories: newCategories,
      isNeedsRecalculation: false,
      monthMap: clearedMonthMap,
      budget: {
        ...cachedBudget.budget,
        accounts: updatedAccounts,
        categories: updatedCategories,
        total_available: totalAvailable,
        is_needs_recalculation: false,
        month_map: clearedMonthMap,
      },
    })
  }
}

async function clearBudgetRecalcFlag(budgetId: string, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>('budgets', budgetId, '[recalc] reading budget to clear flags')
  if (!exists || !data) return

  const clearedMonthMap = clearMonthMapFlags(monthMap)
  await writeDocByPath('budgets', budgetId, {
    ...data,
    total_available: calculateTotalAvailable(data.accounts || {}, data.categories || {}, data.account_groups || {}),
    is_needs_recalculation: false,
    month_map: clearedMonthMap,
    updated_at: new Date().toISOString(),
  }, '[recalc] clearing flags')
  updateBudgetCache(budgetId, clearedMonthMap)
}
