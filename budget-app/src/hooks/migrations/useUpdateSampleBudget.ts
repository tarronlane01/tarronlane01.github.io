/**
 * Update Sample Budget Hook
 * 
 * Programmatically generates and writes sample budget data with current dates.
 * No file upload required - just click a button to refresh the sample budget.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { batchWriteDocs, type BatchWriteDoc, writeDocByPath, queryCollection, deleteDocByPath } from '@firestore'
import { writeMonthUpdatesAndRecalculate, type MonthUpdate } from './migrationDataHelpers'
import { clearAllCaches } from './migrationRunner'
import { cleanForFirestore } from '@utils'
import { generateSampleBudget, SAMPLE_BUDGET_ID } from '@data/sampleBudget'
import type { FirestoreData } from '@types'
import { useBudget } from '@contexts'

export interface UpdateSampleBudgetProgress {
  phase: 'generating' | 'writing_budget' | 'writing_months' | 'recalculating' | 'complete'
  current: number
  total: number
  percentComplete: number
  message: string
}

export interface UpdateSampleBudgetResult {
  success: boolean
  monthsCreated: number
  dateRange: string
  errors: string[]
}

interface UseUpdateSampleBudgetOptions {
  currentUser: unknown
}

export function useUpdateSampleBudget({ currentUser }: UseUpdateSampleBudgetOptions) {
  const { resetInitialLoadState, selectedBudgetId, setCurrentYear, setCurrentMonthNumber } = useBudget()
  const [isUpdating, setIsUpdating] = useState(false)
  const [progress, setProgress] = useState<UpdateSampleBudgetProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UpdateSampleBudgetResult | null>(null)

  async function updateSampleBudget(): Promise<void> {
    if (!currentUser) {
      setError('Must be logged in to update sample budget')
      return
    }

    setIsUpdating(true)
    setError(null)
    setResult(null)
    const errors: string[] = []

    try {
      setProgress({
        phase: 'generating',
        current: 0,
        total: 5,
        percentComplete: 5,
        message: 'Generating sample budget data...',
      })

      // Use current date as reference - month offset 0 will be the current calendar month
      const generated = generateSampleBudget({ referenceDate: new Date() })
      console.log('[UpdateSampleBudget] Generated sample budget with', generated.months.length, 'months')

      setProgress({
        phase: 'writing_budget',
        current: 1,
        total: 4,
        percentComplete: 20,
        message: 'Writing budget document...',
      })

      // Delete existing months for sample budget first
      setProgress({
        phase: 'writing_budget',
        current: 1,
        total: 5,
        percentComplete: 15,
        message: 'Deleting old months...',
      })

      const existingMonthsResult = await queryCollection<FirestoreData>(
        'months',
        'update-sample-budget: querying existing months',
        [{ field: 'budget_id', op: '==', value: SAMPLE_BUDGET_ID }]
      )

      if (existingMonthsResult.docs.length > 0) {
        console.log(`[UpdateSampleBudget] Deleting ${existingMonthsResult.docs.length} existing months`)
        for (const doc of existingMonthsResult.docs) {
          await deleteDocByPath('months', doc.id, 'update-sample-budget: deleting old month')
        }
      }

      // [DEBUG] Log what we're about to write
      const catCount = Object.keys(generated.budgetDocument.categories || {}).length
      const sampleCatId = Object.keys(generated.budgetDocument.categories || {})[0]
      const sampleCat = generated.budgetDocument.categories?.[sampleCatId as keyof typeof generated.budgetDocument.categories]
      console.log(`[DEBUG] useUpdateSampleBudget: writing budget with ${catCount} categories, sampleCat=${sampleCatId?.slice(0, 15)} balance=${(sampleCat as { balance?: number } | undefined)?.balance}`)
      
      await writeDocByPath(
        'budgets',
        SAMPLE_BUDGET_ID,
        cleanForFirestore(generated.budgetDocument) as FirestoreData,
        'update-sample-budget: writing budget'
      )
      console.log('[UpdateSampleBudget] Wrote budget document')

      setProgress({
        phase: 'writing_budget',
        current: 2,
        total: 5,
        percentComplete: 35,
        message: 'Writing payees document...',
      })

      const payeeWrite: BatchWriteDoc = {
        collectionPath: 'payees',
        docId: SAMPLE_BUDGET_ID,
        data: cleanForFirestore(generated.payeesDocument) as FirestoreData,
      }
      await batchWriteDocs([payeeWrite], 'update-sample-budget: writing payees')
      console.log('[UpdateSampleBudget] Wrote payees document')

      setProgress({
        phase: 'writing_months',
        current: 3,
        total: 5,
        percentComplete: 50,
        message: `Writing ${generated.months.length} months...`,
      })

      const monthUpdates: MonthUpdate[] = generated.months.map((m) => ({
        budgetId: m.budgetId,
        year: m.year,
        month: m.month,
        data: cleanForFirestore(m.data) as MonthUpdate['data'],
      }))

      setProgress({
        phase: 'recalculating',
        current: 4,
        total: 5,
        percentComplete: 65,
        message: 'Writing months and recalculating balances...',
      })

      await writeMonthUpdatesAndRecalculate(monthUpdates, 'update-sample-budget')
      console.log('[UpdateSampleBudget] Wrote', monthUpdates.length, 'months')

      setProgress({
        phase: 'complete',
        current: 5,
        total: 5,
        percentComplete: 100,
        message: 'Sample budget updated successfully!',
      })

      const sortedMonths = [...generated.months].sort((a, b) => {
        const ordA = a.year * 100 + a.month
        const ordB = b.year * 100 + b.month
        return ordA - ordB
      })
      const firstMonth = sortedMonths[0]
      const lastMonth = sortedMonths[sortedMonths.length - 1]
      const dateRange = `${firstMonth.year}/${firstMonth.month} - ${lastMonth.year}/${lastMonth.month}`
      
      setResult({
        success: errors.length === 0,
        monthsCreated: generated.months.length,
        dateRange,
        errors,
      })

      console.log('[UpdateSampleBudget] Clearing all caches...')
      clearAllCaches()
      resetInitialLoadState()
      
      // Reset to current calendar month - the system will fallback to a valid month
      // if current calendar month doesn't exist in the budget
      if (selectedBudgetId === SAMPLE_BUDGET_ID) {
        const now = new Date()
        console.log(`[UpdateSampleBudget] Viewing sample budget - resetting to current calendar month ${now.getFullYear()}/${now.getMonth() + 1}`)
        setCurrentYear(now.getFullYear())
        setCurrentMonthNumber(now.getMonth() + 1)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during update'
      console.error('[UpdateSampleBudget] Update failed:', err)
      setError(errorMsg)
      setResult({
        success: false,
        monthsCreated: 0,
        dateRange: '',
        errors: [...errors, errorMsg],
      })

      console.log('[UpdateSampleBudget] Clearing caches after failure...')
      clearAllCaches()
      resetInitialLoadState()
      // On failure, don't change month context - let auto-detection handle it
    } finally {
      setIsUpdating(false)
    }
  }

  function reset(): void {
    setProgress(null)
    setError(null)
    setResult(null)
  }

  return {
    isUpdating,
    progress,
    error,
    result,
    updateSampleBudget,
    reset,
  }
}

export type UseUpdateSampleBudgetReturn = ReturnType<typeof useUpdateSampleBudget>
