/**
 * RecalculateAllButton Component
 *
 * Button that triggers recalculation of budget data from the current month forward.
 */

import { useState } from 'react'
import { useBudget } from '@contexts'
import { useBudgetData } from '@hooks'
import { queryClient, queryKeys, getFutureMonths, writeMonthData } from '@data'
// eslint-disable-next-line no-restricted-imports -- Recalculation needs direct Firestore access
import { readDocByPath } from '@firestore'
import { getMonthDocId, getPreviousMonth, logUserAction } from '@utils'
import type { CategoriesMap, AccountsMap, FirestoreData } from '@types'
import { MONTH_NAMES } from '@constants'
import { RecalculateModal, type RecalcResults } from './RecalculateModal'
import { processMonth, calculateAccountBalancesFromAllMonths } from '@data/recalculation/recalculateAllHelpers'

interface RecalculateAllButtonProps {
  isDisabled?: boolean
  onCloseMenu?: () => void
}

export function RecalculateAllButton({ isDisabled, onCloseMenu }: RecalculateAllButtonProps) {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, accounts, saveCategories, saveAccounts } = useBudgetData(selectedBudgetId, currentUserId)

  const [isRecomputing, setIsRecomputing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [results, setResults] = useState<RecalcResults | null>(null)

  function handleOpenModal() {
    logUserAction('OPEN', 'Recalculate Modal')
    setShowModal(true)
    setResults({ status: 'confirming' })
  }

  async function handleProceed() {
    if (!selectedBudgetId) return

    logUserAction('CLICK', 'Proceed Recalculation')
    setIsRecomputing(true)
    setResults({ status: 'pending' })

    try {
      setResults({ status: 'finding_months' })

      const now = new Date()
      const startYear = currentYear || now.getFullYear()
      const startMonth = currentMonthNumber || (now.getMonth() + 1)
      const { year: prevYear, month: prevMonth } = getPreviousMonth(startYear, startMonth)

      const monthsToProcess = await getFutureMonths(selectedBudgetId, prevYear, prevMonth)
      const categoryIds = Object.keys(categories)

      setResults({ status: 'finding_months', monthsFound: monthsToProcess.length })
      await new Promise(resolve => setTimeout(resolve, 100))

      // Track cumulative balances for carry-forward
      const runningCategoryBalances: Record<string, number> = {}

      // Read previous month data for starting balances
      const prevMonthDocId = getMonthDocId(selectedBudgetId, prevYear, prevMonth)
      const { exists: prevExists, data: prevData } = await readDocByPath<FirestoreData>(
        'months', prevMonthDocId, `recalculate: reading previous month for starting balances`
      )
      if (prevExists && prevData?.category_balances) {
        for (const cb of prevData.category_balances) {
          runningCategoryBalances[cb.category_id] = cb.end_balance ?? 0
        }
      }

      categoryIds.forEach(catId => {
        if (runningCategoryBalances[catId] === undefined) runningCategoryBalances[catId] = 0
      })

      let totalIncomeRecalculated = 0
      let totalExpensesRecalculated = 0
      let previousMonthIncome = prevData?.total_income ?? 0

      for (let i = 0; i < monthsToProcess.length; i++) {
        const monthData = monthsToProcess[i]
        const monthLabel = `${MONTH_NAMES[monthData.month - 1]} ${monthData.year}`

        setResults({ status: 'processing_months', monthsFound: monthsToProcess.length, currentMonthIndex: i, currentMonthLabel: monthLabel })

        const result = await processMonth(
          selectedBudgetId, monthData, categoryIds, accounts, runningCategoryBalances,
          i === 0 ? (prevData?.total_income ?? 0) : previousMonthIncome
        )

        if (!result) continue

        totalIncomeRecalculated += result.totalIncome
        totalExpensesRecalculated += result.totalExpenses
        previousMonthIncome = result.totalIncome

        await writeMonthData({ budgetId: selectedBudgetId, month: result.updatedMonth, description: 'recalculate all months' })
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Calculate account balances from ALL months
      const accountBalances = await calculateAccountBalancesFromAllMonths(selectedBudgetId, accounts)

      const updatedAccounts: AccountsMap = {}
      Object.entries(accounts).forEach(([accId, acc]) => {
        updatedAccounts[accId] = { ...acc, balance: accountBalances[accId] ?? 0 }
      })
      await saveAccounts(updatedAccounts)

      // Update budget with final category balances
      setResults({ status: 'updating_budget', monthsFound: monthsToProcess.length, monthsProcessed: monthsToProcess.length, totalIncomeRecalculated, totalExpensesRecalculated })

      const updatedCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        updatedCategories[catId] = { ...cat, balance: runningCategoryBalances[catId] ?? 0 }
      })
      await saveCategories(updatedCategories)

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
          background: 'color-mix(in srgb, currentColor 10%, transparent)',
          border: 'none',
          borderRadius: '8px',
          padding: '0.5rem',
          cursor: isDisabled || isRecomputing ? 'not-allowed' : 'pointer',
          opacity: isDisabled || isRecomputing ? 0.5 : 1,
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Recalculate balances from this month forward"
      >
        {isRecomputing ? '⏳' : '🔄'} Recalculate
      </button>

      <RecalculateModal isOpen={showModal} onClose={handleCloseModal} onProceed={handleProceed} results={results} />
    </>
  )
}
