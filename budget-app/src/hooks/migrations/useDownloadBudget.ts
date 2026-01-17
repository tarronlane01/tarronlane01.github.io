/**
 * Download Budget Hook
 *
 * Downloads budget-related documents (budget, months, payees) for a specific budget in a zip file format.
 * This is a READ-ONLY operation - it does not modify any data.
 */

import { useState } from 'react'
import { readAllMonthsForBudget } from './migrationDataHelpers'
import type { MonthDocument } from '@data/firestore/types/month/MonthDocument'
import type { PayeesDocument } from '@data/firestore/types/PayeesDocument'
import type { FirestoreData } from '@types'
// eslint-disable-next-line no-restricted-imports
import { readDocByPath } from '@firestore'
import JSZip from 'jszip'

export interface DownloadBudgetProgress {
  phase: 'reading' | 'processing' | 'zipping' | 'complete'
  current: number
  total: number
  percentComplete: number
}

interface UseDownloadBudgetOptions {
  currentUser: unknown
  budgetId: string | null
}

export function useDownloadBudget({ currentUser, budgetId }: UseDownloadBudgetOptions) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadBudgetProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function downloadBudget(): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to download budget')
      return
    }
    if (!budgetId) {
      setError('No budget selected')
      return
    }
    setIsDownloading(true)
    setError(null)
    setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 0 })

    try {
      // Step 1: Read budget, months, and payees
      setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 10 })

      // Read budget document
      const { exists: budgetExists, data: budgetData } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetId,
        `downloading budget ${budgetId}`
      )
      if (!budgetExists || !budgetData) {
        setError(`Budget ${budgetId} not found`)
        return
      }

      // Read months
      const months = await readAllMonthsForBudget(budgetId, 'download-budget')

      // Read payees (optional)
      let payeesData: PayeesDocument | null = null
      try {
        const { exists: payeesExists, data } = await readDocByPath<PayeesDocument>(
          'payees',
          budgetId,
          `downloading payees for budget ${budgetId}`
        )
        if (payeesExists && data) {
          payeesData = data
        }
      } catch (err) {
        // Payees might not exist, that's okay
        console.warn(`Could not read payees for budget ${budgetId}:`, err)
      }

      // Step 2: Process and organize files
      setProgress({ phase: 'processing', current: 0, total: months.length + 1, percentComplete: 20 })
      const zip = new JSZip()
      const now = new Date()
      const datePrefix = now.toISOString().split('T')[0] // YYYY-MM-DD format
      const budgetFolder = `budget_${budgetId}`

      // Extract budget data into separate files
      const { accounts, account_groups, categories, category_groups, ...mainBudgetData } = budgetData

      // Add main budget data (without accounts/categories)
      zip.file(`${budgetFolder}/budget.json`, JSON.stringify(mainBudgetData, null, 2))

      // Add accounts
      zip.file(`${budgetFolder}/accounts.json`, JSON.stringify(accounts || {}, null, 2))

      // Add account groups
      zip.file(`${budgetFolder}/account_groups.json`, JSON.stringify(account_groups || {}, null, 2))

      // Add categories
      zip.file(`${budgetFolder}/categories.json`, JSON.stringify(categories || {}, null, 2))

      // Add category groups
      zip.file(`${budgetFolder}/category_groups.json`, JSON.stringify(category_groups || [], null, 2))

      // Add payees if available
      if (payeesData) {
        zip.file(`${budgetFolder}/payees.json`, JSON.stringify(payeesData, null, 2))
      }

      // Process months - each month gets its own folder
      let processedMonths = 0
      for (const monthResult of months) {
        const monthData = monthResult.data as unknown as MonthDocument
        const monthFolder = `${budgetFolder}/months/month_${monthData.year}_${String(monthData.month).padStart(2, '0')}`

        // Extract allocated amounts from category_balances if allocations are finalized
        // (these need to be preserved as they're user input, not calculated)
        // IMPORTANT: Save ALL allocations when finalized, including zeros, because zero is a valid allocation value
        const allocations: Record<string, number> = {}
        if (monthData.are_allocations_finalized && monthData.category_balances) {
          for (const cb of monthData.category_balances) {
            // Save all allocations, including 0, when finalized
            // This ensures we can properly restore the finalized state on upload
            if (cb.allocated !== undefined) {
              allocations[cb.category_id] = cb.allocated
            }
          }
        }

        // Add month metadata (main document fields, matching Firebase structure)
        // Contains all scalar fields and totals, but arrays are in separate files below
        zip.file(`${monthFolder}/metadata.json`, JSON.stringify({
          budget_id: monthData.budget_id,
          year_month_ordinal: monthData.year_month_ordinal,
          year: monthData.year,
          month: monthData.month,
          total_income: monthData.total_income,
          previous_month_income: monthData.previous_month_income,
          total_expenses: monthData.total_expenses,
          are_allocations_finalized: monthData.are_allocations_finalized,
          created_at: monthData.created_at,
          updated_at: monthData.updated_at,
          // Always include allocations object if finalized (even if empty, to indicate finalized state)
          ...(monthData.are_allocations_finalized && { allocations }),
          downloaded_at: now.toISOString(),
        }, null, 2))

        // Add all array fields as separate files (matching Firebase document structure)
        // These are the large sub-arrays broken out for ease of use
        zip.file(`${monthFolder}/income.json`, JSON.stringify(monthData.income || [], null, 2))
        zip.file(`${monthFolder}/expenses.json`, JSON.stringify(monthData.expenses || [], null, 2))
        zip.file(`${monthFolder}/transfers.json`, JSON.stringify(monthData.transfers || [], null, 2))
        zip.file(`${monthFolder}/adjustments.json`, JSON.stringify(monthData.adjustments || [], null, 2))
        zip.file(`${monthFolder}/account_balances.json`, JSON.stringify(monthData.account_balances || [], null, 2))
        zip.file(`${monthFolder}/category_balances.json`, JSON.stringify(monthData.category_balances || [], null, 2))

        processedMonths++
        setProgress({
          phase: 'processing',
          current: processedMonths,
          total: months.length,
          percentComplete: 20 + Math.round((processedMonths / months.length) * 60),
        })
      }

      // Step 3: Generate zip file
      setProgress({ phase: 'zipping', current: 0, total: 1, percentComplete: 80 })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setProgress({ phase: 'complete', current: 1, total: 1, percentComplete: 100 })

      // Step 4: Download
      const budgetName = (budgetData.name as string) || 'budget'
      const safeBudgetName = budgetName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${datePrefix}_${safeBudgetName}_${budgetId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error during download')
    } finally {
      setIsDownloading(false)
      setProgress(null)
    }
  }

  return { isDownloading, progress, error, downloadBudget }
}

