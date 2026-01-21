/**
 * Repair Month Map Migration
 *
 * This maintenance migration updates the month_map for all budgets by:
 * 1. Reading all months from Firestore for each budget
 * 2. Adding any months that exist in Firestore but are missing from month_map
 * 3. Optionally removing orphaned entries (months in month_map that don't exist in Firestore)
 *
 * This repairs any gaps or inconsistencies in the month_map.
 */

import { useState } from 'react'
import type { MonthMap } from '@types'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, batchWriteBudgets, type BudgetUpdate } from './migrationDataHelpers'
import { getYearMonthOrdinal } from '@utils'

// ============================================================================
// TYPES
// ============================================================================

export interface RepairMonthMapMigrationStatus {
  totalBudgets: number
  totalMonths: number
  budgetsNeedingRepair: number
  totalMissingMonths: number
  totalOrphanedEntries: number
}

export interface RepairMonthMapMigrationResult {
  budgetsProcessed: number
  budgetsUpdated: number
  monthsAdded: number
  orphanedEntriesRemoved: number
  errors: string[]
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

/**
 * Scan all budgets to determine migration status.
 */
export async function scanRepairMonthMapStatus(): Promise<RepairMonthMapMigrationStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('repair-month-map-migration-scan')
  
  let budgetsNeedingRepair = 0
  let totalMissingMonths = 0
  let totalOrphanedEntries = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    const monthMapData = budget.data.month_map as MonthMap | undefined
    const existingMonthMap: MonthMap = monthMapData || {}
    
    // Build set of months that exist in Firestore
    const monthsInFirestore = new Set<string>()
    for (const month of months) {
      const ordinal = getYearMonthOrdinal(month.year, month.month)
      monthsInFirestore.add(ordinal)
    }
    
    // Find missing months (in Firestore but not in month_map)
    let missingCount = 0
    for (const ordinal of monthsInFirestore) {
      if (!(ordinal in existingMonthMap)) {
        missingCount++
      }
    }
    
    // Find orphaned entries (in month_map but not in Firestore)
    let orphanedCount = 0
    for (const ordinal of Object.keys(existingMonthMap)) {
      if (!monthsInFirestore.has(ordinal)) {
        orphanedCount++
      }
    }
    
    if (missingCount > 0 || orphanedCount > 0) {
      budgetsNeedingRepair++
      totalMissingMonths += missingCount
      totalOrphanedEntries += orphanedCount
    }
  }

  const totalMonths = monthsByBudget.size > 0 
    ? Array.from(monthsByBudget.values()).reduce((sum, months) => sum + months.length, 0)
    : 0

  return {
    totalBudgets: budgets.length,
    totalMonths,
    budgetsNeedingRepair,
    totalMissingMonths,
    totalOrphanedEntries,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

/**
 * Repair month_map for all budgets by adding missing months and removing orphaned entries.
 */
export async function runRepairMonthMapMigration(
  progress: ProgressReporter
): Promise<RepairMonthMapMigrationResult> {
  const result: RepairMonthMapMigrationResult = {
    budgetsProcessed: 0,
    budgetsUpdated: 0,
    monthsAdded: 0,
    orphanedEntriesRemoved: 0,
    errors: [],
  }

  progress.setStage('Reading all budgets and months...')
  progress.setProgress(null)
  
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('repair-month-map-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  const budgetUpdates: BudgetUpdate[] = []
  progress.setStage('Processing budgets...')

  let processedCount = 0

  for (const budget of budgets) {
    try {
      processedCount++
      const months = monthsByBudget.get(budget.id) || []
      const monthMapData = budget.data.month_map as MonthMap | undefined
      const existingMonthMap: MonthMap = monthMapData || {}
      
      progress.updateItemProgress(
        processedCount,
        budgets.length,
        `Budget ${budget.id}`
      )
      
      // Build set of months that exist in Firestore
      const monthsInFirestore = new Set<string>()
      for (const month of months) {
        const ordinal = getYearMonthOrdinal(month.year, month.month)
        monthsInFirestore.add(ordinal)
      }
      
      // Build updated month_map
      const updatedMonthMap: MonthMap = { ...existingMonthMap }
      let monthsAdded = 0
      let orphanedRemoved = 0
      
      // Add missing months (in Firestore but not in month_map)
      for (const ordinal of monthsInFirestore) {
        if (!(ordinal in updatedMonthMap)) {
          updatedMonthMap[ordinal] = {}
          monthsAdded++
        }
      }
      
      // Remove orphaned entries (in month_map but not in Firestore)
      for (const ordinal of Object.keys(updatedMonthMap)) {
        if (!monthsInFirestore.has(ordinal)) {
          delete updatedMonthMap[ordinal]
          orphanedRemoved++
        }
      }
      
      // Only update if there are changes
      if (monthsAdded > 0 || orphanedRemoved > 0) {
        budgetUpdates.push({
          budgetId: budget.id,
          data: {
            ...budget.data,
            month_map: updatedMonthMap,
            updated_at: new Date().toISOString(),
          },
        })
        
        result.monthsAdded += monthsAdded
        result.orphanedEntriesRemoved += orphanedRemoved
        result.budgetsUpdated++
      }
      
      result.budgetsProcessed++
    } catch (err) {
      result.errors.push(
        `Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Write all updates in batches
  if (budgetUpdates.length > 0) {
    progress.setStage(`Writing ${budgetUpdates.length} budget update(s)...`)
    progress.setProgress(null)
    progress.setCurrentItem(`${budgetUpdates.length} budget(s) to update`)
    
    await batchWriteBudgets(budgetUpdates, 'repair-month-map-migration')
  }

  progress.setStage('Migration complete')
  progress.setProgress(100)
  
  return result
}

// ============================================================================
// HOOK
// ============================================================================

interface UseRepairMonthMapMigrationOptions {
  currentUser: unknown
}

export function useRepairMonthMapMigration({ currentUser }: UseRepairMonthMapMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<RepairMonthMapMigrationStatus | null>(null)
  const [result, setResult] = useState<RepairMonthMapMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try {
      const scanResult = await scanRepairMonthMapStatus()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan repair month map status:', err)
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
        'Repair Month Map Migration',
        (progress) => runRepairMonthMapMigration(progress)
      )
      setResult(migrationResult)
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        budgetsUpdated: 0,
        monthsAdded: 0,
        orphanedEntriesRemoved: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  const needsMigration = status !== null && (status.totalMissingMonths > 0 || status.totalOrphanedEntries > 0)
  const totalItemsToFix = status ? status.totalMissingMonths + status.totalOrphanedEntries : 0

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
