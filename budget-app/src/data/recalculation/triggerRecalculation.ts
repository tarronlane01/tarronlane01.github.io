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
 * Convert year and month to ordinal string (YYYYMM format).
 */
function toOrdinal(year: number, month: number): string {
  return `${year}${month.toString().padStart(2, '0')}`
}

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
    `fetching month ${year}/${month} for recalculation`
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
 * Fetch all months that exist in the month_map, sorted chronologically.
 */
async function fetchMonthsFromMap(
  budgetId: string,
  monthMap: MonthMap
): Promise<MonthWithId[]> {
  const ordinals = getAllMonthOrdinals(monthMap)
  const months: MonthWithId[] = []

  for (const ordinal of ordinals) {
    const month = await fetchMonth(budgetId, ordinal)
    if (month) {
      months.push(month)
    }
  }

  return months
}

/**
 * Find the index of the first month that needs recalculation.
 * Uses the month_map to determine this, not the month document.
 */
function findFirstStaleIndex(months: MonthWithId[], monthMap: MonthMap): number {
  for (let i = 0; i < months.length; i++) {
    const ordinal = toOrdinal(months[i].year, months[i].month)
    if (monthMap[ordinal]?.needs_recalculation) {
      return i
    }
  }
  return -1 // No months need recalculation
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Trigger the recalculation process.
 *
 * @param budgetId - The budget ID
 * @param options - Optional configuration
 * @returns Result of the recalculation
 */
export async function triggerRecalculation(
  budgetId: string,
  options: TriggerRecalculationOptions = {}
): Promise<RecalculationResult> {
  // Determine the starting point for the query
  // If no triggering month provided, use current calendar month
  const now = new Date()
  const currentOrdinal = toOrdinal(now.getFullYear(), now.getMonth() + 1)
  const triggeringOrdinal = options.triggeringMonthOrdinal || currentOrdinal

  console.log(`[Recalculation] Starting for budget ${budgetId}`, {
    triggeringMonth: triggeringOrdinal,
  })

  // Step 1: Read budget to get month_map
  const { exists: budgetExists, data: budgetData } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    'reading budget for recalculation (getting month_map)'
  )

  if (!budgetExists || !budgetData) {
    console.warn(`[Recalculation] Budget ${budgetId} not found`)
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  const monthMap = parseMonthMap(budgetData.month_map)
  const monthsNeedingRecalc = getMonthsNeedingRecalc(monthMap)

  if (monthsNeedingRecalc.length === 0 && !budgetData.is_needs_recalculation) {
    console.log('[Recalculation] No months need recalculation')
    return { monthsRecalculated: 0, budgetUpdated: false }
  }

  // Step 2: Fetch all months from the month_map
  const allMonths = await fetchMonthsFromMap(budgetId, monthMap)

  if (allMonths.length === 0) {
    console.log('[Recalculation] No months found, nothing to recalculate')
    await clearBudgetRecalcFlag(budgetId, monthMap)
    return { monthsRecalculated: 0, budgetUpdated: true }
  }

  // Step 3: Find where to start recalculating
  // If we have months marked as needing recalc, start from the month before the first stale one
  const firstStaleIndex = findFirstStaleIndex(allMonths, monthMap)
  const startingPointIndex = firstStaleIndex > 0 ? firstStaleIndex - 1 : -1

  // Step 4: Determine which months to recalculate
  const firstRecalcIndex = firstStaleIndex >= 0 ? firstStaleIndex : 0
  const lastRecalcIndex = allMonths.length - 1

  // Get the starting snapshot
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  if (startingPointIndex >= 0) {
    prevSnapshot = extractSnapshotFromMonth(allMonths[startingPointIndex])
  }

  // Check if there are actually months to recalculate
  if (firstStaleIndex < 0) {
    console.log(`[Recalculation] No months marked as needing recalculation, but budget flag was set`)
    // Still need to clear the budget flag
    await clearBudgetRecalcFlag(budgetId, monthMap)
    return { monthsRecalculated: 0, budgetUpdated: true }
  }

  console.log(`[Recalculation] Recalculating months ${firstRecalcIndex} to ${lastRecalcIndex}`, {
    totalMonths: allMonths.length,
    startingFrom: startingPointIndex >= 0
      ? toOrdinal(allMonths[startingPointIndex].year, allMonths[startingPointIndex].month)
      : 'beginning',
    firstStaleMonth: toOrdinal(allMonths[firstStaleIndex].year, allMonths[firstStaleIndex].month),
  })

  // Step 5: Walk forward and recalculate each month
  let monthsRecalculated = 0

  for (let i = firstRecalcIndex; i <= lastRecalcIndex; i++) {
    const month = allMonths[i]

    // Recalculate this month
    const recalculated = recalculateMonth(month, prevSnapshot)

    // Save to Firestore with cascadeRecalculation disabled
    // We're handling the recalculation ourselves, no need to mark future months
    await writeMonthData({
      budgetId,
      month: recalculated,
      description: `recalculating month ${month.year}/${month.month}`,
      cascadeRecalculation: false,
    })

    // Update snapshot for next iteration
    prevSnapshot = extractSnapshotFromMonth(recalculated)
    monthsRecalculated++

    console.log(`[Recalculation] Completed ${month.year}/${month.month}`)
  }

  // Step 6: Update budget with final balances and clear all recalc flags
  let finalAccountBalances: Record<string, number> | undefined
  let finalCategoryBalances: Record<string, number> | undefined

  // Get final account and category balances from the last recalculated month
  // (or starting point if nothing was recalculated)
  const finalMonthIndex = monthsRecalculated > 0 ? lastRecalcIndex : startingPointIndex
  if (finalMonthIndex >= 0) {
    finalAccountBalances = prevSnapshot.accountEndBalances
    finalCategoryBalances = prevSnapshot.categoryEndBalances
  }

  // Update budget with final balances and clear all recalc flags in month_map
  await updateBudgetBalances(
    budgetId,
    finalAccountBalances || {},
    finalCategoryBalances || {},
    monthMap
  )

  console.log(`[Recalculation] Complete`, {
    monthsRecalculated,
    budgetUpdated: true,
  })

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
 * Update budget with final account/category balances, total_available, and clear recalc flags.
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
    'reading budget for balance update'
  )

  if (!exists || !data) {
    console.warn(`[Recalculation] Budget ${budgetId} not found when updating balances`)
    return
  }

  // Update account balances in the accounts map
  const updatedAccounts = { ...data.accounts }
  for (const [accountId, balance] of Object.entries(accountBalances)) {
    if (updatedAccounts[accountId]) {
      updatedAccounts[accountId] = {
        ...updatedAccounts[accountId],
        balance,
      }
    }
  }

  // Update category balances in the categories map
  const updatedCategories = { ...data.categories }
  for (const [categoryId, balance] of Object.entries(categoryBalances)) {
    if (updatedCategories[categoryId]) {
      updatedCategories[categoryId] = {
        ...updatedCategories[categoryId],
        balance,
      }
    }
  }

  // Calculate total_available = sum of on-budget account balances - sum of category balances
  const accountGroups = data.account_groups || {}
  const onBudgetAccountTotal = Object.entries(updatedAccounts).reduce((sum, [, account]) => {
    // Get the account group if any
    const group = account.account_group_id ? accountGroups[account.account_group_id] : undefined
    // Determine effective on_budget and is_active (group overrides account if set)
    const effectiveOnBudget = group?.on_budget !== undefined ? group.on_budget : (account.on_budget !== false)
    const effectiveActive = group?.is_active !== undefined ? group.is_active : (account.is_active !== false)
    // Only sum if on_budget and active
    if (effectiveOnBudget && effectiveActive) {
      return sum + (account.balance ?? 0)
    }
    return sum
  }, 0)

  // Only sum positive category balances - negative balances (debt) don't reduce available
  const totalPositiveCategoryBalances = Object.values(updatedCategories).reduce(
    (sum, cat) => {
      const balance = cat.balance ?? 0
      // Only sum positive balances, ignore debt (negative balances)
      return sum + (balance > 0 ? balance : 0)
    },
    0
  )

  const totalAvailable = onBudgetAccountTotal - totalPositiveCategoryBalances

  // Clear all needs_recalculation flags in month_map
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
    'saving recalculated balances and clearing month_map flags'
  )
}

/**
 * Clear the budget's recalc flag and month_map flags.
 */
async function clearBudgetRecalcFlag(budgetId: string, monthMap: MonthMap): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    'reading budget to clear recalc flag'
  )

  if (!exists || !data) {
    return
  }

  // Calculate total_available from current balances
  const accounts = data.accounts || {}
  const categories = data.categories || {}
  const accountGroups = data.account_groups || {}

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
      // Only sum positive balances, ignore debt (negative balances)
      return sum + (balance > 0 ? balance : 0)
    },
    0
  )

  const totalAvailable = onBudgetAccountTotal - totalPositiveCategoryBalances

  // Clear all needs_recalculation flags in month_map
  const clearedMonthMap = clearMonthMapFlags(monthMap)

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      total_available: totalAvailable,
      is_needs_recalculation: false,
      month_map: clearedMonthMap,
      updated_at: new Date().toISOString(),
    },
    'clearing budget recalc flag and month_map flags'
  )
}
