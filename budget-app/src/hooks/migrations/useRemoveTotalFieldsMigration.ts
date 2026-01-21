/**
 * Remove Total Fields Migration
 *
 * This one-time migration removes calculated total fields from month documents:
 * - total_income (calculated from income array)
 * - total_expenses (calculated from expenses array)
 *
 * These fields are now calculated on-the-fly when reading from Firestore.
 * This is a one-time migration to clean up existing documents.
 */

import { useState } from 'react'
import type { FirestoreData, MonthDocument } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, batchWriteMonths, type MonthUpdate } from './migrationDataHelpers'

// ============================================================================
// TYPES
// ============================================================================

export interface RemoveTotalFieldsMigrationStatus {
  totalBudgets: number
  totalMonths: number
  monthsNeedingMigration: number
  monthsWithTotalIncome: number
  monthsWithTotalExpenses: number
}

export interface RemoveTotalFieldsMigrationResult {
  budgetsProcessed: number
  monthsProcessed: number
  monthsUpdated: number
  errors: string[]
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

/**
 * Scan all months to determine migration status.
 */
export async function scanRemoveTotalFieldsStatus(): Promise<RemoveTotalFieldsMigrationStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('remove-total-fields-migration-scan')
  
  let monthsNeedingMigration = 0
  let monthsWithTotalIncome = 0
  let monthsWithTotalExpenses = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    for (const month of months) {
      const monthData = month.data as FirestoreData
      
      // Check if month has total_income or total_expenses
      const hasTotalIncome = 'total_income' in monthData && monthData.total_income !== undefined
      const hasTotalExpenses = 'total_expenses' in monthData && monthData.total_expenses !== undefined
      
      if (hasTotalIncome) {
        monthsWithTotalIncome++
      }
      if (hasTotalExpenses) {
        monthsWithTotalExpenses++
      }
      
      if (hasTotalIncome || hasTotalExpenses) {
        monthsNeedingMigration++
      }
    }
  }

  const totalMonths = monthsByBudget.size > 0 
    ? Array.from(monthsByBudget.values()).reduce((sum, months) => sum + months.length, 0)
    : 0

  return {
    totalBudgets: budgets.length,
    totalMonths,
    monthsNeedingMigration,
    monthsWithTotalIncome,
    monthsWithTotalExpenses,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Remove total_income and total_expenses from all month documents.
 */
export async function runRemoveTotalFieldsMigration(
  progress: ProgressReporter
): Promise<RemoveTotalFieldsMigrationResult> {
  const result: RemoveTotalFieldsMigrationResult = {
    budgetsProcessed: 0,
    monthsProcessed: 0,
    monthsUpdated: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets and months...')
  progress.setProgress(null)
  
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('remove-total-fields-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  const monthUpdates: MonthUpdate[] = []
  progress.setStage('Processing months...')

  let totalMonths = 0
  for (const months of monthsByBudget.values()) {
    totalMonths += months.length
  }

  let processedCount = 0

  for (const budget of budgets) {
    try {
      const months = monthsByBudget.get(budget.id) || []
      
      for (const month of months) {
        processedCount++
        const monthData = month.data as FirestoreData
        
        progress.updateItemProgress(
          processedCount,
          totalMonths,
          `Month ${monthData.year}/${monthData.month}`
        )

        // Check if month has total_income or total_expenses
        const hasTotalIncome = 'total_income' in monthData && monthData.total_income !== undefined
        const hasTotalExpenses = 'total_expenses' in monthData && monthData.total_expenses !== undefined

        if (hasTotalIncome || hasTotalExpenses) {
          // Build month data without total_income and total_expenses
          // batchWriteMonths uses batch.set() which replaces the entire document,
          // so we just exclude these fields from the data
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove fields
          const { total_income: _total_income, total_expenses: _total_expenses, ...monthDataWithoutTotals } = monthData as {
            total_income?: number
            total_expenses?: number
            [key: string]: unknown
          }
          
          monthUpdates.push({
            budgetId: budget.id,
            year: monthData.year as number,
            month: monthData.month as number,
            data: {
              ...monthDataWithoutTotals,
              updated_at: new Date().toISOString(),
            } as MonthDocument,
          })
          
          result.monthsUpdated++
        }
        
        result.monthsProcessed++
      }
      
      if (months.length > 0) {
        result.budgetsProcessed++
      }
    } catch (err) {
      result.errors.push(
        `Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Write all updates in batches
  if (monthUpdates.length > 0) {
    progress.setStage(`Writing ${monthUpdates.length} month update(s)...`)
    progress.setProgress(null)
    progress.setCurrentItem(`${monthUpdates.length} month(s) to update`)
    
    await batchWriteMonths(monthUpdates, 'remove-total-fields-migration')
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRemoveTotalFieldsMigrationOptions {
  currentUser: unknown
}

export function useRemoveTotalFieldsMigration({ currentUser }: UseRemoveTotalFieldsMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RemoveTotalFieldsMigrationStatus | null>(null)
  const [result, setResult] = useState<RemoveTotalFieldsMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRemoveTotalFieldsStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan remove total fields status:', err)
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
        'Remove Total Fields Migration',
        (progress) => runRemoveTotalFieldsMigration(progress)
      )
      setResult(migrationResult)
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        monthsProcessed: 0,
        monthsUpdated: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  const needsMigration =
    status !== null && status.monthsNeedingMigration > 0
  const totalItemsToFix = status?.monthsNeedingMigration ?? 0

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
