/**
 * Migration Batch Read Helpers
 *
 * Utilities for batch reading data in migrations.
 * These helpers enforce reading all data upfront in one query.
 */

// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import type { FirestoreData } from '@types'

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

