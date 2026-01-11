/**
 * Budget Write Operations
 *
 * Core infrastructure for writing budget documents with proper cache updates.
 * This is the ONLY allowed way to write budget documents in mutation files.
 *
 * Similar to writeMonthData, this is part of the optimistic update infrastructure.
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
  /** Partial budget data to merge with existing document */
  updates: Partial<FirestoreData>
  /** Description for logging */
  description: string
}

// ============================================================================
// READ UTILITY
// ============================================================================

/**
 * Read budget document for editing.
 * Returns fresh data from Firestore (not cache).
 */
export async function readBudgetForEdit(
  budgetId: string,
  description: string
): Promise<FirestoreData> {
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `PRE-EDIT-READ: ${description}`
  )

  if (!exists || !data) {
    throw new Error('Budget not found')
  }

  return data
}

// ============================================================================
// WRITE UTILITY
// ============================================================================

/**
 * Write budget data to Firestore and update cache.
 *
 * This is the core write function for budget documents.
 * Mutations should use createOptimisticMutation and call this in mutationFn.
 */
export async function writeBudgetData(params: WriteBudgetParams): Promise<void> {
  const { budgetId, updates, description } = params

  // Read fresh data, merge updates, write back
  const freshData = await readBudgetForEdit(budgetId, description)

  const updatedData: FirestoreData = {
    ...freshData,
    ...updates,
  }

  await writeDocByPath('budgets', budgetId, updatedData, description)

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

