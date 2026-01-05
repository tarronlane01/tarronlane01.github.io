/**
 * Delete All Months Migration Hook
 *
 * Deletes ALL month documents from Firebase for ALL budgets.
 * This is a destructive operation - use with caution!
 *
 * After deletion, resets all affected budgets (balances to zero) and clears the cache.
 * Uses the migration framework for cache invalidation.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { batchDeleteDocs, queryCollection, readDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData } from '@types'
import { clearAllCaches } from './migrationRunner'

// Budget document structure (simplified for reset)
interface BudgetDocument {
  name: string
  accounts: FirestoreData
  categories: FirestoreData
  month_map?: FirestoreData
  total_available?: number
  is_needs_recalculation?: boolean
  [key: string]: unknown
}

/**
 * Reset a budget's balances to zero after all months have been deleted.
 * Sets all account balances, category balances, and total_available to 0.
 * Clears the month_map and is_needs_recalculation flag.
 */
async function resetBudgetBalances(budgetId: string): Promise<void> {
  const { exists, data } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    `[delete all months] reading budget ${budgetId} for reset`
  )

  if (!exists || !data) {
    return
  }

  // Reset all account balances to 0
  const resetAccounts = { ...data.accounts }
  for (const accountId of Object.keys(resetAccounts)) {
    if (resetAccounts[accountId] && typeof resetAccounts[accountId] === 'object') {
      resetAccounts[accountId] = { ...resetAccounts[accountId], balance: 0 }
    }
  }

  // Reset all category balances to 0
  const resetCategories = { ...data.categories }
  for (const categoryId of Object.keys(resetCategories)) {
    if (resetCategories[categoryId] && typeof resetCategories[categoryId] === 'object') {
      resetCategories[categoryId] = { ...resetCategories[categoryId], balance: 0 }
    }
  }

  // Write the reset budget
  await writeDocByPath('budgets', budgetId, {
    ...data,
    accounts: resetAccounts,
    categories: resetCategories,
    month_map: {}, // Clear all month entries
    total_available: 0,
    is_needs_recalculation: false,
    updated_at: new Date().toISOString(),
  }, `[delete all months] resetting budget ${budgetId} balances to zero`)
}

export interface MonthInfo {
  docId: string
  budgetId: string
  year: number
  month: number
}

export interface DeleteAllMonthsResult {
  deleted: number
  errors: string[]
  budgetsRecalculated: number
}

export interface DeleteAllMonthsStatus {
  monthsToDelete: MonthInfo[]
  monthsCount: number
  budgetCount: number
}

export type DeletePhase = 'deleting' | 'resetting-budgets' | 'clearing-cache' | 'complete'

export interface DeleteProgress {
  phase: DeletePhase
  deleted: number
  total: number
  currentMonth: string | null
  budgetsRecalculated: number
  totalBudgets: number
  percentComplete: number
}

interface UseDeleteAllMonthsOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useDeleteAllMonths({
  currentUser,
  onComplete,
}: UseDeleteAllMonthsOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [status, setStatus] = useState<DeleteAllMonthsStatus | null>(null)
  const [deleteResult, setDeleteResult] = useState<DeleteAllMonthsResult | null>(null)
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress | null>(null)

  // Scan for all months (direct Firestore, no caching)
  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      const monthsResult = await queryCollection<{
        budget_id: string
        year: number
        month: number
      }>(
        'months',
        'delete all months: scanning for all months'
      )

      const monthsToDelete: MonthInfo[] = []
      const budgetIds = new Set<string>()

      for (const monthDoc of monthsResult.docs) {
        const { budget_id, year, month } = monthDoc.data
        budgetIds.add(budget_id)
        monthsToDelete.push({
          docId: monthDoc.id,
          budgetId: budget_id,
          year,
          month,
        })
      }

      // Sort by budget, then year, then month
      monthsToDelete.sort((a, b) => {
        if (a.budgetId !== b.budgetId) return a.budgetId.localeCompare(b.budgetId)
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      setStatus({
        monthsToDelete,
        monthsCount: monthsToDelete.length,
        budgetCount: budgetIds.size,
      })
    } catch {
      // Error handled by Firebase logging
    } finally {
      setIsScanning(false)
    }
  }

  async function deleteAllMonths() {
    if (!currentUser) return
    if (!status || status.monthsToDelete.length === 0) return

    setIsDeleting(true)
    setDeleteResult(null)

    const total = status.monthsToDelete.length
    const affectedBudgetIds = new Set<string>()
    const errors: string[] = []

    // Collect all budget IDs from months to delete
    for (const monthInfo of status.monthsToDelete) {
      affectedBudgetIds.add(monthInfo.budgetId)
    }

    // Phase 1: Delete all months in batches (0-70% of progress)
    setDeleteProgress({
      phase: 'deleting',
      deleted: 0,
      total,
      currentMonth: null,
      budgetsRecalculated: 0,
      totalBudgets: status.budgetCount,
      percentComplete: 0,
    })

    // Prepare batch delete documents
    const docsToDelete = status.monthsToDelete.map((monthInfo) => ({
      collectionPath: 'months',
      docId: monthInfo.docId,
    }))

    let deleted = 0
    try {
      await batchDeleteDocs(
        docsToDelete,
        'delete all months: batch deleting all month documents',
        (deletedSoFar) => {
          deleted = deletedSoFar
          setDeleteProgress({
            phase: 'deleting',
            deleted: deletedSoFar,
            total,
            currentMonth: `Batch ${Math.ceil(deletedSoFar / 500)} of ${Math.ceil(total / 500)}`,
            budgetsRecalculated: 0,
            totalBudgets: status.budgetCount,
            percentComplete: Math.round((deletedSoFar / total) * 70),
          })
        }
      )
      deleted = total // All successful
    } catch (err) {
      errors.push(`Batch delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    // Phase 2: Reset all affected budgets (balances to zero) (70-95% of progress)
    const budgetIds = Array.from(affectedBudgetIds)
    let budgetsReset = 0

    for (const budgetId of budgetIds) {
      setDeleteProgress({
        phase: 'resetting-budgets',
        deleted,
        total,
        currentMonth: `Budget ${budgetsReset + 1}/${budgetIds.length}`,
        budgetsRecalculated: budgetsReset,
        totalBudgets: budgetIds.length,
        percentComplete: 70 + Math.round((budgetsReset / budgetIds.length) * 25),
      })

      try {
        await resetBudgetBalances(budgetId)
        budgetsReset++
      } catch {
        // Don't add to errors - reset failure is non-critical
        budgetsReset++
      }
    }

    // Phase 3: Clear cache using migration framework (95-100%)
    setDeleteProgress({
      phase: 'clearing-cache',
      deleted,
      total,
      currentMonth: null,
      budgetsRecalculated: budgetsReset,
      totalBudgets: budgetIds.length,
      percentComplete: 95,
    })

    // Use the migration framework's cache clearing (ensures consistency)
    clearAllCaches()

    // Final progress update
    setDeleteProgress({
      phase: 'complete',
      deleted,
      total,
      currentMonth: null,
      budgetsRecalculated: budgetsReset,
      totalBudgets: budgetIds.length,
      percentComplete: 100,
    })

    setDeleteResult({ deleted, errors, budgetsRecalculated: budgetsReset })
    setIsDeleting(false)
    setDeleteProgress(null)

    // Clear the status and trigger onComplete only on success (no errors)
    if (errors.length === 0) {
      setStatus({
        monthsToDelete: [],
        monthsCount: 0,
        budgetCount: 0,
      })
      onComplete?.()
    }
  }

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    // Delete
    isDeleting,
    deleteResult,
    deleteProgress,
    deleteAllMonths,
  }
}

