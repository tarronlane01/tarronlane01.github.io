/**
 * Delete All Months Migration Hook
 *
 * Deletes ALL month documents from Firebase for ALL budgets.
 * This is a destructive operation - use with caution!
 *
 * All operations go directly to Firestore - no React Query caching.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { deleteDocByPath, queryCollection } from '@firestore'

export interface MonthInfo {
  docId: string
  budgetId: string
  year: number
  month: number
}

export interface DeleteAllMonthsResult {
  deleted: number
  errors: string[]
}

export interface DeleteAllMonthsStatus {
  monthsToDelete: MonthInfo[]
  monthsCount: number
  budgetCount: number
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
    } catch (err) {
      console.error('Failed to scan months:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function deleteAllMonths() {
    if (!currentUser) return
    if (!status || status.monthsToDelete.length === 0) return

    setIsDeleting(true)
    setDeleteResult(null)

    let deleted = 0
    const errors: string[] = []

    for (const monthInfo of status.monthsToDelete) {
      try {
        await deleteDocByPath(
          'months',
          monthInfo.docId,
          `delete all months: deleting month ${monthInfo.year}-${monthInfo.month} for budget ${monthInfo.budgetId}`
        )
        deleted++
      } catch (err) {
        errors.push(`Failed to delete ${monthInfo.docId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setDeleteResult({ deleted, errors })
    setIsDeleting(false)

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
    deleteAllMonths,
  }
}

