/**
 * RecalculateAllButton Component
 *
 * Button that triggers recalculation of budget data from the current month forward.
 */

import { useState } from 'react'
import { useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { useUpdateAccounts, useUpdateCategories } from '@data/mutations/budget'
import { queryClient, queryKeys, getFutureMonths, writeMonthData } from '@data'
// eslint-disable-next-line no-restricted-imports -- Recalculation needs direct Firestore access
import { readDocByPath, queryCollection } from '@firestore'
import { getMonthDocId, getPreviousMonth, logUserAction } from '@utils'
import type { CategoriesMap, AccountsMap, FirestoreData } from '@types'
import { MONTH_NAMES } from '@constants'
import { RecalculateModal, type RecalcResults, type RecalcMode } from './RecalculateModal'
import { processMonth } from '@data/recalculation/recalculateAllHelpers'

interface RecalculateAllButtonProps {
  isDisabled?: boolean
  onCloseMenu?: () => void
}

export function RecalculateAllButton({ isDisabled, onCloseMenu }: RecalculateAllButtonProps) {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { categories, accounts } = useBudgetData()

  // Mutations - imported directly
  const { updateAccounts } = useUpdateAccounts()
  const { updateCategories } = useUpdateCategories()

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

      let monthsToProcess: Array<{ year: number; month: number }>

      if (mode === 'all_months') {
        // Get ALL months for this budget, sorted chronologically
        const allMonthsResult = await queryCollection<{ year: number; month: number }>(
          'months',
          'recalculate: querying all months for full recalculation',
          [{ field: 'budget_id', op: '==', value: selectedBudgetId }]
        )
        monthsToProcess = allMonthsResult.docs
          .map(doc => ({ year: doc.data.year, month: doc.data.month }))
          .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year
            return a.month - b.month
          })
      } else {
        // Get months from current month forward (original behavior)
        const now = new Date()
        const startYear = currentYear || now.getFullYear()
        const startMonth = currentMonthNumber || (now.getMonth() + 1)
        const { year: prevYear, month: prevMonth } = getPreviousMonth(startYear, startMonth)
        monthsToProcess = await getFutureMonths(selectedBudgetId, prevYear, prevMonth)
      }

      const categoryIds = Object.keys(categories)

      setResults({ status: 'finding_months', monthsFound: monthsToProcess.length })
      await new Promise(resolve => setTimeout(resolve, 100))

      // Track cumulative balances for carry-forward
      const runningCategoryBalances: Record<string, number> = {}
      const runningAccountBalances: Record<string, number> = {}

      // For 'all_months' mode, start with zero balances
      // For 'from_current' mode, read previous month data for starting balances
      if (mode === 'from_current') {
        const now = new Date()
        const startYear = currentYear || now.getFullYear()
        const startMonth = currentMonthNumber || (now.getMonth() + 1)
        const { year: prevYear, month: prevMonth } = getPreviousMonth(startYear, startMonth)
        const prevMonthDocId = getMonthDocId(selectedBudgetId, prevYear, prevMonth)
        const { exists: prevExists, data: prevData } = await readDocByPath<FirestoreData>(
          'months', prevMonthDocId, `recalculate: reading previous month for starting balances`
        )
        if (prevExists && prevData?.category_balances) {
          for (const cb of prevData.category_balances) {
            runningCategoryBalances[cb.category_id] = cb.end_balance ?? 0
          }
        }
        if (prevExists && prevData?.account_balances) {
          for (const ab of prevData.account_balances) {
            runningAccountBalances[ab.account_id] = ab.end_balance ?? 0
          }
        }
      }

      // Initialize any missing categories/accounts to 0
      categoryIds.forEach(catId => {
        if (runningCategoryBalances[catId] === undefined) runningCategoryBalances[catId] = 0
      })
      Object.keys(accounts).forEach(accId => {
        if (runningAccountBalances[accId] === undefined) runningAccountBalances[accId] = 0
      })

      let totalIncomeRecalculated = 0
      let totalExpensesRecalculated = 0
      let previousMonthIncome = 0

      for (let i = 0; i < monthsToProcess.length; i++) {
        const monthData = monthsToProcess[i]
        const monthLabel = `${MONTH_NAMES[monthData.month - 1]} ${monthData.year}`

        setResults({ status: 'processing_months', monthsFound: monthsToProcess.length, currentMonthIndex: i, currentMonthLabel: monthLabel })

        const result = await processMonth(
          selectedBudgetId, monthData, categoryIds, accounts, runningCategoryBalances, runningAccountBalances,
          previousMonthIncome
        )

        if (!result) continue

        totalIncomeRecalculated += result.totalIncome
        totalExpensesRecalculated += result.totalExpenses
        previousMonthIncome = result.totalIncome

        await writeMonthData({ budgetId: selectedBudgetId, month: result.updatedMonth, description: 'recalculate all months' })
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Use the running account balances we tracked during processing
      // No need to re-read all months!
      const updatedAccounts: AccountsMap = {}
      Object.entries(accounts).forEach(([accId, acc]) => {
        updatedAccounts[accId] = { ...acc, balance: runningAccountBalances[accId] ?? 0 }
      })
      await updateAccounts.mutateAsync({ budgetId: selectedBudgetId, accounts: updatedAccounts })

      // Update budget with final category balances
      setResults({ status: 'updating_budget', monthsFound: monthsToProcess.length, monthsProcessed: monthsToProcess.length, totalIncomeRecalculated, totalExpensesRecalculated })

      const updatedCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        updatedCategories[catId] = { ...cat, balance: runningCategoryBalances[catId] ?? 0 }
      })
      await updateCategories.mutateAsync({ budgetId: selectedBudgetId, categories: updatedCategories })

      for (const m of monthsToProcess) {
        queryClient.invalidateQueries({ queryKey: queryKeys.month(selectedBudgetId, m.year, m.month) })
      }

      setResults({ status: 'done', monthsFound: monthsToProcess.length, monthsProcessed: monthsToProcess.length, totalIncomeRecalculated, totalExpensesRecalculated })
    } catch (err) {
      console.error('Recalculate error:', err)
      setResults({ status: 'error', error: err instanceof Error ? err.message : 'Failed to recalculate' })
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
        title="Recalculate balances from this month forward"
      >
        {isRecomputing ? '⏳' : '🔄'} Recalculate
      </button>

      <RecalculateModal isOpen={showModal} onClose={handleCloseModal} onProceed={handleProceed} results={results} />
    </>
  )
}
