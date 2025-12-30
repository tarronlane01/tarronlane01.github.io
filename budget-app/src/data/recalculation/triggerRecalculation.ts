/**
 * Trigger Recalculation
 *
 * Main entry point for the recalculation process.
 * Called when readMonth or readBudget detects is_needs_recalculation = true.
 *
 * ALGORITHM:
 * 1. Fetch all months for the budget using getFutureMonths
 * 2. Walk backwards from the future-most month to find the last non-stale month
 * 3. Validate: starting point must not be before the passed-in month (catches marking bugs)
 * 4. Walk forward from starting point, calling recalculateMonth for each
 * 5. If budget-triggered (no targetOrdinal): recalculate ALL months, update budget
 * 6. If month-triggered: only recalculate up to that month, leave budget marked
 *
 * @param budgetId - The budget ID
 * @param targetMonthOrdinal - Optional month ordinal (YYYYMM) that triggered this
 *                             If provided, only recalculate up to this month
 *                             If not provided (budget-triggered), recalculate all
 */

import type { FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { getFutureMonths, type MonthWithId } from '../queries/month/getFutureMonths'
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
  created_at?: string
  updated_at?: string
}

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
 * Go back N months from a given year/month.
 */
function goBackMonths(year: number, month: number, count: number): { year: number; month: number } {
  let y = year
  let m = month - count
  while (m < 1) {
    m += 12
    y -= 1
  }
  return { year: y, month: m }
}

/**
 * Fetch relevant months for a budget for recalculation.
 * Queries from 12 months BEFORE the triggering month to ensure we capture
 * any month that might have been edited and marked for recalculation.
 * Uses skipCache to ensure we get fresh data from Firestore during recalculation.
 *
 * @param budgetId - The budget ID
 * @param triggeringMonthOrdinal - The month that triggered recalc (YYYYMM format)
 */
async function getMonthsForRecalc(
  budgetId: string,
  triggeringMonthOrdinal: string
): Promise<MonthWithId[]> {
  // Parse the triggering month and go back 12 months to ensure we capture
  // any month that was edited and needs recalculation.
  // Example: If viewing December 2025 and November 2025 was edited,
  // we need to include November in the query results.
  const { year, month } = parseOrdinal(triggeringMonthOrdinal)
  const lookback = goBackMonths(year, month, 12)

  console.log(`[Recalculation] Querying months from ${lookback.year}/${lookback.month} forward`)

  // skipCache: true ensures we read fresh data, not stale cached values
  return getFutureMonths(budgetId, lookback.year, lookback.month, { skipCache: true })
}

/**
 * Find the index of the last month that does NOT need recalculation.
 * Returns -1 if all months need recalculation (start from beginning).
 */
function findStartingPointIndex(months: MonthWithId[]): number {
  // Walk backwards from the end
  for (let i = months.length - 1; i >= 0; i--) {
    if (!months[i].is_needs_recalculation) {
      return i
    }
  }
  return -1 // All months need recalculation
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

  // Step 1: Fetch months from the triggering month forward
  const allMonths = await getMonthsForRecalc(budgetId, triggeringOrdinal)

  if (allMonths.length === 0) {
    console.log('[Recalculation] No months found, nothing to recalculate')
    await clearBudgetRecalcFlag(budgetId)
    return { monthsRecalculated: 0, budgetUpdated: true }
  }

  // Step 2: Find the starting point - last month that does NOT need recalculation
  const startingPointIndex = findStartingPointIndex(allMonths)

  // Step 3: Determine which months to recalculate
  const firstRecalcIndex = startingPointIndex + 1 // Start after the valid month
  const lastRecalcIndex = allMonths.length - 1 // All remaining months

  // Get the starting snapshot
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  if (startingPointIndex >= 0) {
    prevSnapshot = extractSnapshotFromMonth(allMonths[startingPointIndex])
  }

  // Check if there are actually months to recalculate
  if (firstRecalcIndex > lastRecalcIndex) {
    console.log(`[Recalculation] No months need recalculation (all months are valid)`)
  } else {
    console.log(`[Recalculation] Recalculating months ${firstRecalcIndex} to ${lastRecalcIndex}`, {
      totalMonths: allMonths.length,
      startingFrom: startingPointIndex >= 0
        ? toOrdinal(allMonths[startingPointIndex].year, allMonths[startingPointIndex].month)
        : 'beginning',
    })
  }

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

  // Step 6: Always update budget with final balances and clear recalc flag
  let finalAccountBalances: Record<string, number> | undefined
  let finalCategoryBalances: Record<string, number> | undefined

  // Get final account and category balances from the last recalculated month
  // (or starting point if nothing was recalculated)
  const finalMonthIndex = monthsRecalculated > 0 ? lastRecalcIndex : startingPointIndex
  if (finalMonthIndex >= 0) {
    finalAccountBalances = prevSnapshot.accountEndBalances
    finalCategoryBalances = prevSnapshot.categoryEndBalances
  }

  // Update budget with final balances and clear recalc flag
  await updateBudgetBalances(
    budgetId,
    finalAccountBalances || {},
    finalCategoryBalances || {}
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
 * Update budget with final account/category balances, total_available, and clear recalc flag.
 */
async function updateBudgetBalances(
  budgetId: string,
  accountBalances: Record<string, number>,
  categoryBalances: Record<string, number>
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

  const totalCategoryBalances = Object.values(updatedCategories).reduce(
    (sum, cat) => sum + (cat.balance ?? 0),
    0
  )

  const totalAvailable = onBudgetAccountTotal - totalCategoryBalances

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      accounts: updatedAccounts,
      categories: updatedCategories,
      total_available: totalAvailable,
      is_needs_recalculation: false,
      updated_at: new Date().toISOString(),
    },
    'saving recalculated balances and total_available'
  )
}

/**
 * Clear the budget's recalc flag and recalculate total_available from current balances.
 */
async function clearBudgetRecalcFlag(budgetId: string): Promise<void> {
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

  const totalCategoryBalances = Object.values(categories).reduce(
    (sum, cat) => sum + ((cat as { balance?: number }).balance ?? 0),
    0
  )

  const totalAvailable = onBudgetAccountTotal - totalCategoryBalances

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      total_available: totalAvailable,
      is_needs_recalculation: false,
      updated_at: new Date().toISOString(),
    },
    'clearing budget recalc flag and updating total_available (no months to recalculate)'
  )
}

