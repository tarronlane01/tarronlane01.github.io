/**
 * Precision Cleanup Hook
 *
 * React hook for managing precision cleanup state and operations.
 * Uses the migration framework to ensure cache invalidation.
 */

import { useState, useCallback } from 'react'
import type { PrecisionCleanupStatus, PrecisionCleanupResult } from './precisionCleanupTypes'
import { scanPrecisionStatus } from './precisionCleanupScanner'
import { runPrecisionCleanup } from './precisionCleanupRunner'
import { runMigration } from './migrationRunner'

interface UsePrecisionCleanupOptions {
  currentUser: unknown
  /** Called when cleanup completes successfully */
  onComplete?: () => void
}

export function usePrecisionCleanup({ currentUser, onComplete }: UsePrecisionCleanupOptions) {
  const [status, setStatus] = useState<PrecisionCleanupStatus | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<PrecisionCleanupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Calculate total issues
  const totalIssues = status ? (
    status.accountsWithPrecisionIssues +
    status.categoriesWithPrecisionIssues +
    status.totalAvailableWithPrecisionIssues +
    status.incomeValuesWithPrecisionIssues +
    status.expenseValuesWithPrecisionIssues +
    status.categoryBalancesWithPrecisionIssues +
    status.accountBalancesWithPrecisionIssues
  ) : 0

  const hasIssues = totalIssues > 0

  // Scan for precision issues
  const scan = useCallback(async () => {
    if (!currentUser) return
    setIsScanning(true)
    setError(null)
    try {
      const scanResult = await scanPrecisionStatus()
      setStatus(scanResult)
      setResult(null) // Clear previous result when re-scanning
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan for precision issues')
    } finally {
      setIsScanning(false)
    }
  }, [currentUser])

  // Run the cleanup using the migration framework (guarantees cache invalidation)
  const runCleanup = useCallback(async () => {
    if (!currentUser || !hasIssues) return
    setIsRunning(true)
    setError(null)
    try {
      // runMigration automatically clears all caches after completion
      const cleanupResult = await runMigration(() => runPrecisionCleanup())
      setResult(cleanupResult)
      // Re-scan to update status (reads fresh from Firestore since cache was cleared)
      const newStatus = await scanPrecisionStatus()
      setStatus(newStatus)
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run precision cleanup')
    } finally {
      setIsRunning(false)
    }
  }, [currentUser, hasIssues, onComplete])

  return {
    status,
    isScanning,
    isRunning,
    result,
    error,
    totalIssues,
    hasIssues,
    hasData: status !== null,
    scan,
    runCleanup,
  }
}

// Re-export types for convenience
export type { PrecisionCleanupStatus, PrecisionCleanupResult }

