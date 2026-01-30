/**
 * Percentage Income Months Back Migration
 *
 * One-time migration to add percentage_income_months_back to all budget documents.
 * Defaults to 1 (use previous month's income for percentage-based allocations).
 * When set to 2, percentage-based allocations use income from two months ago.
 */

import { useState } from 'react'
import type { FirestoreData } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgets, batchWriteBudgets, type BudgetUpdate } from './migrationDataHelpers'

// ============================================================================
// TYPES
// ============================================================================

export interface PercentageIncomeMonthsBackMigrationStatus {
  totalBudgets: number
  budgetsNeedingMigration: number
}

export interface PercentageIncomeMonthsBackMigrationResult {
  budgetsProcessed: number
  budgetsUpdated: number
  errors: string[]
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

/**
 * Scan all budgets to find those missing percentage_income_months_back.
 */
export async function scanPercentageIncomeMonthsBackStatus(): Promise<PercentageIncomeMonthsBackMigrationStatus> {
  const budgets = await readAllBudgets('percentage-income-months-back-migration-scan')

  let budgetsNeedingMigration = 0
  for (const budget of budgets) {
    const data = budget.data as FirestoreData
    if (data.percentage_income_months_back === undefined) {
      budgetsNeedingMigration++
    }
  }

  return {
    totalBudgets: budgets.length,
    budgetsNeedingMigration,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Add percentage_income_months_back: 1 to all budgets that don't have it.
 */
export async function runPercentageIncomeMonthsBackMigration(
  progress: ProgressReporter
): Promise<PercentageIncomeMonthsBackMigrationResult> {
  const result: PercentageIncomeMonthsBackMigrationResult = {
    budgetsProcessed: 0,
    budgetsUpdated: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets...')
  progress.setProgress(null)

  const budgets = await readAllBudgets('percentage-income-months-back-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  const budgetUpdates: BudgetUpdate[] = []

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    progress.updateItemProgress(i + 1, budgets.length, `Budget: ${(budget.data as FirestoreData).name ?? budget.id}`)

    try {
      const data = budget.data as FirestoreData
      if (data.percentage_income_months_back === undefined) {
        budgetUpdates.push({
          budgetId: budget.id,
          data: {
            ...data,
            percentage_income_months_back: 1,
          },
        })
        result.budgetsProcessed++
      }
    } catch (err) {
      result.errors.push(`Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (budgetUpdates.length > 0) {
    progress.setStage('Writing budget updates...')
    progress.setProgress(null)
    progress.setCurrentItem(`${budgetUpdates.length} budget(s) to update`)
    await batchWriteBudgets(budgetUpdates, 'percentage-income-months-back-migration')
    result.budgetsUpdated = budgetUpdates.length
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UsePercentageIncomeMonthsBackMigrationOptions {
  currentUser: unknown
}

export function usePercentageIncomeMonthsBackMigration({ currentUser }: UsePercentageIncomeMonthsBackMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<PercentageIncomeMonthsBackMigrationStatus | null>(null)
  const [result, setResult] = useState<PercentageIncomeMonthsBackMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanPercentageIncomeMonthsBackStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan percentage income months back status:', err)
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
        'Percentage Income Months Back',
        (progress) => runPercentageIncomeMonthsBackMigration(progress)
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

  const needsMigration = status !== null && status.budgetsNeedingMigration > 0
  const totalItemsToFix = status?.budgetsNeedingMigration ?? 0

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
