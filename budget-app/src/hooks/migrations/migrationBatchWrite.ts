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
 *
 * CRITICAL: After writing months, ensures all written months are in month_map.
 * This prevents gaps in month_map when months are created or updated via batch writes.
 */
export async function batchWriteMonths(
  updates: MonthUpdate[],
  source: string
): Promise<void> {
  if (updates.length === 0) return

  // [DEBUG] Log what we're about to write
  console.log(`[DEBUG] batchWriteMonths: Writing ${updates.length} months from ${source}`)
  if (updates.length > 0) {
    const first = updates[0]
    const sampleCat = first.data.category_balances?.[0]
    const sampleAcc = first.data.account_balances?.[0]
    const totalAlloc = first.data.category_balances?.reduce((sum, cb) => sum + (cb.allocated || 0), 0) || 0
    console.log(`[DEBUG]   First month ${first.year}/${first.month} BEFORE convert: cat[0] start=${sampleCat?.start_balance} alloc=${sampleCat?.allocated}, totalAlloc=${totalAlloc}, acc[0] start=${sampleAcc?.start_balance}`)
  }

  // Convert month balances to stored format before writing
  // This ensures only start_balance (for months at/before window) and allocated are saved
  const batchDocs: BatchWriteDoc[] = updates.map(update => {
    const storedMonth = convertMonthBalancesToStored(update.data)
    
    // [DEBUG] Log stored format for first month only
    if (update === updates[0]) {
      const storedCat = (storedMonth.category_balances as Array<{category_id: string; start_balance: number; allocated: number}>)?.[0]
      const storedAcc = (storedMonth.account_balances as Array<{account_id: string; start_balance: number}>)?.[0]
      console.log(`[DEBUG]   First month AFTER convert: cat[0] start=${storedCat?.start_balance} alloc=${storedCat?.allocated}, acc[0] start=${storedAcc?.start_balance}`)
    }
    
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

  // CRITICAL: Ensure all written months are in month_map to prevent gaps
  // Group by budget to update each budget's month_map efficiently
  const updatesByBudget = new Map<string, Array<{ year: number; month: number }>>()
  for (const update of updates) {
    if (!updatesByBudget.has(update.budgetId)) {
      updatesByBudget.set(update.budgetId, [])
    }
    updatesByBudget.get(update.budgetId)!.push({ year: update.year, month: update.month })
  }

  // Update month_map for each budget
  const { ensureMonthsInMapBatch } = await import('@data/recalculation/monthMap')
  for (const [budgetId, months] of updatesByBudget) {
    try {
      await ensureMonthsInMapBatch(budgetId, months)
    } catch (error) {
      // Log but don't throw - month_map update is important but shouldn't fail the batch write
      console.warn(`[batchWriteMonths] Failed to update month_map for budget ${budgetId}:`, error)
    }
  }
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

