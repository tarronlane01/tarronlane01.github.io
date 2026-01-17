/**
 * Upload Budget Hook
 *
 * Restores budget data from a zip file containing budget, months, and payees documents.
 */

import { useState } from 'react'
import JSZip from 'jszip'
// eslint-disable-next-line no-restricted-imports
import { batchWriteDocs, type BatchWriteDoc } from '@firestore'
import { writeMonthUpdatesAndRecalculate, batchWriteBudgets, type BudgetUpdate, type MonthUpdate } from './migrationDataHelpers'
import { clearAllCaches } from './migrationRunner'
import { scanZipFile as scanZipFileHelper, processBudgetFromZip, type UploadBudgetStatus } from './uploadBudgetHelpers'

export interface UploadBudgetProgress {
  phase: 'parsing' | 'validating' | 'uploading' | 'complete'
  current: number
  total: number
  percentComplete: number
}

export type { UploadBudgetStatus }

export interface UploadBudgetResult {
  success: boolean
  budgetsRestored: number
  monthsRestored: number
  payeesRestored: number
  errors: string[]
}

interface UseUploadBudgetOptions {
  currentUser: unknown
}

export function useUploadBudget({ currentUser }: UseUploadBudgetOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<UploadBudgetStatus | null>(null)
  const [progress, setProgress] = useState<UploadBudgetProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadBudgetResult | null>(null)

  async function scanZipFile(zipFile: File): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to upload budget')
      return
    }
    setIsScanning(true)
    setError(null)
    setStatus(null)
    setResult(null)

    try {
      const status = await scanZipFileHelper(zipFile)
      setStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse zip file')
    } finally {
      setIsScanning(false)
    }
  }

  async function uploadBudget(zipFile: File): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to upload budget')
      return
    }
    if (!status) {
      setError('Must scan file first')
      return
    }
    setIsUploading(true)
    setError(null)
    setProgress({ phase: 'parsing', current: 0, total: 1, percentComplete: 0 })

    const errors: string[] = []
    let budgetsRestored = 0
    let monthsRestored = 0
    let payeesRestored = 0

    try {
      // Step 1: Parse zip file
      setProgress({ phase: 'parsing', current: 0, total: 1, percentComplete: 10 })
      const zip = new JSZip()
      const zipData = await zip.loadAsync(zipFile)

      // Step 2: Validate structure
      setProgress({ phase: 'validating', current: 0, total: 1, percentComplete: 20 })

      // Step 3: Process budgets, months, and payees
      setProgress({ phase: 'uploading', current: 0, total: status.budgetsToRestore.length, percentComplete: 30 })

      const budgetUpdates: BudgetUpdate[] = []
      const monthUpdates: MonthUpdate[] = []
      const payeeWrites: BatchWriteDoc[] = []

      for (let i = 0; i < status.budgetsToRestore.length; i++) {
        const budgetId = status.budgetsToRestore[i]

        try {
          const { budgetUpdate, monthUpdates: budgetMonthUpdates, payeeWrite } = await processBudgetFromZip(zipData, budgetId)
          budgetUpdates.push(budgetUpdate)
          monthUpdates.push(...budgetMonthUpdates)
          if (payeeWrite) {
            payeeWrites.push(payeeWrite)
          }

          setProgress({
            phase: 'uploading',
            current: i + 1,
            total: status.budgetsToRestore.length,
            percentComplete: 30 + Math.round(((i + 1) / status.budgetsToRestore.length) * 50),
          })
        } catch (err) {
          errors.push(`Budget ${budgetId}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      // Step 4: Write all data
      setProgress({ phase: 'uploading', current: status.budgetsToRestore.length, total: status.budgetsToRestore.length, percentComplete: 80 })

      // Write budgets
      if (budgetUpdates.length > 0) {
        try {
          console.log(`[Upload] Writing ${budgetUpdates.length} budget(s)...`)
          await batchWriteBudgets(budgetUpdates, 'upload-budget')
          budgetsRestored = budgetUpdates.length
          console.log(`[Upload] Successfully wrote ${budgetsRestored} budget(s)`)
        } catch (err) {
          const errorMsg = `Failed to write budgets: ${err instanceof Error ? err.message : String(err)}`
          console.error(`[Upload] ${errorMsg}`, err)
          errors.push(errorMsg)
          throw err // Re-throw to be caught by outer catch
        }
      }

      // Write payees
      if (payeeWrites.length > 0) {
        try {
          console.log(`[Upload] Writing ${payeeWrites.length} payee doc(s)...`)
          await batchWriteDocs(payeeWrites, 'upload-budget: writing payees')
          payeesRestored = payeeWrites.length
          console.log(`[Upload] Successfully wrote ${payeesRestored} payee doc(s)`)
        } catch (err) {
          const errorMsg = `Failed to write payees: ${err instanceof Error ? err.message : String(err)}`
          console.error(`[Upload] ${errorMsg}`, err)
          errors.push(errorMsg)
          throw err // Re-throw to be caught by outer catch
        }
      }

      // Write months and recalculate
      if (monthUpdates.length > 0) {
        try {
          console.log(`[Upload] Writing ${monthUpdates.length} month(s) and recalculating...`)
          await writeMonthUpdatesAndRecalculate(monthUpdates, 'upload-budget')
          monthsRestored = monthUpdates.length
          console.log(`[Upload] Successfully wrote ${monthsRestored} month(s)`)
        } catch (err) {
          const errorMsg = `Failed to write months: ${err instanceof Error ? err.message : String(err)}`
          console.error(`[Upload] ${errorMsg}`, err)
          errors.push(errorMsg)
          throw err // Re-throw to be caught by outer catch
        }
      }

      setProgress({ phase: 'complete', current: 1, total: 1, percentComplete: 100 })
      setResult({
        success: errors.length === 0,
        budgetsRestored,
        monthsRestored,
        payeesRestored,
        errors,
      })

      // Clear all caches after successful upload (ensures fresh data is fetched)
      console.log('[Upload] Clearing all caches after upload...')
      clearAllCaches()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during upload'
      console.error('[Upload] Upload failed with error:', err)
      console.error('[Upload] Error details:', {
        errorMessage: errorMsg,
        budgetsRestored,
        monthsRestored,
        payeesRestored,
        errorsSoFar: errors,
      })
      setError(errorMsg)
      setResult({
        success: false,
        budgetsRestored,
        monthsRestored,
        payeesRestored,
        errors: [...errors, errorMsg],
      })

      // Clear caches even on failure - we might have partial writes
      console.log('[Upload] Clearing all caches after failed upload (partial writes possible)...')
      clearAllCaches()
    } finally {
      setIsUploading(false)
      setProgress(null)
    }
  }

  return {
    isScanning,
    isUploading,
    status,
    progress,
    error,
    result,
    scanZipFile,
    uploadBudget,
  }
}

