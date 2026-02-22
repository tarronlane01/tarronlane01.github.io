/**
 * Remove Legacy Balance Fields Migration
 *
 * This one-time migration removes deprecated fields from budget documents:
 * - category_balances_cache
 * - category_balances_snapshot
 *
 * These fields are no longer used - ALL-TIME balances are now calculated
 * by ensuring the last finalized month is always loaded.
 */

import { useState } from 'react'
import type { FirestoreData } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgets } from './migrationDataHelpers'
// eslint-disable-next-line no-restricted-imports
import { updateDocByPath, deleteField } from '@firestore'
import { cleanForFirestore } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

export interface RemoveLegacyBalanceFieldsMigrationStatus {
  totalBudgets: number
  budgetsWithLegacyFields: number
}

export interface RemoveLegacyBalanceFieldsMigrationResult {
  budgetsProcessed: number
  budgetsUpdated: number
  errors: string[]
}

// ============================================================================
// HELPERS
// ============================================================================

function hasLegacyFields(budgetData: FirestoreData): boolean {
  return 'category_balances_cache' in budgetData || 'category_balances_snapshot' in budgetData
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

export async function scanRemoveLegacyBalanceFieldsStatus(): Promise<RemoveLegacyBalanceFieldsMigrationStatus> {
  const budgets = await readAllBudgets('remove-legacy-balance-fields-scan')
  
  let budgetsWithLegacyFields = 0

  for (const budget of budgets) {
    if (hasLegacyFields(budget.data as FirestoreData)) {
      budgetsWithLegacyFields++
    }
  }

  return {
    totalBudgets: budgets.length,
    budgetsWithLegacyFields,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

export async function runRemoveLegacyBalanceFieldsMigration(
  progress: ProgressReporter
): Promise<RemoveLegacyBalanceFieldsMigrationResult> {
  const result: RemoveLegacyBalanceFieldsMigrationResult = {
    budgetsProcessed: 0,
    budgetsUpdated: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets...')
  progress.setProgress(null)
  
  const budgets = await readAllBudgets('remove-legacy-balance-fields-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  progress.setStage('Processing budgets...')

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    progress.updateItemProgress(i + 1, budgets.length, `Budget: ${budget.id.slice(0, 20)}`)

    try {
      const budgetData = budget.data as FirestoreData
      
      if (!hasLegacyFields(budgetData)) {
        result.budgetsProcessed++
        continue
      }

      // Remove legacy fields using deleteField()
      const updateData: FirestoreData = {
        category_balances_cache: deleteField(),
        category_balances_snapshot: deleteField(),
        updated_at: new Date().toISOString(),
      }

      await updateDocByPath(
        'budgets',
        budget.id,
        cleanForFirestore(updateData),
        'remove-legacy-balance-fields-migration'
      )

      result.budgetsUpdated++
      result.budgetsProcessed++
    } catch (err) {
      result.errors.push(
        `Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`
      )
      result.budgetsProcessed++
    }
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRemoveLegacyBalanceFieldsMigrationOptions {
  currentUser: unknown
}

export function useRemoveLegacyBalanceFieldsMigration({ currentUser }: UseRemoveLegacyBalanceFieldsMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RemoveLegacyBalanceFieldsMigrationStatus | null>(null)
  const [result, setResult] = useState<RemoveLegacyBalanceFieldsMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRemoveLegacyBalanceFieldsStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan legacy balance fields status:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function runMigrationHandler(): Promise<void> {
    if (!currentUser) return
    setIsRunning(true)
    setResult(null)
    try {
      const migrationResult = await runMigrationWithProgress(
        'Remove Legacy Balance Fields Migration',
        (progress) => runRemoveLegacyBalanceFieldsMigration(progress)
      )
      setResult(migrationResult)
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        budgetsUpdated: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  const needsMigration = status !== null && status.budgetsWithLegacyFields > 0
  const totalItemsToFix = status?.budgetsWithLegacyFields ?? 0

  return {
    isScanning,
    isRunning,
    status,
    result,
    scanStatus,
    runMigration: runMigrationHandler,
    needsMigration,
    totalItemsToFix,
  }
}
