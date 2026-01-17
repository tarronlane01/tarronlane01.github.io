/**
 * Migration Recalculation Helpers
 *
 * Utilities for recalculating months and updating budgets in migrations.
 */

// eslint-disable-next-line no-restricted-imports
import { readDocByPath } from '@firestore'
import type { FirestoreData, MonthDocument } from '@types'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from '@data/recalculation/recalculateMonth'
import { updateBudgetBalances, parseMonthMap, clearMonthMapFlags } from '@data/recalculation/triggerRecalculationHelpers'
import { batchWriteMonths, type MonthUpdate } from './migrationBatchWrite'
import { readAllMonthsForBudget } from './migrationBatchRead'

/**
 * Recalculate all months for a budget and update the budget document.
 * This is the correct way to complete a migration that modifies month data.
 *
 * Process:
 * 1. Recalculates all months from first to last (in memory)
 * 2. Batch writes all recalculated months
 * 3. Updates budget with final account/category balances
 * 4. Clears all needs_recalculation flags
 *
 * @param budgetId - The budget to recalculate
 * @param months - All months for the budget (must be sorted chronologically)
 * @param source - Source identifier for logging
 */
export async function recalculateAndWriteBudget(
  budgetId: string,
  months: MonthDocument[],
  source: string
): Promise<void> {
  if (months.length === 0) return

  // Step 1: Recalculate all months in order
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  const recalculatedMonths: MonthDocument[] = []

  for (const month of months) {
    const recalculated = recalculateMonth(month, prevSnapshot)
    recalculatedMonths.push(recalculated)
    prevSnapshot = extractSnapshotFromMonth(recalculated)
  }

  // Step 2: Batch write all recalculated months
  const monthUpdates: MonthUpdate[] = recalculatedMonths.map(month => ({
    budgetId,
    year: month.year,
    month: month.month,
    data: month,
  }))

  await batchWriteMonths(monthUpdates, source)

  // Step 3: Update budget with final balances and clear flags
  const finalAccountBalances = prevSnapshot.accountEndBalances
  const finalCategoryBalances = prevSnapshot.categoryEndBalances

  // Read budget to get current month_map and all categories
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `${source}: reading budget for final update`
  )

  if (exists && data) {
    const monthMap = parseMonthMap(data.month_map || {})
    const clearedMonthMap = clearMonthMapFlags(monthMap)

    // Ensure ALL categories from the budget are included in final balances
    // Categories not in the snapshot should have balance 0 (they had no activity)
    const allCategoryBalances: Record<string, number> = { ...finalCategoryBalances }
    const categories = (data.categories || {}) as Record<string, { balance?: number }>
    for (const categoryId of Object.keys(categories)) {
      if (!(categoryId in allCategoryBalances)) {
        allCategoryBalances[categoryId] = 0
      }
    }

    // This writes the budget with cleared flags
    await updateBudgetBalances(budgetId, finalAccountBalances, allCategoryBalances, clearedMonthMap)
  }
}

/**
 * Complete a migration by writing month updates and recalculating budgets.
 * This is the main entry point for the "write" phase of a migration.
 *
 * Process:
 * 1. Groups month updates by budget
 * 2. For each budget:
 *    a. Batch writes all month updates
 *    b. Recalculates all months from the beginning
 *    c. Updates budget balances and clears needs_recalculation flags
 *
 * @param monthUpdates - All month updates to apply
 * @param source - Source identifier for logging
 */
export async function writeMonthUpdatesAndRecalculate(
  monthUpdates: MonthUpdate[],
  source: string
): Promise<void> {
  if (monthUpdates.length === 0) return

  // Group updates by budget
  const updatesByBudget = new Map<string, MonthUpdate[]>()
  for (const update of monthUpdates) {
    if (!updatesByBudget.has(update.budgetId)) {
      updatesByBudget.set(update.budgetId, [])
    }
    updatesByBudget.get(update.budgetId)!.push(update)
  }

  // Process each budget
  for (const [budgetId, updates] of updatesByBudget) {
    // Sort updates chronologically
    updates.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

    // Batch write the month updates first
    await batchWriteMonths(updates, source)

    // Now recalculate from scratch using the updated data
    // Read all months fresh to ensure we have the latest data
    const allMonths = await readAllMonthsForBudget(budgetId, source)
    const monthDocuments = allMonths.map(m => m.data as unknown as MonthDocument)

    await recalculateAndWriteBudget(budgetId, monthDocuments, source)
  }
}

