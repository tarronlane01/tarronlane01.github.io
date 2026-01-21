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
import { convertMonthBalancesToStored } from '@data/firestore/converters/monthBalances'

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

  // Convert month balances to stored format before writing
  // This ensures only start_balance (for months at/before window) and allocated are saved
  const batchDocs: BatchWriteDoc[] = updates.map(update => {
    const storedMonth = convertMonthBalancesToStored(update.data)
    return {
      collectionPath: 'months',
      docId: getMonthDocId(update.budgetId, update.year, update.month),
      data: cleanForFirestore({
        ...storedMonth,
        updated_at: new Date().toISOString(),
      }) as unknown as FirestoreData,
    }
  })

  await batchWriteDocs(batchDocs, `${source}: batch writing ${updates.length} months`)
}

/**
 * Write multiple budget documents in a single batch operation.
 * Strips balance fields from accounts and categories before writing (balances are calculated on-the-fly).
 */
export async function batchWriteBudgets(
  updates: BudgetUpdate[],
  source: string
): Promise<void> {
  if (updates.length === 0) return

  const batchDocs: BatchWriteDoc[] = updates.map(update => {
    // Strip balance fields from accounts and categories (balances are calculated on-the-fly)
    const dataWithoutBalances = { ...update.data }
    
    if (dataWithoutBalances.accounts && typeof dataWithoutBalances.accounts === 'object') {
      const accounts = dataWithoutBalances.accounts as Record<string, unknown>
      dataWithoutBalances.accounts = Object.fromEntries(
        Object.entries(accounts).map(([id, acc]) => {
          if (acc && typeof acc === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
            const { balance: _balance, ...accWithoutBalance } = acc as { balance?: number; [key: string]: unknown }
            return [id, accWithoutBalance]
          }
          return [id, acc]
        })
      )
    }
    
    if (dataWithoutBalances.categories && typeof dataWithoutBalances.categories === 'object') {
      const categories = dataWithoutBalances.categories as Record<string, unknown>
      dataWithoutBalances.categories = Object.fromEntries(
        Object.entries(categories).map(([id, cat]) => {
          if (cat && typeof cat === 'object') {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove balance field
            const { balance: _balance, ...catWithoutBalance } = cat as { balance?: number; [key: string]: unknown }
            return [id, catWithoutBalance]
          }
          return [id, cat]
        })
      )
    }
    
    // Remove total_available and is_needs_recalculation if present (they're calculated/managed locally)
    // These should never be in the data at this point, but strip them as a safeguard
    delete (dataWithoutBalances as { total_available?: number; is_needs_recalculation?: boolean; [key: string]: unknown }).total_available
    delete (dataWithoutBalances as { total_available?: number; is_needs_recalculation?: boolean; [key: string]: unknown }).is_needs_recalculation

    return {
      collectionPath: 'budgets',
      docId: update.budgetId,
      data: cleanForFirestore({
        ...dataWithoutBalances,
        updated_at: new Date().toISOString(),
      }),
    }
  })

  await batchWriteDocs(batchDocs, `${source}: batch writing ${updates.length} budgets`)
}

