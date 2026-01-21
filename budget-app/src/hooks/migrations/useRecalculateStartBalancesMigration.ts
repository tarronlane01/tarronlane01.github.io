/**
 * Recalculate Start Balances Migration
 *
 * This maintenance migration recalculates and saves start_balance for all months
 * from the first month in each budget up to the earliest month in the window.
 *
 * This is useful if start balances need to be recalculated (e.g., after data corrections).
 * Only months at or before the window will have their start_balance saved to Firestore.
 */

import { useState } from 'react'
import type { FirestoreData, MonthDocument } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, batchWriteMonths, type MonthUpdate } from './migrationDataHelpers'
import { getFirstWindowMonth } from '@utils/window'
import { getYearMonthOrdinal } from '@utils'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from '@data/recalculation/recalculateMonth'
import { convertMonthBalancesToStored } from '@data/firestore/converters/monthBalances'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'

// ============================================================================
// TYPES
// ============================================================================

export interface RecalculateStartBalancesMigrationStatus {
  totalBudgets: number
  totalMonths: number
  monthsNeedingRecalculation: number
}

export interface RecalculateStartBalancesMigrationResult {
  budgetsProcessed: number
  monthsProcessed: number
  monthsUpdated: number
  errors: string[]
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

/**
 * Scan all budgets to determine migration status.
 */
export async function scanRecalculateStartBalancesStatus(): Promise<RecalculateStartBalancesMigrationStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('recalculate-start-balances-migration-scan')
  
  const firstWindowMonth = getFirstWindowMonth()
  const firstWindowOrdinal = getYearMonthOrdinal(firstWindowMonth.year, firstWindowMonth.month)
  
  let monthsNeedingRecalculation = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    
    // Find months from first month up to earliest window month
    const monthsToRecalculate = months.filter(month => {
      const monthData = month.data as FirestoreData
      const monthOrdinal = getYearMonthOrdinal(monthData.year as number, monthData.month as number)
      return monthOrdinal <= firstWindowOrdinal
    })
    
    monthsNeedingRecalculation += monthsToRecalculate.length
  }

  const totalMonths = monthsByBudget.size > 0 
    ? Array.from(monthsByBudget.values()).reduce((sum, months) => sum + months.length, 0)
    : 0

  return {
    totalBudgets: budgets.length,
    totalMonths,
    monthsNeedingRecalculation,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Recalculate and save start_balance for all months from first month up to earliest window month.
 */
export async function runRecalculateStartBalancesMigration(
  progress: ProgressReporter
): Promise<RecalculateStartBalancesMigrationResult> {
  const result: RecalculateStartBalancesMigrationResult = {
    budgetsProcessed: 0,
    monthsProcessed: 0,
    monthsUpdated: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets and months...')
  progress.setProgress(null)
  
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('recalculate-start-balances-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  const firstWindowMonth = getFirstWindowMonth()
  const firstWindowOrdinal = getYearMonthOrdinal(firstWindowMonth.year, firstWindowMonth.month)

  const monthUpdates: MonthUpdate[] = []
  progress.setStage('Processing months...')

  // Calculate total months to process
  let totalMonthsToProcess = 0
  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    const monthsToRecalculate = months.filter(month => {
      const monthData = month.data as FirestoreData
      const monthOrdinal = getYearMonthOrdinal(monthData.year as number, monthData.month as number)
      return monthOrdinal <= firstWindowOrdinal
    })
    totalMonthsToProcess += monthsToRecalculate.length
  }

  let processedCount = 0

  for (const budget of budgets) {
    try {
      const months = monthsByBudget.get(budget.id) || []
      
      // Filter and sort months from first month up to earliest window month
      const monthsToRecalculate = months
        .filter(month => {
          const monthData = month.data as FirestoreData
          const monthOrdinal = getYearMonthOrdinal(monthData.year as number, monthData.month as number)
          return monthOrdinal <= firstWindowOrdinal
        })
        .sort((a, b) => {
          const aData = a.data as FirestoreData
          const bData = b.data as FirestoreData
          const aOrdinal = getYearMonthOrdinal(aData.year as number, aData.month as number)
          const bOrdinal = getYearMonthOrdinal(bData.year as number, bData.month as number)
          return aOrdinal.localeCompare(bOrdinal)
        })

      if (monthsToRecalculate.length === 0) {
        result.budgetsProcessed++
        continue
      }

      // Recalculate months sequentially (each month uses previous month's end balances)
      let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT

      for (const month of monthsToRecalculate) {
        processedCount++
        const monthData = month.data as FirestoreData
        const year = monthData.year as number
        const monthNum = monthData.month as number
        
        progress.updateItemProgress(
          processedCount,
          totalMonthsToProcess,
          `Budget ${budget.id}: ${year}/${monthNum}`
        )

        // Build month document from stored data
        const monthDocBase: MonthDocument = {
          budget_id: budget.id,
          year_month_ordinal: monthData.year_month_ordinal as string,
          year,
          month: monthNum,
          income: monthData.income || [],
          total_income: 0, // Will be recalculated
          previous_month_income: 0, // Will be recalculated
          expenses: monthData.expenses || [],
          total_expenses: 0, // Will be recalculated
          transfers: monthData.transfers || [],
          adjustments: monthData.adjustments || [],
          account_balances: monthData.account_balances || [],
          category_balances: monthData.category_balances || [],
          are_allocations_finalized: monthData.are_allocations_finalized ?? false,
          created_at: monthData.created_at,
          updated_at: monthData.updated_at,
        }

        // Convert stored format to calculated format for recalculation
        const monthDoc = convertMonthBalancesFromStored(monthDocBase)

        // Recalculate using previous month's snapshot
        const recalculated = recalculateMonth(monthDoc, prevSnapshot)
        
        // Update snapshot for next month
        prevSnapshot = extractSnapshotFromMonth(recalculated)

        // Convert back to stored format (only saves start_balance for months at/before window)
        const storedMonth = convertMonthBalancesToStored(recalculated)

        monthUpdates.push({
          budgetId: budget.id,
          year,
          month: monthNum,
          data: storedMonth,
        })
        
        result.monthsUpdated++
        result.monthsProcessed++
      }
      
      result.budgetsProcessed++
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
    
    await batchWriteMonths(monthUpdates, 'recalculate-start-balances-migration')
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRecalculateStartBalancesMigrationOptions {
  currentUser: unknown
}

export function useRecalculateStartBalancesMigration({ currentUser }: UseRecalculateStartBalancesMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RecalculateStartBalancesMigrationStatus | null>(null)
  const [result, setResult] = useState<RecalculateStartBalancesMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRecalculateStartBalancesStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan recalculate start balances status:', err)
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
        'Recalculate Start Balances Migration',
        (progress) => runRecalculateStartBalancesMigration(progress)
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

  const needsMigration = status !== null && status.monthsNeedingRecalculation > 0
  const totalItemsToFix = status?.monthsNeedingRecalculation ?? 0

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
