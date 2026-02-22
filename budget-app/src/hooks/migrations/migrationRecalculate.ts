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
import { updateBudgetBalances, parseMonthMap } from '@data/recalculation/triggerRecalculationHelpers'
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

  // [DEBUG] Log what months we're recalculating
  console.log(`[DEBUG] recalculateAndWriteBudget: ${months.length} months for budget ${budgetId}`)

  // Step 1: Recalculate all months in order
  // For the first month, use its own stored start_balances as initial balances
  // (these represent the initial account/category balances, not 0)
  let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  const recalculatedMonths: MonthDocument[] = []
  let isFirstMonth = true

  for (const month of months) {
    // For first month only: use its own start_balances as initial values
    // This preserves initial account balances (e.g., from sample budget generation)
    if (isFirstMonth) {
      const initialCategoryBalances: Record<string, number> = {}
      const initialAccountBalances: Record<string, number> = {}
      
      // [DEBUG] Log first month's raw balance data
      const totalAlloc = (month.category_balances || []).reduce((sum, cb) => sum + (cb.allocated || 0), 0)
      console.log(`[DEBUG] First month ${month.year}/${month.month} raw category_balances (totalAlloc=${totalAlloc}):`, 
        (month.category_balances || []).slice(0, 3).map(cb => ({
          id: cb.category_id.slice(0, 10),
          start: cb.start_balance,
          alloc: cb.allocated,
          end: cb.end_balance
        }))
      )
      console.log(`[DEBUG] First month ${month.year}/${month.month} raw account_balances:`,
        (month.account_balances || []).slice(0, 3).map(ab => ({
          id: ab.account_id.slice(0, 10),
          start: ab.start_balance,
          end: ab.end_balance
        }))
      )
      
      for (const cb of month.category_balances || []) {
        if (cb.start_balance !== 0) {
          initialCategoryBalances[cb.category_id] = cb.start_balance
        }
      }
      for (const ab of month.account_balances || []) {
        if (ab.start_balance !== 0) {
          initialAccountBalances[ab.account_id] = ab.start_balance
        }
      }
      
      // [DEBUG] Log extracted initial balances
      console.log(`[DEBUG] Extracted initial balances: categories=${Object.keys(initialCategoryBalances).length}, accounts=${Object.keys(initialAccountBalances).length}`)
      
      prevSnapshot = {
        categoryEndBalances: initialCategoryBalances,
        accountEndBalances: initialAccountBalances,
        totalIncome: 0,
      }
      isFirstMonth = false
    }

    const recalculated = recalculateMonth(month, prevSnapshot)
    recalculatedMonths.push(recalculated)
    
    // [DEBUG] Log recalculated month summary
    const sampleCat = recalculated.category_balances?.[0]
    const recalcTotalAlloc = recalculated.category_balances?.reduce((sum, cb) => sum + (cb.allocated || 0), 0) || 0
    console.log(`[DEBUG] After recalc ${month.year}/${month.month}: cat[0] start=${sampleCat?.start_balance} alloc=${sampleCat?.allocated} end=${sampleCat?.end_balance}, totalAlloc=${recalcTotalAlloc}`)
    
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

  // Step 3: Update budget with balances from the LAST FINALIZED month
  // Budget-level balance represents the snapshot at end of last finalized month
  // Find the last finalized month's balances
  const lastFinalizedMonth = [...recalculatedMonths].reverse().find(m => m.are_allocations_finalized)
  
  let finalAccountBalances: Record<string, number>
  let finalCategoryBalances: Record<string, number>
  
  if (lastFinalizedMonth) {
    // Extract balances from last finalized month
    finalCategoryBalances = {}
    for (const cb of lastFinalizedMonth.category_balances || []) {
      finalCategoryBalances[cb.category_id] = cb.end_balance
    }
    finalAccountBalances = {}
    for (const ab of lastFinalizedMonth.account_balances || []) {
      finalAccountBalances[ab.account_id] = ab.end_balance
    }
    console.log(`[DEBUG] recalculateAndWriteBudget: using last FINALIZED month ${lastFinalizedMonth.year}/${lastFinalizedMonth.month} for balances`)
  } else {
    // No finalized months - use the last month's balances
    finalAccountBalances = prevSnapshot.accountEndBalances
    finalCategoryBalances = prevSnapshot.categoryEndBalances
    console.log(`[DEBUG] recalculateAndWriteBudget: no finalized months, using last month for balances`)
  }

  // Read budget to get current month_map and all categories
  const { exists, data } = await readDocByPath<FirestoreData>(
    'budgets',
    budgetId,
    `${source}: reading budget for final update`
  )

  if (exists && data) {
    const monthMap = parseMonthMap(data.month_map || {})

    // Ensure ALL categories from the budget are included in final balances
    // Categories not in the snapshot should have balance 0 (they had no activity)
    const allCategoryBalances: Record<string, number> = { ...finalCategoryBalances }
    const categories = (data.categories || {}) as Record<string, { balance?: number }>
    for (const categoryId of Object.keys(categories)) {
      if (!(categoryId in allCategoryBalances)) {
        allCategoryBalances[categoryId] = 0
      }
    }

    // Update budget cache with balances and save month_map to Firestore
    // Note: Balances are NOT persisted to Firestore - always calculated locally
    await updateBudgetBalances(budgetId, finalAccountBalances, allCategoryBalances, monthMap)
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
 *    c. Updates budget balances
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

