/**
 * Future Months Cleanup Hook
 *
 * Deletes month documents that are more than 2 months in the future.
 * These documents are created when users accidentally navigate to future months.
 *
 * All operations go directly to Firestore - no React Query caching.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { deleteDocByPath, queryCollection } from '../../data/firestore/operations'

export interface FutureMonthInfo {
  docId: string
  budgetId: string
  year: number
  month: number
}

export interface FutureMonthsCleanupResult {
  deleted: number
  errors: string[]
}

export interface FutureMonthsStatus {
  futureMonthsToDelete: FutureMonthInfo[]
  futureMonthsCount: number
}

/**
 * Get cutoff date (2 months from now) - anything beyond should be deleted
 */
function getFutureMonthCutoff(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let cutoffMonth = currentMonth + 2
  let cutoffYear = currentYear

  if (cutoffMonth > 12) {
    cutoffMonth -= 12
    cutoffYear += 1
  }

  return { year: cutoffYear, month: cutoffMonth }
}

function isMonthBeyondCutoff(
  year: number,
  month: number,
  cutoff: { year: number; month: number }
): boolean {
  if (year > cutoff.year) return true
  if (year === cutoff.year && month > cutoff.month) return true
  return false
}

interface UseFutureMonthsCleanupOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useFutureMonthsCleanup({
  currentUser,
  onComplete,
}: UseFutureMonthsCleanupOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isCleaningFutureMonths, setIsCleaningFutureMonths] = useState(false)
  const [status, setStatus] = useState<FutureMonthsStatus | null>(null)
  const [futureMonthsCleanupResult, setFutureMonthsCleanupResult] = useState<FutureMonthsCleanupResult | null>(null)

  // Scan for future months (direct Firestore, no caching)
  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      const cutoff = getFutureMonthCutoff()
      const monthsResult = await queryCollection<{
        budget_id: string
        year: number
        month: number
      }>(
        'months',
        'future months cleanup: scanning for future months'
      )

      const futureMonthsToDelete: FutureMonthInfo[] = []
      for (const monthDoc of monthsResult.docs) {
        const { budget_id, year, month } = monthDoc.data
        if (isMonthBeyondCutoff(year, month, cutoff)) {
          futureMonthsToDelete.push({
            docId: monthDoc.id,
            budgetId: budget_id,
            year,
            month,
          })
        }
      }

      // Sort by date
      futureMonthsToDelete.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      setStatus({
        futureMonthsToDelete,
        futureMonthsCount: futureMonthsToDelete.length,
      })
    } catch (err) {
      console.error('Failed to scan future months:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function cleanupFutureMonths() {
    if (!currentUser) return
    if (!status || status.futureMonthsToDelete.length === 0) return

    setIsCleaningFutureMonths(true)
    setFutureMonthsCleanupResult(null)

    let deleted = 0
    const errors: string[] = []

    for (const monthInfo of status.futureMonthsToDelete) {
      try {
        await deleteDocByPath(
          'months',
          monthInfo.docId,
          `future months cleanup: deleting future month ${monthInfo.year}-${monthInfo.month}`
        )
        deleted++
      } catch (err) {
        errors.push(`Failed to delete ${monthInfo.docId}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setFutureMonthsCleanupResult({ deleted, errors })
    setIsCleaningFutureMonths(false)

    onComplete?.()
  }

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    // Cleanup
    isCleaningFutureMonths,
    futureMonthsCleanupResult,
    cleanupFutureMonths,
  }
}

