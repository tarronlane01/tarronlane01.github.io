/**
 * Migration Batch Write Helpers
 *
 * Utilities for batch writing data in migrations.
 * These helpers enforce writing all changes in one batch operation.
 */

// eslint-disable-next-line no-restricted-imports
import { batchWriteDocs, type BatchWriteDoc } from '@firestore'
import type { FirestoreData, MonthDocument } from '@types'
import { getMonthDocId, cleanForFirestore } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// BATCH WRITE HELPERS
// ============================================================================

/**
 * Write multiple month documents in a single batch operation.
 * Firestore batches are limited to 500 operations; this handles chunking automatically.
 *
 * IMPORTANT: This is a DESTRUCTIVE operation.
 * Each month document completely replaces any existing data for that month.
 * Uses Firestore's setDoc (via batch.set) which overwrites the entire document.
 */
export async function batchWriteMonths(
  updates: MonthUpdate[],
  source: string
): Promise<void> {
  if (updates.length === 0) return

  const batchDocs: BatchWriteDoc[] = updates.map(update => ({
    collectionPath: 'months',
    docId: getMonthDocId(update.budgetId, update.year, update.month),
    data: cleanForFirestore({
      ...update.data,
      updated_at: new Date().toISOString(),
    }) as unknown as FirestoreData,
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
    data: cleanForFirestore({
      ...update.data,
      updated_at: new Date().toISOString(),
    }),
  }))

  await batchWriteDocs(batchDocs, `${source}: batch writing ${updates.length} budgets`)
}

