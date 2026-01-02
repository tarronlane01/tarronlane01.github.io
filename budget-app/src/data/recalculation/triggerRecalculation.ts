/**
 * Trigger Recalculation
 *
 * Main entry point for the recalculation process.
 * Called when readBudget detects is_needs_recalculation = true.
 *
 * ALGORITHM:
 * 1. Read budget document to get month_map (index of recent months)
 * 2. Use month_map to determine which months need recalculation
 * 3. Fetch those months from Firestore
 * 4. Walk backwards from the first stale month to find the last valid month
 * 5. Walk forward from starting point, calling recalculateMonth for each
 * 6. Update budget with final balances and clear all recalc flags in month_map
 *
 * @param budgetId - The budget ID
 * @param targetMonthOrdinal - Optional month ordinal (YYYYMM) that triggered this
 *                             If provided, only recalculate up to this month
 *                             If not provided (budget-triggered), recalculate all
 */

import type { FirestoreData, MonthDocument, MonthMap } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { writeMonthData } from '../mutations/month'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from './recalculateMonth'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/budget'

// ============================================================================
// DEDUPLICATION - Prevent multiple simultaneous recalculations
// ============================================================================

/**
 * Track in-progress recalculations per budget.
 * Maps budgetId -> Promise of the recalculation in progress.
 * This prevents duplicate recalculations when multiple components
 * (e.g., MonthCategories and MonthAccounts) detect the need simultaneously.
 */
const inProgressRecalculations = new Map<string, Promise<RecalculationResult>>()

// ============================================================================
// TYPES
// ============================================================================

interface TriggerRecalculationOptions {
  /**
   * Month ordinal (YYYYMM format) that triggered this recalculation.
   * Used to optimize the query - we only fetch months from this point forward.
   * If not provided, defaults to current calendar month.
   */
  triggeringMonthOrdinal?: string
}

interface RecalculationResult {
  /** Number of months recalculated */
  monthsRecalculated: number
  /** Whether the budget was updated */
  budgetUpdated: boolean
  /** The final account balances (if budget was updated) */
  finalAccountBalances?: Record<string, number>
}

// Raw budget document structure from Firestore
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

/** Month document with its Firestore document ID */
type MonthWithId = MonthDocument & { id: string }

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse an ordinal string (YYYYMM) into year and month.
 */
function parseOrdinal(ordinal: string): { year: number; month: number } {
  const year = parseInt(ordinal.slice(0, 4), 10)
  const month = parseInt(ordinal.slice(4, 6), 10)
  return { year, month }
}

/**
 * Parse raw month_map data from Firestore into typed MonthMap.
 */
function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  Object.entries(monthMapData).forEach(([ordinal, info]) => {
    const infoData = info as { needs_recalculation?: boolean } | undefined
    monthMap[ordinal] = {
      needs_recalculation: infoData?.needs_recalculation ?? false,
    }
  })
  return monthMap
}

/**
 * Get sorted list of month ordinals that need recalculation.
 */
function getMonthsNeedingRecalc(monthMap: MonthMap): string[] {
  return Object.entries(monthMap)
    .filter(([, info]) => info.needs_recalculation)
    .map(([ordinal]) => ordinal)
    .sort()
}

/**
 * Get all month ordinals from the month_map, sorted chronologically.
 */
function getAllMonthOrdinals(monthMap: MonthMap): string[] {
  return Object.keys(monthMap).sort()
}

/**
 * Fetch a single month document from Firestore.
 */
async function fetchMonth(
  budgetId: string,
  ordinal: string
): Promise<MonthWithId | null> {
  const { year, month } = parseOrdinal(ordinal)
  const monthDocId = getMonthDocId(budgetId, year, month)

  const { exists, data } = await readDocByPath<FirestoreData>(
    'months',
    monthDocId,
    `[recalc] fetching month ${year}/${month}`
  )

  if (!exists || !data) {
    return null
  }

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

/**
 * Fetch only the months needed for recalculation.
 * This avoids fetching months before the starting point.
 *
 * @param budgetId - The budget ID
 * @param ordinals - List of month ordinals to fetch
 * @returns Array of month documents
 */
async function fetchMonthsByOrdinals(
  budgetId: string,
  ordinals: string[]
): Promise<MonthWithId[]> {
  const months: MonthWithId[] = []

  for (const ordinal of ordinals) {
    const month = await fetchMonth(budgetId, ordinal)
    if (month) {
      months.push(month)
    }
  }

  return months
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: TriggerRecalculationOptions = {}
): Promise<RecalculationResult> {
  // Step 1: Read budget to get month_map
  const { exists: budgetExists, data: budgetData } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[recalc] reading budget for month_map'
  )

  if (!budgetExists || !budgetData) {
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  const monthMap = parseMonthMap(budgetData.month_map)
  const monthsNeedingRecalc = getMonthsNeedingRecalc(monthMap)

  if (monthsNeedingRecalc.length === 0 && !budgetData.is_needs_recalculation) {
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  // Step 2: Determine which months to fetch (optimization: don't fetch months we don't need)
  const allOrdinals = getAllMonthOrdinals(monthMap)
  const firstStaleOrdinal = monthsNeedingRecalc.length > 0 ? monthsNeedingRecalc[0] : null

  if (!firstStaleOrdinal) {
    await clearBudgetRecalcFlag(budgetId, monthMap)
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

  const months = await fetchMonthsByOrdinals(budgetId, ordinalsToFetch)

  if (months.length === 0) {
    await clearBudgetRecalcFlag(budgetId, monthMap)
    return { monthsRecalculated: 0, budgetUpdated: true }
  }

  // Step 4: Determine recalculation bounds
  // If we have a starting month, it's at index 0 of our fetched array, stale months start at 1
  // If no starting month, stale months start at 0
  const firstRecalcIndex = hasStartingMonth ? 1 : 0
  const lastRecalcIndex = months.length - 1

  // Get the starting snapshot from the month before first stale
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  if (hasStartingMonth && months.length > 0) {
    prevSnapshot = extractSnapshotFromMonth(months[0])
  }

  // Step 5: Walk forward and recalculate each month
  let monthsRecalculated = 0

  for (let i = firstRecalcIndex; i <= lastRecalcIndex; i++) {
    const month = months[i]

    // Recalculate this month
    const recalculated = recalculateMonth(month, prevSnapshot)

    // Save to Firestore with cascadeRecalculation disabled
    // We're handling the recalculation ourselves, no need to mark future months
    await writeMonthData({
      budgetId,
      month: recalculated,
      description: `[recalc] month ${month.year}/${month.month}`,
      cascadeRecalculation: false,
    })

    // Update snapshot for next iteration
    prevSnapshot = extractSnapshotFromMonth(recalculated)
    monthsRecalculated++
  }

  // Step 6: Update budget with final balances and clear all recalc flags
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

  return {
    monthsRecalculated,
    budgetUpdated: true,
    finalAccountBalances,
  }
}

// ============================================================================
// BUDGET UPDATE HELPERS
// ============================================================================

/**
 * Clear all needs_recalculation flags in the month_map.
 */
function clearMonthMapFlags(monthMap: MonthMap): MonthMap {
  const cleared: MonthMap = {}
  for (const ordinal of Object.keys(monthMap)) {
    cleared[ordinal] = { needs_recalculation: false }
  }
  return cleared
}

/**
 * Calculate total_available from accounts and categories.
 * total_available = sum of on-budget account balances - sum of positive category balances
 */
function calculateTotalAvailable(
  accounts: FirestoreData,
  categories: FirestoreData,
  accountGroups: FirestoreData
): number {
  const onBudgetAccountTotal = Object.entries(accounts).reduce((sum, [, account]) => {
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)
    if (effectiveOnBudget && effectiveActive) {
      return sum + (account.balance ?? 0)
    }
    return sum
  }, 0)

  // Only sum positive category balances - negative balances (debt) don't reduce available
  const totalPositiveCategoryBalances = Object.values(categories).reduce(
    (sum, cat) => {
      const balance = (cat as { balance?: number }).balance ?? 0
      return sum + (balance > 0 ? balance : 0)
    },
    0
  )

  return onBudgetAccountTotal - totalPositiveCategoryBalances
}

/**
 * Update budget with final account/category balances, total_available, and clear recalc flags.
 * Also updates the React Query cache to prevent re-triggering.
 */
async function updateBudgetBalances(
  budgetId: string,
  accountBalances: Record<string, number>,
  categoryBalances: Record<string, number>,
  monthMap: MonthMap
): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[recalc] reading budget for balance update'
  )

  if (!exists || !data) {
    return
  }

  // Update account balances in the accounts map
  const updatedAccounts = { ...data.accounts }
  for (const [accountId, balance] of Object.entries(accountBalances)) {
    if (updatedAccounts[accountId]) {
      updatedAccounts[accountId] = { ...updatedAccounts[accountId], balance }
    }
  }

  // Update category balances in the categories map
  const updatedCategories = { ...data.categories }
  for (const [categoryId, balance] of Object.entries(categoryBalances)) {
    if (updatedCategories[categoryId]) {
      updatedCategories[categoryId] = { ...updatedCategories[categoryId], balance }
    }
  }

  const totalAvailable = calculateTotalAvailable(updatedAccounts, updatedCategories, data.account_groups || {})
  const clearedMonthMap = clearMonthMapFlags(monthMap)

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      accounts: updatedAccounts,
      categories: updatedCategories,
      total_available: totalAvailable,
      is_needs_recalculation: false,
      month_map: clearedMonthMap,
      updated_at: new Date().toISOString(),
    },
    '[recalc] saving balances and clearing flags'
  )

  updateBudgetCache(budgetId, clearedMonthMap)
}

/**
 * Update React Query cache with cleared month_map flags.
 * This prevents components from re-triggering recalculation after it completes.
 */
function updateBudgetCache(budgetId: string, clearedMonthMap: MonthMap): void {
  const budgetKey = queryKeys.budget(budgetId)
  const cachedBudget = queryClient.getQueryData<BudgetData>(budgetKey)

  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...cachedBudget,
      isNeedsRecalculation: false,
      monthMap: clearedMonthMap,
      budget: {
        ...cachedBudget.budget,
        is_needs_recalculation: false,
        month_map: clearedMonthMap,
      },
    })
  }
}

/**
 * Clear the budget's recalc flag and month_map flags.
 */
async function clearBudgetRecalcFlag(budgetId: string, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    '[recalc] reading budget to clear flags'
  )

  if (!exists || !data) {
    return
  }

  const totalAvailable = calculateTotalAvailable(data.accounts || {}, data.categories || {}, data.account_groups || {})
  const clearedMonthMap = clearMonthMapFlags(monthMap)

  await writeDocByPath(
    'budgets',
    budgetId,
    { ...data, total_available: totalAvailable, is_needs_recalculation: false, month_map: clearedMonthMap, updated_at: new Date().toISOString() },
    '[recalc] clearing flags'
  )

  updateBudgetCache(budgetId, clearedMonthMap)
}
