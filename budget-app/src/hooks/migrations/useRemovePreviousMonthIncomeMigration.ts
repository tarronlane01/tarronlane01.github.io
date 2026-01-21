/**
 * Remove Previous Month Income Migration
 *
 * This one-time migration removes previous_month_income from month documents.
 * This field is now calculated on-the-fly from the previous month's income array.
 * This is a one-time migration to clean up existing documents.
 */

import { useState } from 'react'
import type { FirestoreData, MonthDocument } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, batchWriteMonths, type MonthUpdate } from './migrationDataHelpers'

// ============================================================================
// TYPES
// ============================================================================

export interface RemovePreviousMonthIncomeMigrationStatus {
  totalBudgets: number
  totalMonths: number
  monthsNeedingMigration: number
}

export interface RemovePreviousMonthIncomeMigrationResult {
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
export async function scanRemovePreviousMonthIncomeStatus(): Promise<RemovePreviousMonthIncomeMigrationStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('remove-previous-month-income-migration-scan')
  
  let monthsNeedingMigration = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    for (const month of months) {
      const monthData = month.data as FirestoreData
      
      // Check if month has previous_month_income
      const hasPreviousMonthIncome = 'previous_month_income' in monthData && monthData.previous_month_income !== undefined
      
      if (hasPreviousMonthIncome) {
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
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Remove previous_month_income from all month documents.
 */
export async function runRemovePreviousMonthIncomeMigration(
  progress: ProgressReporter
): Promise<RemovePreviousMonthIncomeMigrationResult> {
  const result: RemovePreviousMonthIncomeMigrationResult = {
    budgetsProcessed: 0,
    monthsProcessed: 0,
    monthsUpdated: 0,
    errors: [],
  }

  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('remove-previous-month-income-migration')

  progress.setStage(`Processing ${budgets.length} budget(s)...`)
  progress.setProgress(0)

  const monthUpdates: MonthUpdate[] = []

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    progress.setProgress((i / budgets.length) * 100)
    progress.setCurrentItem(`Budget ${i + 1}/${budgets.length}: ${budget.id}`)

    try {
      const months = monthsByBudget.get(budget.id) || []

      for (const month of months) {
        const monthData = month.data as FirestoreData

        // Check if month has previous_month_income
        const hasPreviousMonthIncome = 'previous_month_income' in monthData && monthData.previous_month_income !== undefined

        if (hasPreviousMonthIncome) {
          // Build month data without previous_month_income
          // batchWriteMonths uses batch.set() which replaces the entire document,
          // so we just exclude this field from the data
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove field
          const { previous_month_income: _previous_month_income, ...monthDataWithoutPreviousIncome } = monthData as {
            previous_month_income?: number
            [key: string]: unknown
          }
          
          monthUpdates.push({
            budgetId: budget.id,
            year: monthData.year as number,
            month: monthData.month as number,
            data: {
              ...monthDataWithoutPreviousIncome,
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
    
    await batchWriteMonths(monthUpdates, 'remove-previous-month-income-migration')
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRemovePreviousMonthIncomeMigrationOptions {
  currentUser: unknown
}

export function useRemovePreviousMonthIncomeMigration({ currentUser }: UseRemovePreviousMonthIncomeMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RemovePreviousMonthIncomeMigrationStatus | null>(null)
  const [result, setResult] = useState<RemovePreviousMonthIncomeMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRemovePreviousMonthIncomeStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan remove previous month income status:', err)
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
        'Remove Previous Month Income Migration',
        (progress) => runRemovePreviousMonthIncomeMigration(progress)
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
