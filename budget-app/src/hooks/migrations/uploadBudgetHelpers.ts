/**
 * Upload Budget Helpers
 *
 * Utilities for parsing zip files and processing month data during upload.
 */

import JSZip from 'jszip'
// eslint-disable-next-line no-restricted-imports
import type { BatchWriteDoc } from '@firestore'
import type { FirestoreData, CategoryMonthBalance } from '@types'
import type { MonthDocument } from '@data/firestore/types/month/MonthDocument'
import type { PayeesDocument } from '@data/firestore/types/PayeesDocument'
import { cleanForFirestore, roundCurrency } from '@utils'
import { retotalMonth } from '@data/mutations/month/retotalMonth'
import type { BudgetUpdate, MonthUpdate } from './migrationBatchWrite'

export interface UploadBudgetStatus {
  budgetsFound: number
  monthsFound: number
  payeesFound: number
  budgetsToRestore: string[]
}

/**
 * Scan a zip file to determine what budgets and months it contains.
 */
export async function scanZipFile(zipFile: File): Promise<UploadBudgetStatus> {
  const zip = new JSZip()
  const zipData = await zip.loadAsync(zipFile)

  // Scan files to determine what's in the zip
  // New structure: budget_{budgetId}/budget.json, accounts.json, etc.
  const budgetFolders = new Set<string>()
  const monthFolders = new Set<string>()

  for (const [path] of Object.entries(zipData.files)) {
    // Look for budget folder structure: budget_{budgetId}/budget.json
    const budgetFolderMatch = path.match(/^budget_([^/]+)\//)
    if (budgetFolderMatch) {
      const budgetId = budgetFolderMatch[1]
      budgetFolders.add(budgetId)

      // Check if it's a month folder: budget_{budgetId}/months/month_YYYY_MM/
      const monthFolderMatch = path.match(/^budget_([^/]+)\/months\/month_\d{4}_\d{2}\//)
      if (monthFolderMatch) {
        monthFolders.add(path.split('/months/')[1].split('/')[0])
      }
    }
  }

  return {
    budgetsFound: budgetFolders.size,
    monthsFound: monthFolders.size,
    payeesFound: budgetFolders.size, // Assume one payees file per budget
    budgetsToRestore: Array.from(budgetFolders),
  }
}

/**
 * Process a single month folder from the zip file.
 * Reconstructs the month document from transaction files and metadata.
 */
export async function processMonthFromZip(
  zipData: JSZip,
  budgetFolder: string,
  monthFolder: string
): Promise<MonthUpdate | null> {
  const monthPrefix = `${budgetFolder}/months/`
  const monthFolderPath = `${monthPrefix}${monthFolder}/`

  // Read metadata
  const metadataPath = `${monthFolderPath}metadata.json`
  const metadataFile = zipData.files[metadataPath]
  if (!metadataFile) return null

  const metadataContent = await metadataFile.async('string')
  const metadataRaw = JSON.parse(metadataContent) as {
    budget_id: string
    year: number
    month: number
    year_month_ordinal: string
    are_allocations_finalized?: boolean
    created_at?: string
    allocations?: Record<string, number> // Preserved allocations if finalized
    downloaded_at?: string // Filter this out - it's only for download tracking
    [key: string]: unknown
  }

  // Extract metadata fields, excluding downloaded_at and calculated fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { downloaded_at, allocations, ...metadata } = metadataRaw

  // Read transaction files (these are the source of truth)
  const readMonthFile = async (filename: string): Promise<unknown[]> => {
    const filePath = `${monthFolderPath}${filename}`
    const file = zipData.files[filePath]
    if (file) {
      const content = await file.async('string')
      return JSON.parse(content) as unknown[]
    }
    return []
  }

  // IMPORTANT: This is a DESTRUCTIVE operation.
  // If a month is included in the upload, it COMPLETELY REPLACES all data for that month.
  // Any existing data for this month will be overwritten.
  //
  // We reconstruct the month document from scratch using ONLY the uploaded transaction files
  // (income.json, expenses.json, transfers.json, adjustments.json) and metadata.json.
  //
  // NOTE: The full_month_data.json file (if present) is IGNORED during upload.
  // All calculated fields (totals, balances) are ALWAYS recalculated from the transactions,
  // ensuring data integrity even if the downloaded totals were manually edited.
  const monthDataRaw: MonthDocument = {
    budget_id: metadata.budget_id,
    year: metadata.year,
    month: metadata.month,
    year_month_ordinal: metadata.year_month_ordinal as string,
    total_income: 0, // Will be recalculated from income array
    previous_month_income: 0, // Will be recalculated from previous month
    total_expenses: 0, // Will be recalculated from expenses array
    are_allocations_finalized: metadata.are_allocations_finalized ?? false,
    created_at: metadata.created_at as string || new Date().toISOString(),
    updated_at: new Date().toISOString(), // Always regenerate
    // Read transaction arrays from uploaded files (empty arrays if files are missing)
    income: (await readMonthFile('income.json')) as MonthDocument['income'],
    expenses: (await readMonthFile('expenses.json')) as MonthDocument['expenses'],
    transfers: (await readMonthFile('transfers.json')) as MonthDocument['transfers'],
    adjustments: (await readMonthFile('adjustments.json')) as MonthDocument['adjustments'],
    // Balance arrays start empty and will be recalculated from transactions
    account_balances: [], // Will be recalculated
    category_balances: [], // Will be recalculated (allocations preserved if finalized)
  }

  // Clean undefined values before writing
  const monthDataCleaned = cleanForFirestore(monthDataRaw) as MonthDocument

  // Recalculate totals from transactions (ensures totals match actual transactions)
  // This recalculates total_income, total_expenses, and account/category balances
  let monthData = retotalMonth(monthDataCleaned)

  // Restore preserved allocations if finalized
  // retotalMonth creates category balances with allocated: 0, so we need to restore
  // the user-entered allocations from the metadata
  // IMPORTANT: If allocations are finalized, we must restore them even if the allocations object is empty
  // (empty means all categories have 0 allocation, which is a valid finalized state)
  if (metadataRaw.are_allocations_finalized && allocations !== undefined) {
    // Build a map of existing category balances for quick lookup
    const balanceMap = new Map<string, CategoryMonthBalance>()
    for (const cb of monthData.category_balances) {
      balanceMap.set(cb.category_id, cb)
    }

    // Create updated category balances, ensuring ALL categories with allocations have entries
    const updatedBalances: CategoryMonthBalance[] = []
    const processedCategoryIds = new Set<string>()

    // First, update existing balances with preserved allocations
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

    // Then, create entries for categories with allocations but no transactions
    for (const [categoryId, allocatedAmount] of Object.entries(allocations)) {
      if (!processedCategoryIds.has(categoryId)) {
        const allocated = roundCurrency(allocatedAmount)
        updatedBalances.push({
          category_id: categoryId,
          start_balance: 0, // Will be recalculated during full recalculation
          allocated,
          spent: 0,
          transfers: 0,
          adjustments: 0,
          end_balance: allocated, // Will be recalculated during full recalculation
        })
      }
    }

    monthData = {
      ...monthData,
      category_balances: updatedBalances,
    }
  }

  return {
    budgetId: metadata.budget_id,
    year: metadata.year,
    month: metadata.month,
    data: monthData,
  }
}

/**
 * Process a single budget from the zip file.
 * Returns budget update, month updates, and payee write operations.
 */
export async function processBudgetFromZip(
  zipData: JSZip,
  budgetId: string
): Promise<{
  budgetUpdate: BudgetUpdate
  monthUpdates: MonthUpdate[]
  payeeWrite: BatchWriteDoc | null
}> {
  const budgetFolder = `budget_${budgetId}`
  const readFile = async (path: string): Promise<unknown> => {
    const file = zipData.files[path]
    if (file) {
      const content = await file.async('string')
      return JSON.parse(content)
    }
    return null
  }

  // Read budget files and reconstruct budget document
  const budgetMainPath = `${budgetFolder}/budget.json`
  const accountsPath = `${budgetFolder}/accounts.json`
  const accountGroupsPath = `${budgetFolder}/account_groups.json`
  const categoriesPath = `${budgetFolder}/categories.json`
  const categoryGroupsPath = `${budgetFolder}/category_groups.json`

  const mainBudgetData = await readFile(budgetMainPath)
  if (!mainBudgetData) {
    throw new Error(`Missing required file budget.json`)
  }

  const accounts = (await readFile(accountsPath)) || {}
  const accountGroups = (await readFile(accountGroupsPath)) || {}
  const categories = (await readFile(categoriesPath)) || {}
  const categoryGroups = (await readFile(categoryGroupsPath)) || []

  // Reconstruct full budget document
  const budgetData: FirestoreData = cleanForFirestore({
    ...(mainBudgetData as FirestoreData),
    accounts,
    account_groups: accountGroups,
    categories,
    category_groups: categoryGroups,
  })

  const budgetUpdate: BudgetUpdate = { budgetId, data: budgetData }

  // Read payees file
  const payeesPath = `${budgetFolder}/payees.json`
  const payeesData = await readFile(payeesPath)
  let payeeWrite: BatchWriteDoc | null = null
  if (payeesData) {
    // Ensure budget_id matches the document ID (required by Firestore rules)
    const payeesDoc: PayeesDocument = {
      ...(payeesData as PayeesDocument),
      budget_id: budgetId, // Always use the current budgetId
      updated_at: new Date().toISOString(), // Update timestamp
    }
    payeeWrite = {
      collectionPath: 'payees',
      docId: budgetId,
      data: cleanForFirestore(payeesDoc),
    }
  }

  // Read month files - each month is in its own folder
  const monthPrefix = `${budgetFolder}/months/`
  const monthFolders = new Set<string>()

  // Find all month folders
  for (const path of Object.keys(zipData.files)) {
    if (path.startsWith(monthPrefix) && path.includes('/metadata.json')) {
      const monthFolder = path.split('/months/')[1].split('/')[0]
      monthFolders.add(monthFolder)
    }
  }

  // Process each month folder
  const monthUpdates: MonthUpdate[] = []
  for (const monthFolder of monthFolders) {
    const monthUpdate = await processMonthFromZip(zipData, budgetFolder, monthFolder)
    if (monthUpdate) {
      monthUpdates.push(monthUpdate)
    }
  }

  return { budgetUpdate, monthUpdates, payeeWrite }
}

