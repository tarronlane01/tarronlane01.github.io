/**
 * Restore From Diagnostic Migration
 *
 * This migration restores month data (transfers, adjustments) from a diagnostic JSON file.
 * Use this when data has been accidentally lost due to bugs.
 *
 * The diagnostic file contains rawMonthData with full transaction arrays that can be
 * used to restore the database to a known good state.
 */

import { useState } from 'react'
import type { MonthDocument, TransferTransaction, AdjustmentTransaction, FirestoreData } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, type MonthUpdate } from './migrationDataHelpers'
import { writeMonthUpdatesAndRecalculate } from './migrationDataHelpers'

// ============================================================================
// TYPES
// ============================================================================

/** Raw month data from the diagnostic file */
interface DiagnosticMonth {
  year: number
  month: number
  income?: unknown[]
  expenses?: unknown[]
  transfers?: TransferTransaction[]
  adjustments?: AdjustmentTransaction[]
  categoryBalances?: unknown[]
  accountBalances?: unknown[]
}

/** Budget entry from the diagnostic file */
interface DiagnosticBudget {
  budgetId: string
  budgetName: string
  rawMonthData: DiagnosticMonth[]
}

/** Full diagnostic file structure */
interface DiagnosticFile {
  timestamp: string
  budgets: DiagnosticBudget[]
}

/** Status from scanning */
export interface RestoreStatus {
  diagnosticTimestamp: string
  budgetsInFile: number
  monthsToRestore: number
  transfersToRestore: number
  adjustmentsToRestore: number
  monthDetails: {
    budgetId: string
    year: number
    month: number
    currentTransfers: number
    diagnosticTransfers: number
    currentAdjustments: number
    diagnosticAdjustments: number
  }[]
}

/** Result of running the migration */
export interface RestoreResult {
  success: boolean
  monthsUpdated: number
  transfersRestored: number
  adjustmentsRestored: number
  errors: string[]
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

/**
 * Scan and compare diagnostic file with current database state.
 * Returns details about what would be restored.
 */
export async function scanRestoreStatus(diagnosticJson: string): Promise<RestoreStatus> {
  // Parse the diagnostic file
  const diagnostic: DiagnosticFile = JSON.parse(diagnosticJson)

  // Read current database state
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('restore-diagnostic-scan')

  const status: RestoreStatus = {
    diagnosticTimestamp: diagnostic.timestamp,
    budgetsInFile: diagnostic.budgets.length,
    monthsToRestore: 0,
    transfersToRestore: 0,
    adjustmentsToRestore: 0,
    monthDetails: [],
  }

  // For each budget in the diagnostic
  for (const diagBudget of diagnostic.budgets) {
    // Find matching budget in database
    const dbBudget = budgets.find(b => b.id === diagBudget.budgetId)
    if (!dbBudget) continue

    const dbMonths = monthsByBudget.get(diagBudget.budgetId) || []

    // For each month in the diagnostic
    for (const diagMonth of diagBudget.rawMonthData) {
      const diagTransfers = diagMonth.transfers || []
      const diagAdjustments = diagMonth.adjustments || []

      // Skip months with no transfers or adjustments in diagnostic
      if (diagTransfers.length === 0 && diagAdjustments.length === 0) continue

      // Find matching month in database
      const dbMonth = dbMonths.find(m => m.year === diagMonth.year && m.month === diagMonth.month)
      const dbMonthData = dbMonth?.data as MonthDocument | undefined
      const currentTransfers = (dbMonthData?.transfers || []).length
      const currentAdjustments = (dbMonthData?.adjustments || []).length

      // Check if restore would add data
      const wouldRestoreTransfers = diagTransfers.length > currentTransfers
      const wouldRestoreAdjustments = diagAdjustments.length > currentAdjustments

      if (wouldRestoreTransfers || wouldRestoreAdjustments) {
        status.monthsToRestore++
        status.transfersToRestore += Math.max(0, diagTransfers.length - currentTransfers)
        status.adjustmentsToRestore += Math.max(0, diagAdjustments.length - currentAdjustments)
        status.monthDetails.push({
          budgetId: diagBudget.budgetId,
          year: diagMonth.year,
          month: diagMonth.month,
          currentTransfers,
          diagnosticTransfers: diagTransfers.length,
          currentAdjustments,
          diagnosticAdjustments: diagAdjustments.length,
        })
      }
    }
  }

  return status
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Run the restore migration.
 * Restores transfers and adjustments from the diagnostic file.
 */
export async function runRestoreFromDiagnostic(
  diagnosticJson: string,
  progress: ProgressReporter
): Promise<RestoreResult> {
  const result: RestoreResult = {
    success: false,
    monthsUpdated: 0,
    transfersRestored: 0,
    adjustmentsRestored: 0,
    errors: [],
  }

  try {
    // Parse the diagnostic file
    progress.setStage('Parsing diagnostic file...')
    progress.setProgress(null)
    const diagnostic: DiagnosticFile = JSON.parse(diagnosticJson)
    progress.setDetails(`Loaded diagnostic from ${diagnostic.timestamp}`)

    // Read current database state
    progress.setStage('Reading current database state...')
    const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('restore-diagnostic-run')
    progress.setDetails(`Found ${budgets.length} budget(s)`)

    // Collect month updates
    const monthUpdates: MonthUpdate[] = []
    progress.setStage('Preparing updates...')

    for (const diagBudget of diagnostic.budgets) {
      const dbBudget = budgets.find(b => b.id === diagBudget.budgetId)
      if (!dbBudget) {
        result.errors.push(`Budget ${diagBudget.budgetId} not found in database`)
        continue
      }

      const dbMonths = monthsByBudget.get(diagBudget.budgetId) || []

      for (const diagMonth of diagBudget.rawMonthData) {
        const diagTransfers = diagMonth.transfers || []
        const diagAdjustments = diagMonth.adjustments || []

        // Skip months with no transfers or adjustments
        if (diagTransfers.length === 0 && diagAdjustments.length === 0) continue

        // Find matching month in database
        const dbMonth = dbMonths.find(m => m.year === diagMonth.year && m.month === diagMonth.month)
        if (!dbMonth) {
          // Month doesn't exist in DB - skip for now (could create it, but risky)
          continue
        }

        const dbMonthData = dbMonth.data as FirestoreData
        const currentTransfers = (dbMonthData.transfers as TransferTransaction[] | undefined) || []
        const currentAdjustments = (dbMonthData.adjustments as AdjustmentTransaction[] | undefined) || []

        // Only restore if diagnostic has more data
        const shouldRestoreTransfers = diagTransfers.length > currentTransfers.length
        const shouldRestoreAdjustments = diagAdjustments.length > currentAdjustments.length

        if (shouldRestoreTransfers || shouldRestoreAdjustments) {
          // Build updated month document
          const updatedMonth: MonthDocument = {
            budget_id: diagBudget.budgetId,
            year_month_ordinal: dbMonthData.year_month_ordinal as string,
            year: diagMonth.year,
            month: diagMonth.month,
            income: (dbMonthData.income as MonthDocument['income']) || [],
            total_income: (dbMonthData.total_income as number) ?? 0,
            previous_month_income: (dbMonthData.previous_month_income as number) ?? 0,
            expenses: (dbMonthData.expenses as MonthDocument['expenses']) || [],
            total_expenses: (dbMonthData.total_expenses as number) ?? 0,
            transfers: shouldRestoreTransfers ? diagTransfers : currentTransfers,
            adjustments: shouldRestoreAdjustments ? diagAdjustments : currentAdjustments,
            account_balances: (dbMonthData.account_balances as MonthDocument['account_balances']) || [],
            category_balances: (dbMonthData.category_balances as MonthDocument['category_balances']) || [],
            are_allocations_finalized: (dbMonthData.are_allocations_finalized as boolean) ?? false,
            created_at: dbMonthData.created_at as string,
            updated_at: new Date().toISOString(),
          }

          monthUpdates.push({
            budgetId: diagBudget.budgetId,
            year: diagMonth.year,
            month: diagMonth.month,
            data: updatedMonth,
          })

          if (shouldRestoreTransfers) {
            result.transfersRestored += diagTransfers.length - currentTransfers.length
          }
          if (shouldRestoreAdjustments) {
            result.adjustmentsRestored += diagAdjustments.length - currentAdjustments.length
          }
        }
      }
    }

    if (monthUpdates.length === 0) {
      progress.setStage('No updates needed')
      progress.setDetails('Database already matches diagnostic file')
      result.success = true
      return result
    }

    // Write updates and recalculate
    progress.setStage('Writing updates and recalculating...')
    progress.setDetails(`Updating ${monthUpdates.length} month(s)`)

    await writeMonthUpdatesAndRecalculate(monthUpdates, 'restore-from-diagnostic')

    result.monthsUpdated = monthUpdates.length
    result.success = true

    progress.setStage('Complete!')
    progress.setDetails(`Restored ${result.transfersRestored} transfers and ${result.adjustmentsRestored} adjustments`)

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}

// ============================================================================
// HOOK
// ============================================================================

export function useRestoreFromDiagnostic() {
  const [status, setStatus] = useState<RestoreStatus | null>(null)
  const [result, setResult] = useState<RestoreResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [diagnosticJson, setDiagnosticJson] = useState<string | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  const scan = async (json: string) => {
    setIsScanning(true)
    setResult(null)
    setDiagnosticJson(json)
    try {
      const scanResult = await scanRestoreStatus(json)
      setStatus(scanResult)
    } catch (error) {
      setStatus(null)
      throw error
    } finally {
      setIsScanning(false)
    }
  }

  const run = async () => {
    if (!diagnosticJson) return
    setIsRunning(true)
    try {
      const runResult = await runMigrationWithProgress(
        'Restore from Diagnostic',
        (progress) => runRestoreFromDiagnostic(diagnosticJson, progress)
      )
      setResult(runResult)
    } catch (err) {
      setResult({
        success: false,
        monthsUpdated: 0,
        transfersRestored: 0,
        adjustmentsRestored: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  return {
    status,
    result,
    isScanning,
    isRunning,
    scan,
    run,
  }
}

