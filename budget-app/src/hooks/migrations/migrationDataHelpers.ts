/**
 * Migration Data Helpers
 *
 * Utilities for reading and writing data in migrations.
 * These helpers enforce best practices:
 *
 * 1. BATCH READS - Read all data upfront in one query
 * 2. BATCH WRITES - Write all changes in one batch operation
 * 3. RECALC FLAGS - Properly handle needs_recalculation after batch writes
 *
 * USAGE:
 * ```ts
 * const result = await runMigration(async () => {
 *   // Step 1: Batch read all data
 *   const { budgets, monthsByBudget } = await readAllBudgetsAndMonths()
 *
 *   // Step 2: Process in memory
 *   const budgetUpdates: BudgetUpdate[] = []
 *   const monthUpdates: MonthUpdate[] = []
 *   for (const budget of budgets) {
 *     // ... process and collect updates
 *   }
 *
 *   // Step 3: Batch write with recalculation
 *   await writeBudgetAndMonthUpdates(budgetUpdates, monthUpdates)
 *
 *   return { success: true, errors: [] }
 * })
 * ```
 */

// eslint-disable-next-line no-restricted-imports
import { queryCollection, readDocByPath, batchWriteDocs, type BatchWriteDoc } from '@firestore'
import type { FirestoreData, MonthDocument } from '@types'
import { getMonthDocId } from '@utils'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from '@data/recalculation/recalculateMonth'
import { updateBudgetBalances, parseMonthMap, clearMonthMapFlags } from '@data/recalculation/triggerRecalculationHelpers'

// ============================================================================
// TYPES
// ============================================================================

/** Budget data as read from Firestore */
export interface BudgetReadResult {
  id: string
  data: FirestoreData
}

/** Month data as read from Firestore */
export interface MonthReadResult {
  id: string
  data: FirestoreData
  budgetId: string
  year: number
  month: number
}

/** Update to apply to a budget */
export interface BudgetUpdate {
  budgetId: string
  data: FirestoreData
}

/** Update to apply to a month */
export interface MonthUpdate {
  budgetId: string
  year: number
  month: number
  data: MonthDocument
}

/** Result of reading all budgets and months */
export interface AllDataReadResult {
  budgets: BudgetReadResult[]
  monthsByBudget: Map<string, MonthReadResult[]>
}

// ============================================================================
// BATCH READ HELPERS
// ============================================================================

/**
 * Read all budgets from Firestore in a single query.
 * Use this instead of reading budgets one at a time.
 */
export async function readAllBudgets(source: string): Promise<BudgetReadResult[]> {
  const result = await queryCollection<FirestoreData>(
    'budgets',
    `${source}: batch reading all budgets`
  )

  return result.docs.map(doc => ({
    id: doc.id,
    data: doc.data,
  }))
}

/**
 * Read all months for a specific budget in a single query.
 * Returns months sorted chronologically.
 */
export async function readAllMonthsForBudget(
  budgetId: string,
  source: string
): Promise<MonthReadResult[]> {
  const result = await queryCollection<FirestoreData>(
    'months',
    `${source}: batch reading months for budget ${budgetId}`,
    [{ field: 'budget_id', op: '==', value: budgetId }]
  )

  const months = result.docs.map(doc => ({
    id: doc.id,
    data: doc.data,
    budgetId: doc.data.budget_id as string,
    year: doc.data.year as number,
    month: doc.data.month as number,
  }))

  // Sort chronologically
  return months.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
}

/**
 * Read all budgets and their months in batch queries.
 * This is the recommended way to read data in migrations.
 *
 * Returns:
 * - budgets: All budget documents
 * - monthsByBudget: Map from budget ID to sorted month documents
 */
export async function readAllBudgetsAndMonths(source: string): Promise<AllDataReadResult> {
  // Query all budgets
  const budgets = await readAllBudgets(source)

  // Query all months (one query for ALL months, then group by budget)
  const allMonthsResult = await queryCollection<FirestoreData>(
    'months',
    `${source}: batch reading all months`
  )

  // Group months by budget ID and sort chronologically
  const monthsByBudget = new Map<string, MonthReadResult[]>()

  for (const doc of allMonthsResult.docs) {
    const budgetId = doc.data.budget_id as string
    const monthData: MonthReadResult = {
      id: doc.id,
      data: doc.data,
      budgetId,
      year: doc.data.year as number,
      month: doc.data.month as number,
    }

    if (!monthsByBudget.has(budgetId)) {
      monthsByBudget.set(budgetId, [])
    }
    monthsByBudget.get(budgetId)!.push(monthData)
  }

  // Sort each budget's months chronologically
  for (const months of monthsByBudget.values()) {
    months.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
  }

  return { budgets, monthsByBudget }
}

// ============================================================================
// BATCH WRITE HELPERS
// ============================================================================

/**
 * Write multiple month documents in a single batch operation.
 * Firestore batches are limited to 500 operations; this handles chunking automatically.
 */
export async function batchWriteMonths(
  updates: MonthUpdate[],
  source: string
): Promise<void> {
  if (updates.length === 0) return

  const batchDocs: BatchWriteDoc[] = updates.map(update => ({
    collectionPath: 'months',
    docId: getMonthDocId(update.budgetId, update.year, update.month),
    data: {
      ...update.data,
      updated_at: new Date().toISOString(),
    } as unknown as FirestoreData,
  }))

  await batchWriteDocs(batchDocs, `${source}: batch writing ${updates.length} months`)
}

/**
 * Write multiple budget documents in a single batch operation.
 */
export async function batchWriteBudgets(
  updates: BudgetUpdate[],
  source: string
): Promise<void> {
  if (updates.length === 0) return

  const batchDocs: BatchWriteDoc[] = updates.map(update => ({
    collectionPath: 'budgets',
    docId: update.budgetId,
    data: {
      ...update.data,
      updated_at: new Date().toISOString(),
    },
  }))

  await batchWriteDocs(batchDocs, `${source}: batch writing ${updates.length} budgets`)
}

// ============================================================================
// RECALCULATION HELPERS
// ============================================================================

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

  // Read budget to get current month_map
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `${source}: reading budget for final update`
  )

  if (exists && data) {
    const monthMap = parseMonthMap(data.month_map || {})
    const clearedMonthMap = clearMonthMapFlags(monthMap)

    // This writes the budget with cleared flags
    await updateBudgetBalances(budgetId, finalAccountBalances, finalCategoryBalances, clearedMonthMap)
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

/**
 * Process all budgets with a transformation function.
 * Enforces batch read, process, and batch write pattern.
 *
 * @param source - Source identifier for logging
 * @param processBudget - Function to process each budget and its months
 */
export async function processBudgetsWithMonths<TResult>(
  source: string,
  processBudget: (
    budget: BudgetReadResult,
    months: MonthReadResult[]
  ) => Promise<{
    budgetUpdate?: BudgetUpdate
    monthUpdates: MonthUpdate[]
    result: TResult
  }>
): Promise<{ results: TResult[]; errors: string[] }> {
  const errors: string[] = []
  const results: TResult[] = []

  // Step 1: Batch read all data
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths(source)

  // Step 2: Process in memory, collecting updates
  const allBudgetUpdates: BudgetUpdate[] = []
  const allMonthUpdates: MonthUpdate[] = []

  for (const budget of budgets) {
    try {
      const months = monthsByBudget.get(budget.id) || []
      const { budgetUpdate, monthUpdates, result } = await processBudget(budget, months)

      if (budgetUpdate) {
        allBudgetUpdates.push(budgetUpdate)
      }
      allMonthUpdates.push(...monthUpdates)
      results.push(result)
    } catch (err) {
      errors.push(`Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Step 3: Batch write all updates
  if (allBudgetUpdates.length > 0) {
    await batchWriteBudgets(allBudgetUpdates, source)
  }

  // Step 4: Write months and recalculate
  if (allMonthUpdates.length > 0) {
    await writeMonthUpdatesAndRecalculate(allMonthUpdates, source)
  }

  return { results, errors }
}

