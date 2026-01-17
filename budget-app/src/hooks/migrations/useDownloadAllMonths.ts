/**
 * Download All Months Hook
 *
 * Downloads all months in a zip file format with one file per doc type per month.
 * This is a READ-ONLY operation - it does not modify any data.
 */

import { useState } from 'react'
import { readAllBudgetsAndMonths } from './migrationDataHelpers'
import type { MonthDocument } from '@data/firestore/types/month/MonthDocument'
import JSZip from 'jszip'

export interface DownloadAllMonthsProgress {
  phase: 'reading' | 'processing' | 'zipping' | 'complete'
  current: number
  total: number
  percentComplete: number
}

interface UseDownloadAllMonthsOptions {
  currentUser: unknown
}

export function useDownloadAllMonths({ currentUser }: UseDownloadAllMonthsOptions) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState<DownloadAllMonthsProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function downloadAllMonths(): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to download months')
      return
    }
    setIsDownloading(true)
    setError(null)
    setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 0 })

    try {
      // Step 1: Read all budgets and months
      setProgress({ phase: 'reading', current: 0, total: 1, percentComplete: 10 })
      const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('download-all-months')

      // Count total months for progress tracking
      let totalMonths = 0
      for (const months of monthsByBudget.values()) {
        totalMonths += months.length
      }

      // Step 2: Process each month and create files
      setProgress({ phase: 'processing', current: 0, total: totalMonths, percentComplete: 20 })
      const zip = new JSZip()
      const now = new Date()
      const datePrefix = now.toISOString().split('T')[0] // YYYY-MM-DD format

      let processedMonths = 0
      const budgetMap = new Map(budgets.map(b => [b.id, b.data]))

      for (const [budgetId, months] of monthsByBudget.entries()) {
        const budgetData = budgetMap.get(budgetId)
        const budgetName = (budgetData?.name as string) || 'Unknown Budget'

        for (const monthResult of months) {
          const monthData = monthResult.data as unknown as MonthDocument
          const monthPrefix = `${datePrefix}_month_${monthData.year}_${String(monthData.month).padStart(2, '0')}`

          // Create separate files for each transaction type
          const files: Array<{ name: string; data: unknown }> = [
            { name: `${monthPrefix}_income.json`, data: monthData.income || [] },
            { name: `${monthPrefix}_expenses.json`, data: monthData.expenses || [] },
            { name: `${monthPrefix}_transfers.json`, data: monthData.transfers || [] },
            { name: `${monthPrefix}_adjustments.json`, data: monthData.adjustments || [] },
            { name: `${monthPrefix}_account_balances.json`, data: monthData.account_balances || [] },
            { name: `${monthPrefix}_category_balances.json`, data: monthData.category_balances || [] },
          ]

          // Add metadata file
          const metadata = {
            budget_id: budgetId,
            budget_name: budgetName,
            year_month_ordinal: monthData.year_month_ordinal,
            year: monthData.year,
            month: monthData.month,
            total_income: monthData.total_income,
            previous_month_income: monthData.previous_month_income,
            total_expenses: monthData.total_expenses,
            are_allocations_finalized: monthData.are_allocations_finalized,
            created_at: monthData.created_at,
            updated_at: monthData.updated_at,
            downloaded_at: now.toISOString(),
          }
          files.push({ name: `${monthPrefix}_metadata.json`, data: metadata })

          // Add all files to zip
          for (const file of files) {
            zip.file(file.name, JSON.stringify(file.data, null, 2))
          }

          processedMonths++
          setProgress({
            phase: 'processing',
            current: processedMonths,
            total: totalMonths,
            percentComplete: 20 + Math.round((processedMonths / totalMonths) * 60),
          })
        }
      }

      // Step 3: Generate zip file
      setProgress({ phase: 'zipping', current: 0, total: 1, percentComplete: 80 })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      setProgress({ phase: 'complete', current: 1, total: 1, percentComplete: 100 })

      // Step 4: Download
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${datePrefix}_all_months.zip`
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

  return { isDownloading, progress, error, downloadAllMonths }
}

