/**
 * Migration Data Helpers
 *
 * Main entry point for migration data operations.
 * Re-exports helpers from specialized modules.
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
 *   await writeMonthUpdatesAndRecalculate(monthUpdates, source)
 *
 *   return { success: true, errors: [] }
 * })
 * ```
 */

// Re-export types and functions from specialized modules
export type {
  BudgetReadResult,
  MonthReadResult,
  AllDataReadResult,
} from './migrationBatchRead'

export type {
  BudgetUpdate,
  MonthUpdate,
} from './migrationBatchWrite'

export {
  readAllBudgets,
  readAllMonthsForBudget,
  readAllBudgetsAndMonths,
} from './migrationBatchRead'

export {
  batchWriteMonths,
  batchWriteBudgets,
} from './migrationBatchWrite'

export {
  recalculateAndWriteBudget,
  writeMonthUpdatesAndRecalculate,
} from './migrationRecalculate'

// Process helper that combines read, process, and write
import type { BudgetReadResult, MonthReadResult } from './migrationBatchRead'
import type { BudgetUpdate, MonthUpdate } from './migrationBatchWrite'
import { readAllBudgetsAndMonths } from './migrationBatchRead'
import { batchWriteBudgets } from './migrationBatchWrite'
import { writeMonthUpdatesAndRecalculate } from './migrationRecalculate'

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

