/**
 * RecalculateAllButton Component
 *
 * Button that triggers recalculation of all months in the budget.
 * Uses the same recalculateMonth function as the regular recalculation process,
 * starting from the earliest month's preserved start_balances, and saves
 * everything via batch write for optimal performance.
 */

import { useState } from 'react'
import { useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { queryClient, queryKeys } from '@data'
import type { BudgetData } from '@data/queries/budget'
// eslint-disable-next-line no-restricted-imports -- Recalculation needs direct Firestore access
import { queryCollection, batchWriteDocs, type BatchWriteDoc, readDocByPath } from '@firestore'
import { getMonthDocId, logUserAction, roundCurrency, cleanForFirestore } from '@utils'
import { isNoCategory, isNoAccount } from '@data/constants'
import { bannerQueue } from '@components/ui'
import type { MonthDocument, FirestoreData } from '@types'
import { MONTH_NAMES } from '@constants'
import { RecalculateModal, type RecalcResults, type RecalcMode } from './RecalculateModal'
import {
  recalculateMonth,
  extractSnapshotFromMonth,
  EMPTY_SNAPSHOT,
  type PreviousMonthSnapshot,
} from '@data/recalculation/recalculateMonth'
import { updateBudgetBalances } from '@data/recalculation/triggerRecalculationHelpers'
import { runRecalculationAssertions, logAssertionResults } from '@data/recalculation/assertions'
import { calculateTotalBalances } from '@data/cachedReads'
import type { MonthQueryData } from '@data/queries/month'
import type { BudgetDocument } from '@data/recalculation/triggerRecalculationTypes'

interface RecalculateAllButtonProps {
  isDisabled?: boolean
  onCloseMenu?: () => void
}

export function RecalculateAllButton({ isDisabled, onCloseMenu }: RecalculateAllButtonProps) {
  const { selectedBudgetId } = useBudget()
  const { categories } = useBudgetData()

  const [isRecomputing, setIsRecomputing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [results, setResults] = useState<RecalcResults | null>(null)

  function handleOpenModal() {
    logUserAction('OPEN', 'Recalculate Modal')
    setShowModal(true)
    setResults({ status: 'confirming' })
  }

  async function handleProceed(mode: RecalcMode) {
    if (!selectedBudgetId) return

    logUserAction('CLICK', `Proceed Recalculation (${mode})`)
    setIsRecomputing(true)
    setResults({ status: 'pending' })

    try {
      setResults({ status: 'finding_months' })

      // Query ALL months for this budget
      const allMonthsResult = await queryCollection<FirestoreData>(
        'months',
        'recalculate all: querying all months',
        [{ field: 'budget_id', op: '==', value: selectedBudgetId }]
      )

      // Parse and sort months chronologically
      const allMonths: MonthDocument[] = allMonthsResult.docs
        .map(doc => {
          const data = doc.data
          return {
            budget_id: selectedBudgetId,
            year_month_ordinal: data.year_month_ordinal ?? `${data.year}${String(data.month).padStart(2, '0')}`,
            year: data.year,
            month: data.month,
            income: data.income || [],
            total_income: data.total_income ?? 0,
            previous_month_income: data.previous_month_income ?? 0,
            expenses: data.expenses || [],
            total_expenses: data.total_expenses ?? 0,
            transfers: data.transfers || [],
            adjustments: data.adjustments || [],
            account_balances: data.account_balances || [],
            category_balances: data.category_balances || [],
            are_allocations_finalized: data.are_allocations_finalized ?? false,
            created_at: data.created_at,
            updated_at: data.updated_at,
          } as MonthDocument
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

      setResults({ status: 'finding_months', monthsFound: allMonths.length })

      if (allMonths.length === 0) {
        setResults({ status: 'done', monthsFound: 0, monthsProcessed: 0, totalIncomeRecalculated: 0, totalExpensesRecalculated: 0 })
        return
      }

      // For the earliest month, use its existing start_balances as the initial snapshot
      // This preserves the historical balances that summarize everything before the downloaded months
      const earliestMonth = allMonths[0]
      let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT

      if (earliestMonth) {
        // Extract start balances from the earliest month to preserve historical data
        const categoryStartBalances: Record<string, number> = {}
        const accountStartBalances: Record<string, number> = {}

        // Use existing start_balances from the earliest month (these represent pre-download history)
        for (const cb of earliestMonth.category_balances || []) {
          if (!isNoCategory(cb.category_id)) {
            categoryStartBalances[cb.category_id] = roundCurrency(cb.start_balance ?? 0)
          }
        }

        for (const ab of earliestMonth.account_balances || []) {
          if (!isNoAccount(ab.account_id)) {
            accountStartBalances[ab.account_id] = roundCurrency(ab.start_balance ?? 0)
          }
        }

        prevSnapshot = {
          categoryEndBalances: categoryStartBalances,
          accountEndBalances: accountStartBalances,
          totalIncome: roundCurrency(earliestMonth.previous_month_income ?? 0),
        }
      }

      // Recalculate all months using the same recalculateMonth function used during normal app usage
      setResults({ status: 'processing_months', monthsFound: allMonths.length, currentMonthIndex: 0 })
      const recalculatedMonths: MonthDocument[] = []
      let totalIncomeRecalculated = 0
      let totalExpensesRecalculated = 0

      for (let i = 0; i < allMonths.length; i++) {
        const month = allMonths[i]
        const monthLabel = `${MONTH_NAMES[month.month - 1]} ${month.year}`

        setResults({
          status: 'processing_months',
          monthsFound: allMonths.length,
          currentMonthIndex: i,
          currentMonthLabel: monthLabel,
        })

        // Use the same recalculateMonth function used during normal app usage
        const recalculated = recalculateMonth(month, prevSnapshot)
        recalculatedMonths.push(recalculated)

        totalIncomeRecalculated += recalculated.total_income
        totalExpensesRecalculated += recalculated.total_expenses

        // Extract snapshot for next month
        prevSnapshot = extractSnapshotFromMonth(recalculated)
      }

      // Batch write all recalculated months in a single operation
      setResults({ status: 'updating_budget', monthsFound: allMonths.length, monthsProcessed: allMonths.length })
      
      if (recalculatedMonths.length > 0) {
        const batchDocs: BatchWriteDoc[] = recalculatedMonths.map(month => ({
          collectionPath: 'months',
          docId: getMonthDocId(selectedBudgetId, month.year, month.month),
          data: cleanForFirestore({
            ...month,
            updated_at: new Date().toISOString(),
          }) as FirestoreData,
        }))

        await batchWriteDocs(batchDocs, 'recalculate all: batch write months')

        // Update all month caches
        for (const month of recalculatedMonths) {
          queryClient.setQueryData<MonthQueryData>(
            queryKeys.month(selectedBudgetId, month.year, month.month),
            { month }
          )
        }
      }

      // Update budget with final balances using the same helper as regular recalculation
      setResults({ status: 'updating_budget', monthsFound: allMonths.length, monthsProcessed: allMonths.length, totalIncomeRecalculated, totalExpensesRecalculated })

      // Get final balances from last month's snapshot
      const finalAccountBalances = prevSnapshot.accountEndBalances
      const currentCategoryBalances = prevSnapshot.categoryEndBalances

      // Calculate total category balances (including future allocations) to match what's stored in budget document
      // The budget document stores total balances (all-time including future), not just current month's end_balance
      const lastMonth = recalculatedMonths[recalculatedMonths.length - 1]
      const categoryIds = Object.keys(categories)
      const finalCategoryBalances = await calculateTotalBalances(
        selectedBudgetId,
        categoryIds,
        currentCategoryBalances,
        lastMonth.year,
        lastMonth.month
      )

      // Read budget to get month_map for updateBudgetBalances
      const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(selectedBudgetId))
      const monthMap = budgetData?.budget?.month_map || {}

      await updateBudgetBalances(
        selectedBudgetId,
        finalAccountBalances,
        finalCategoryBalances,
        monthMap
      )

      // Run assertions to validate the recalculation
      const { data: updatedBudgetData } = await readDocByPath<BudgetDocument>(
        'budgets',
        selectedBudgetId,
        '[recalculate all] reading budget for assertions'
      )

      if (updatedBudgetData && recalculatedMonths.length > 0) {
        const lastMonth = recalculatedMonths[recalculatedMonths.length - 1]
        const assertionResults = await runRecalculationAssertions({
          budgetId: selectedBudgetId,
          categories: updatedBudgetData.categories || {},
          totalAvailable: updatedBudgetData.total_available ?? 0,
          currentYear: lastMonth.year,
          currentMonth: lastMonth.month,
        })

        // Log results and show banners for failures
        const banners = logAssertionResults(assertionResults, '[Recalculate All]')
        banners.forEach(banner => bannerQueue.add(banner))
      }

      setResults({
        status: 'done',
        monthsFound: allMonths.length,
        monthsProcessed: allMonths.length,
        totalIncomeRecalculated,
        totalExpensesRecalculated,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to recalculate'
      console.error('[RecalculateAllButton] Recalculate error:', err)
      setResults({ status: 'error', error: errorMessage })
      // Show error in banner system
      bannerQueue.add({
        type: 'error',
        message: `Recalculation failed: ${errorMessage}`,
        autoDismissMs: 10000,
      })
    } finally {
      setIsRecomputing(false)
    }
  }

  function handleCloseModal() {
    logUserAction('CLOSE', 'Recalculate Modal')
    setShowModal(false)
    setResults(null)
    onCloseMenu?.()
  }

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isDisabled || isRecomputing}
        style={{
          background: 'color-mix(in srgb, currentColor 15%, transparent)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          padding: '0.4rem 0.75rem', // Reduced vertical padding to make button less tall
          cursor: isDisabled || isRecomputing ? 'not-allowed' : 'pointer',
          opacity: isDisabled || isRecomputing ? 0.5 : 1,
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !isRecomputing) {
            e.currentTarget.style.background = 'color-mix(in srgb, currentColor 20%, transparent)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !isRecomputing) {
            e.currentTarget.style.background = 'color-mix(in srgb, currentColor 15%, transparent)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
          }
        }}
        title="Recalculate all months from the beginning"
      >
        {isRecomputing ? '⏳' : '🔄'} Recalculate
      </button>

      <RecalculateModal isOpen={showModal} onClose={handleCloseModal} onProceed={handleProceed} results={results} />
    </>
  )
}
