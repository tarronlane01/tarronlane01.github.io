/**
 * Upload Sample Budget Hook
 *
 * Restores sample budget data from a zip file to the shared sample budget.
 * This overwrites all sample budget data and is only accessible to admins.
 */

import { useState } from 'react'
import JSZip from 'jszip'
// eslint-disable-next-line no-restricted-imports
import { batchWriteDocs, type BatchWriteDoc, writeDocByPath } from '@firestore'
import { writeMonthUpdatesAndRecalculate, type MonthUpdate } from './migrationDataHelpers'
import { clearAllCaches } from './migrationRunner'
import { cleanForFirestore } from '@utils'
import { SAMPLE_BUDGET_ID, SAMPLE_BUDGET_NAME } from '@data/constants'
import type { FirestoreData } from '@types'
import type { PayeesDocument } from '@data/firestore/types/PayeesDocument'
import { scanSampleBudgetZip, type UploadSampleBudgetStatus } from './uploadSampleBudgetScan'

export type { UploadSampleBudgetStatus } from './uploadSampleBudgetScan'

export interface UploadSampleBudgetProgress {
  phase: 'parsing' | 'validating' | 'uploading' | 'complete'
  current: number
  total: number
  percentComplete: number
}

export interface UploadSampleBudgetResult {
  success: boolean
  monthsRestored: number
  errors: string[]
}

interface UseUploadSampleBudgetOptions {
  currentUser: unknown
}

export function useUploadSampleBudget({ currentUser }: UseUploadSampleBudgetOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<UploadSampleBudgetStatus | null>(null)
  const [progress, setProgress] = useState<UploadSampleBudgetProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UploadSampleBudgetResult | null>(null)

  async function scanZipFile(zipFile: File): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to upload sample budget')
      return
    }
    setIsScanning(true)
    setError(null)
    setStatus(null)
    setResult(null)

    try {
      const scanResult = await scanSampleBudgetZip(zipFile)
      setStatus(scanResult)
      if (!scanResult.isValid) {
        setError(scanResult.validationErrors.join(', '))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse zip file')
    } finally {
      setIsScanning(false)
    }
  }

  async function uploadSampleBudget(zipFile: File): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to upload sample budget')
      return
    }
    if (!status || !status.isValid) {
      setError('Must scan a valid file first')
      return
    }

    setIsUploading(true)
    setError(null)
    setProgress({ phase: 'parsing', current: 0, total: 1, percentComplete: 0 })

    const errors: string[] = []
    let monthsRestored = 0

    try {
      // Step 1: Parse zip file
      setProgress({ phase: 'parsing', current: 0, total: 1, percentComplete: 10 })
      const zip = new JSZip()
      const zipData = await zip.loadAsync(zipFile)

      // Step 2: Validate structure
      setProgress({ phase: 'validating', current: 0, total: 1, percentComplete: 20 })

      // Helper to read a file from zip
      const readFile = async (path: string): Promise<unknown> => {
        const file = zipData.files[path]
        if (file) {
          const content = await file.async('string')
          return JSON.parse(content)
        }
        return null
      }

      // Step 3: Read and reconstruct budget data
      setProgress({ phase: 'uploading', current: 0, total: 4, percentComplete: 30 })

      const mainBudgetData = await readFile('budget.json') as FirestoreData | null
      if (!mainBudgetData) {
        throw new Error('Missing required file budget.json')
      }

      const accounts = (await readFile('accounts.json')) || {}
      const accountGroups = (await readFile('account_groups.json')) || {}
      const categories = (await readFile('categories.json')) || {}
      const categoryGroups = (await readFile('category_groups.json')) || []

      // Build the sample budget document
      // Override certain fields to ensure it's properly configured as the sample budget
      const budgetData: FirestoreData = cleanForFirestore({
        ...mainBudgetData,
        name: SAMPLE_BUDGET_NAME,
        accounts,
        account_groups: accountGroups,
        categories,
        category_groups: categoryGroups,
        // Mark this as a system budget with no owner (admins have access via rules)
        owner_id: '__SYSTEM__',
        owner_email: 'system@sample.budget',
        user_ids: [], // No individual users - admins access via isAdmin() rule
        accepted_user_ids: [],
        updated_at: new Date().toISOString(),
      })

      // Write budget document
      setProgress({ phase: 'uploading', current: 1, total: 4, percentComplete: 40 })
      console.log(`[UploadSampleBudget] Writing sample budget document...`)
      await writeDocByPath('budgets', SAMPLE_BUDGET_ID, budgetData, 'upload-sample-budget: writing budget')
      console.log(`[UploadSampleBudget] Successfully wrote sample budget document`)

      // Write payees document if it exists
      setProgress({ phase: 'uploading', current: 2, total: 4, percentComplete: 50 })
      const payeesData = await readFile('payees.json')
      if (payeesData) {
        const payeesDoc: PayeesDocument = {
          ...(payeesData as PayeesDocument),
          budget_id: SAMPLE_BUDGET_ID,
          updated_at: new Date().toISOString(),
        }
        const payeeWrite: BatchWriteDoc = {
          collectionPath: 'payees',
          docId: SAMPLE_BUDGET_ID,
          data: cleanForFirestore(payeesDoc),
        }
        console.log(`[UploadSampleBudget] Writing payees document...`)
        await batchWriteDocs([payeeWrite], 'upload-sample-budget: writing payees')
        console.log(`[UploadSampleBudget] Successfully wrote payees document`)
      }

      // Find and process month folders
      setProgress({ phase: 'uploading', current: 3, total: 4, percentComplete: 60 })
      const monthFolders = new Set<string>()
      for (const path of Object.keys(zipData.files)) {
        if (path.startsWith('months/') && path.includes('/metadata.json')) {
          const monthFolder = path.split('/')[1]
          monthFolders.add(monthFolder)
        }
      }

      // Process each month
      const monthUpdates: MonthUpdate[] = []
      const monthFolderArray = Array.from(monthFolders)

      for (let i = 0; i < monthFolderArray.length; i++) {
        const monthFolder = monthFolderArray[i]
        try {
          // Use a fake budget folder structure for processMonthFromZip
          // We need to adapt since our zip has flat structure, not budget_xxx/ prefix
          const monthUpdate = await processMonthFromZipFlat(zipData, monthFolder, SAMPLE_BUDGET_ID)
          if (monthUpdate) {
            monthUpdates.push(monthUpdate)
          }
        } catch (err) {
          errors.push(`Month ${monthFolder}: ${err instanceof Error ? err.message : String(err)}`)
        }

        setProgress({
          phase: 'uploading',
          current: 3,
          total: 4,
          percentComplete: 60 + Math.round((i / monthFolderArray.length) * 30),
        })
      }

      // Write months and recalculate
      if (monthUpdates.length > 0) {
        console.log(`[UploadSampleBudget] Writing ${monthUpdates.length} month(s) and recalculating...`)
        await writeMonthUpdatesAndRecalculate(monthUpdates, 'upload-sample-budget')
        monthsRestored = monthUpdates.length
        console.log(`[UploadSampleBudget] Successfully wrote ${monthsRestored} month(s)`)
      }

      setProgress({ phase: 'complete', current: 4, total: 4, percentComplete: 100 })
      setResult({
        success: errors.length === 0,
        monthsRestored,
        errors,
      })

      // Clear all caches after successful upload
      console.log('[UploadSampleBudget] Clearing all caches after upload...')
      clearAllCaches()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during upload'
      console.error('[UploadSampleBudget] Upload failed with error:', err)
      setError(errorMsg)
      setResult({
        success: false,
        monthsRestored,
        errors: [...errors, errorMsg],
      })

      // Clear caches even on failure
      console.log('[UploadSampleBudget] Clearing all caches after failed upload...')
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
    uploadSampleBudget,
  }
}

/**
 * Process a month from a flat zip structure (not nested under budget_xxx/).
 * Adapts the zip structure for sample budget uploads.
 */
async function processMonthFromZipFlat(
  zipData: JSZip,
  monthFolder: string,
  budgetId: string
): Promise<MonthUpdate | null> {
  const monthFolderPath = `months/${monthFolder}/`

  // Read metadata
  const metadataPath = `${monthFolderPath}metadata.json`
  const metadataFile = zipData.files[metadataPath]
  if (!metadataFile) return null

  const metadataContent = await metadataFile.async('string')
  const metadataRaw = JSON.parse(metadataContent) as {
    year: number
    month: number
    year_month_ordinal?: string
    are_allocations_finalized?: boolean
    created_at?: string
    allocations?: Record<string, number>
    [key: string]: unknown
  }

  // Read transaction files
  const readMonthFile = async (filename: string): Promise<unknown[]> => {
    const filePath = `${monthFolderPath}${filename}`
    const file = zipData.files[filePath]
    if (file) {
      const content = await file.async('string')
      return JSON.parse(content) as unknown[]
    }
    return []
  }

  // Build year_month_ordinal if not present
  const year = metadataRaw.year
  const month = metadataRaw.month
  const yearMonthOrdinal = metadataRaw.year_month_ordinal ||
    `${year}${month.toString().padStart(2, '0')}`

  // Import the retotalMonth and roundCurrency functions
  const { retotalMonth } = await import('@data/mutations/month/retotalMonth')
  const { roundCurrency } = await import('@utils')
  const { cleanForFirestore } = await import('@utils')

  // Build month document
  const monthDataRaw = {
    budget_id: budgetId, // Use sample budget ID
    year,
    month,
    year_month_ordinal: yearMonthOrdinal,
    total_income: 0,
    previous_month_income: 0,
    total_expenses: 0,
    are_allocations_finalized: metadataRaw.are_allocations_finalized ?? false,
    created_at: (metadataRaw.created_at as string) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    income: await readMonthFile('income.json'),
    expenses: await readMonthFile('expenses.json'),
    transfers: await readMonthFile('transfers.json'),
    adjustments: await readMonthFile('adjustments.json'),
    account_balances: await readMonthFile('account_balances.json'),
    category_balances: await readMonthFile('category_balances.json'),
  }

  // Clean undefined values
  const monthDataCleaned = cleanForFirestore(monthDataRaw)

  // Recalculate totals
  let monthData = retotalMonth(monthDataCleaned as Parameters<typeof retotalMonth>[0])

  // Restore allocations if finalized
  const allocations = metadataRaw.allocations
  if (metadataRaw.are_allocations_finalized && allocations !== undefined) {
    const updatedBalances = []
    const processedCategoryIds = new Set<string>()

    for (const cb of monthData.category_balances) {
      const preservedAllocated = allocations[cb.category_id]
      if (preservedAllocated !== undefined) {
        const allocated = roundCurrency(preservedAllocated)
        updatedBalances.push({
          ...cb,
          allocated,
          end_balance: roundCurrency(cb.start_balance + allocated + cb.spent + cb.transfers + cb.adjustments),
        })
      } else {
        updatedBalances.push(cb)
      }
      processedCategoryIds.add(cb.category_id)
    }

    for (const [categoryId, allocatedAmount] of Object.entries(allocations)) {
      if (!processedCategoryIds.has(categoryId)) {
        const allocated = roundCurrency(allocatedAmount)
        updatedBalances.push({
          category_id: categoryId,
          start_balance: 0,
          allocated,
          spent: 0,
          transfers: 0,
          adjustments: 0,
          end_balance: allocated,
        })
      }
    }

    monthData = {
      ...monthData,
      category_balances: updatedBalances,
    }
  }

  return {
    budgetId,
    year,
    month,
    data: monthData,
  }
}
