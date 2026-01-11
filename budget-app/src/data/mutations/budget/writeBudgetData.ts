/**
 * Budget Write Operations
 *
 * Core infrastructure for writing budget documents with proper cache updates.
 * This is the ONLY allowed way to write budget documents in mutation files.
 *
 * PATTERN: Uses Firebase merge strategy to write ONLY the fields being updated.
 * This avoids pre-write reads and prevents overwriting unrelated fields.
 */

import type { FirestoreData } from '@types'
import { readDocByPath, writeDocByPath } from '@firestore'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for writing budget data
 */
export interface WriteBudgetParams {
  budgetId: string
  /** Partial budget data - ONLY include fields you want to update */
  updates: Partial<FirestoreData>
  /** Description for logging */
  description: string
}

// ============================================================================
// READ UTILITY (USE SPARINGLY)
// ============================================================================

/**
 * Read budget document for cases that REQUIRE current state.
 *
 * ⚠️ AVOID when possible! Use this ONLY when you need to:
 * - Validate current state before writing
 * - Perform computations based on current values (e.g., reorder arrays)
 *
 * For simple updates, use writeBudgetData with merge strategy instead.
 * For array additions, use arrayUnion. For removals, use arrayRemove.
 */
export async function readBudgetForEdit(
  budgetId: string,
  description: string
): Promise<FirestoreData> {
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `VALIDATION-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error('Budget not found')
  }

  return data
}

// ============================================================================
// WRITE UTILITY (MERGE STRATEGY)
// ============================================================================

/**
 * Write budget data to Firestore using merge strategy.
 *
 * IMPORTANT: Only pass the fields you want to update in `updates`.
 * This uses Firebase's merge option to avoid overwriting other fields.
 * No pre-write read is needed.
 *
 * @example
 * // Good: Only updating name
 * await writeBudgetData({ budgetId, updates: { name: 'New Name' }, description: '...' })
 *
 * // Bad: Don't spread entire documents
 * await writeBudgetData({ budgetId, updates: { ...entireBudget, name: 'New Name' }, description: '...' })
 */
export async function writeBudgetData(params: WriteBudgetParams): Promise<void> {
  const { budgetId, updates, description } = params

  // Add timestamp to updates
  const dataToWrite: FirestoreData = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  // Write with merge: true - only updates specified fields, doesn't overwrite others
  await writeDocByPath('budgets', budgetId, dataToWrite, description, { merge: true })

  // Update cache after successful write
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (cachedBudget) {
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      budget: {
        ...cachedBudget.budget,
        ...updates,
      },
    })
  }
}

