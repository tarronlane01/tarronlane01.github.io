/**
 * Database Cleanup Hook
 *
 * Consolidated migration that ensures all database documents match expected schemas.
 * Combines functionality from multiple previous migrations:
 *
 * 1. Budget Schema Validation:
 *    - Converts arrays to maps (accounts, categories, account_groups)
 *    - Ensures all accounts have required fields with defaults
 *    - Ensures all categories have required fields with defaults
 *    - Ensures all account_groups have required fields with defaults
 *
 * 2. Month Schema Validation:
 *    - Ensures months have all required fields
 *    - Removes months beyond MAX_FUTURE_MONTHS (defined in @constants/date)
 *
 * 3. Data Mappings Validation:
 *    - Ensures data_mappings documents have required budget_id field
 *
 * All operations go directly to Firestore - no React Query caching.
 */

import { useState } from 'react'

import type { DatabaseCleanupStatus, DatabaseCleanupResult, FutureMonthInfo } from './databaseCleanupTypes'
import { scanDatabaseStatus } from './databaseCleanupScanner'
import { runDatabaseCleanup } from './databaseCleanupRunner'

// Re-export types for consumers
export type { DatabaseCleanupStatus, DatabaseCleanupResult, FutureMonthInfo }

interface UseDatabaseCleanupOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useDatabaseCleanup({ currentUser, onComplete }: UseDatabaseCleanupOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<DatabaseCleanupStatus | null>(null)
  const [result, setResult] = useState<DatabaseCleanupResult | null>(null)

  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      const scanResult = await scanDatabaseStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan database:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function runCleanup(): Promise<void> {
    if (!currentUser) return

    setIsRunning(true)
    setResult(null)

    try {
      const cleanupResult = await runDatabaseCleanup()
      setResult(cleanupResult)
      onComplete?.()
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        accountsFixed: 0,
        categoriesFixed: 0,
        groupsFixed: 0,
        arraysConverted: 0,
        monthMapsUpdated: 0,
        deprecatedFieldsRemoved: 0,
        futureMonthsDeleted: 0,
        monthsFixed: 0,
        oldRecalcFieldsRemoved: 0,
        dataMappingsFixed: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  // Computed properties
  const hasIssues = status !== null && (
    status.budgetsWithArrays > 0 ||
    status.accountsNeedingDefaults > 0 ||
    status.categoriesNeedingDefaults > 0 ||
    status.groupsNeedingDefaults > 0 ||
    status.budgetsNeedingMonthMapUpdate > 0 ||
    status.budgetsWithDeprecatedEarliestMonth > 0 ||
    status.futureMonthsToDelete.length > 0 ||
    status.monthsWithSchemaIssues > 0 ||
    status.monthsWithOldRecalcField > 0 ||
    status.dataMappingsMissingBudgetId > 0
  )

  const totalIssues = status !== null ? (
    status.budgetsWithArrays +
    status.accountsNeedingDefaults +
    status.categoriesNeedingDefaults +
    status.groupsNeedingDefaults +
    status.budgetsNeedingMonthMapUpdate +
    status.budgetsWithDeprecatedEarliestMonth +
    status.futureMonthsToDelete.length +
    status.monthsWithSchemaIssues +
    status.monthsWithOldRecalcField +
    status.dataMappingsMissingBudgetId
  ) : 0

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    hasIssues,
    totalIssues,
    // Cleanup
    isRunning,
    result,
    runCleanup,
  }
}
