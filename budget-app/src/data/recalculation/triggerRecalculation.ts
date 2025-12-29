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
   * If provided, only recalculate up to this month.
   * If not provided, this was triggered from the budget view - recalculate all months.
   */
  targetMonthOrdinal?: string
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
 * Fetch all months for a budget by using getFutureMonths with a very early start date.
 */
async function getAllMonths(budgetId: string): Promise<MonthWithId[]> {
  // Use year 1900 to ensure we get all months
  return getFutureMonths(budgetId, 1900, 1)
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
  const { targetMonthOrdinal } = options
  const isBudgetTriggered = !targetMonthOrdinal

  console.log(`[Recalculation] Starting for budget ${budgetId}`, {
    trigger: isBudgetTriggered ? 'budget' : `month ${targetMonthOrdinal}`,
  })

  // Step 1: Fetch all months for this budget
  const allMonths = await getAllMonths(budgetId)

  if (allMonths.length === 0) {
    console.log('[Recalculation] No months found, nothing to recalculate')
    // If budget-triggered, clear the budget's recalc flag
    if (isBudgetTriggered) {
      await clearBudgetRecalcFlag(budgetId)
    }
    return { monthsRecalculated: 0, budgetUpdated: isBudgetTriggered }
  }

  // Step 2: Find the starting point - last month that does NOT need recalculation
  const startingPointIndex = findStartingPointIndex(allMonths)

  // Step 3: Validate - if month-triggered, starting point must not be before target
  if (targetMonthOrdinal) {
    const startingOrdinal = startingPointIndex >= 0
      ? toOrdinal(allMonths[startingPointIndex].year, allMonths[startingPointIndex].month)
      : '000000' // Before everything

    if (startingOrdinal > targetMonthOrdinal) {
      // This shouldn't happen if markFutureMonthsNeedRecalculation is working correctly
      throw new Error(
        `[Recalculation] Bug detected: Starting point (${startingOrdinal}) is after ` +
        `target month (${targetMonthOrdinal}). This indicates markFutureMonthsNeedRecalculation ` +
        `may have an issue - months before the target are marked as needing recalculation.`
      )
    }
  }

  // Step 4: Determine which months to recalculate
  const firstRecalcIndex = startingPointIndex + 1 // Start after the valid month

  // Determine end index
  let lastRecalcIndex = allMonths.length - 1 // Default: all remaining months
  if (targetMonthOrdinal) {
    // Find the target month index
    const targetIndex = allMonths.findIndex(m =>
      toOrdinal(m.year, m.month) === targetMonthOrdinal
    )
    if (targetIndex >= 0) {
      lastRecalcIndex = targetIndex
    }
  }

  // Get the starting snapshot
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  if (startingPointIndex >= 0) {
    prevSnapshot = extractSnapshotFromMonth(allMonths[startingPointIndex])
  }

  console.log(`[Recalculation] Recalculating months ${firstRecalcIndex} to ${lastRecalcIndex}`, {
    totalMonths: allMonths.length,
    startingFrom: startingPointIndex >= 0
      ? toOrdinal(allMonths[startingPointIndex].year, allMonths[startingPointIndex].month)
      : 'beginning',
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

  // Step 6: Update budget if this was budget-triggered
  let budgetUpdated = false
  let finalAccountBalances: Record<string, number> | undefined

  if (isBudgetTriggered) {
    // Get final account balances from the last recalculated month
    // (or starting point if nothing was recalculated)
    const finalMonthIndex = monthsRecalculated > 0 ? lastRecalcIndex : startingPointIndex
    if (finalMonthIndex >= 0) {
      finalAccountBalances = prevSnapshot.accountEndBalances
    }

    // Update budget with final balances and clear recalc flag
    await updateBudgetBalances(budgetId, finalAccountBalances || {})
    budgetUpdated = true
  }

  console.log(`[Recalculation] Complete`, {
    monthsRecalculated,
    budgetUpdated,
  })

  return {
    monthsRecalculated,
    budgetUpdated,
    finalAccountBalances,
  }
}

// ============================================================================
// BUDGET UPDATE HELPERS
// ============================================================================

/**
 * Update budget with final account balances and clear recalc flag.
 */
async function updateBudgetBalances(
  budgetId: string,
  accountBalances: Record<string, number>
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

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      accounts: updatedAccounts,
      is_needs_recalculation: false,
      updated_at: new Date().toISOString(),
    },
    'saving recalculated account balances'
  )
}

/**
 * Clear the budget's recalc flag without updating balances.
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

  await writeDocByPath(
    'budgets',
    budgetId,
    {
      ...data,
      is_needs_recalculation: false,
      updated_at: new Date().toISOString(),
    },
    'clearing budget recalc flag (no months to recalculate)'
  )
}

