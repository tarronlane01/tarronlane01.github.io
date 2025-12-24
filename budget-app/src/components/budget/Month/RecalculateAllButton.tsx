/**
 * RecalculateAllButton Component
 *
 * Button that triggers recalculation of budget data from the current month forward:
 * - Month totals (income, expenses) for current month and future
 * - Category balances (carry-forward across months)
 * - All account balances (sum of income - expenses per account)
 * - Budget document snapshots
 *
 * Past months are not modified. Use this when data seems out of sync
 * or after fixing bugs.
 */

import { useState } from 'react'
import { useBudget } from '../../../contexts/budget_context'
import { useBudgetData } from '../../../hooks'
import { queryClient, queryKeys } from '../../../data'
import { saveMonthToFirestore } from '../../../data/mutations/monthMutationHelpers'
// eslint-disable-next-line no-restricted-imports -- Recalculation needs to query all months
import { queryCollection, readDoc, getMonthDocId, type FirestoreData } from '../../../data/firestore/operations'
import type { CategoryMonthBalance, CategoriesMap, AccountsMap, MonthDocument } from '../../../types/budget'
import { MONTH_NAMES } from '../../../constants'
import { RecalculateModal, type RecalcResults } from './RecalculateModal'

interface RecalculateAllButtonProps {
  isDisabled?: boolean
}

export function RecalculateAllButton({ isDisabled }: RecalculateAllButtonProps) {
  const {
    selectedBudgetId,
    currentUserId,
    currentYear,
    currentMonthNumber,
  } = useBudget()

  const {
    categories,
    accounts,
    recalculateCategoryBalances,
    saveAccounts,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [isRecomputing, setIsRecomputing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [results, setResults] = useState<RecalcResults | null>(null)

  function handleOpenModal() {
    setShowModal(true)
    setResults({ status: 'confirming' })
  }

  async function handleProceed() {
    if (!selectedBudgetId) {
      return
    }

    setIsRecomputing(true)
    setResults({ status: 'pending' })

    try {
      // Step 1: Find all months for this budget
      setResults({ status: 'finding_months' })

      const monthsResult = await queryCollection<{
        budget_id: string
        year: number
        month: number
        income?: Array<{ id: string; amount: number; account_id: string; date: string; payee?: string; description?: string; created_at: string }>
        total_income?: number
        expenses?: Array<{ id: string; amount: number; category_id: string; account_id: string; date: string; payee?: string; description?: string; created_at: string }>
        total_expenses?: number
        allocations?: Array<{ category_id: string; amount: number }>
        allocations_finalized?: boolean
        category_balances?: CategoryMonthBalance[]
        previous_month_snapshot?: {
          total_income: number
          account_balances_end: Record<string, number>
          category_balances_end: Record<string, number>
          snapshot_taken_at: string
        }
        created_at?: string
        updated_at?: string
      }>(
        'months',
        'recalculate: finding all months for budget',
        [{ field: 'budget_id', op: '==', value: selectedBudgetId }]
      )

      // Sort months chronologically
      const allMonths = monthsResult.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data,
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

      // Determine starting month: use viewing month, or current calendar month if not set
      const now = new Date()
      const startYear = currentYear || now.getFullYear()
      const startMonth = currentMonthNumber || (now.getMonth() + 1)

      // Filter to only process starting month and future months
      const monthsToProcess = allMonths.filter(m => {
        if (m.year > startYear) return true
        if (m.year === startYear && m.month >= startMonth) return true
        return false
      })

      // Find the month immediately before the starting month (to get starting balances)
      const previousMonths = allMonths.filter(m => {
        if (m.year < startYear) return true
        if (m.year === startYear && m.month < startMonth) return true
        return false
      })
      const previousMonth = previousMonths.length > 0 ? previousMonths[previousMonths.length - 1] : null

      // Get category IDs from the budget
      const categoryIds = Object.keys(categories)

      setResults({
        status: 'finding_months',
        monthsFound: monthsToProcess.length,
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Step 2: Process each month in order
      // Track cumulative balances for carry-forward
      const runningCategoryBalances: Record<string, number> = {}

      // Initialize category balances from previous month's end balances (if exists)
      if (previousMonth) {
        const prevMonthDocId = getMonthDocId(selectedBudgetId, previousMonth.year, previousMonth.month)
        const { exists, data: prevMonthData } = await readDoc<FirestoreData>(
          'months',
          prevMonthDocId,
          `recalculate: reading previous month for starting balances`
        )
        if (exists && prevMonthData?.category_balances) {
          for (const cb of prevMonthData.category_balances) {
            runningCategoryBalances[cb.category_id] = cb.end_balance ?? 0
          }
        }
      }

      // Ensure all categories have a starting balance (default to 0 if not in previous month)
      categoryIds.forEach(catId => {
        if (runningCategoryBalances[catId] === undefined) {
          runningCategoryBalances[catId] = 0
        }
      })

      let totalIncomeRecalculated = 0
      let totalExpensesRecalculated = 0

      for (let i = 0; i < monthsToProcess.length; i++) {
        const monthData = monthsToProcess[i]
        const monthLabel = `${MONTH_NAMES[monthData.month - 1]} ${monthData.year}`

        setResults({
          status: 'processing_months',
          monthsFound: monthsToProcess.length,
          currentMonthIndex: i,
          currentMonthLabel: monthLabel,
        })

        // Fetch the full month document to ensure we have all data
        const monthDocId = getMonthDocId(selectedBudgetId, monthData.year, monthData.month)
        const { exists, data: fullMonthData } = await readDoc<FirestoreData>(
          'months',
          monthDocId,
          `recalculate: reading full month data for ${monthLabel}`
        )

        if (!exists || !fullMonthData) {
          console.warn(`Month ${monthLabel} not found, skipping`)
          continue
        }

        // Recalculate totals
        const income = fullMonthData.income || []
        const expenses = fullMonthData.expenses || []
        const allocations = fullMonthData.allocations || []
        const allocationsFinalized = fullMonthData.allocations_finalized || false

        const newTotalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0)
        const newTotalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0)

        totalIncomeRecalculated += newTotalIncome
        totalExpensesRecalculated += newTotalExpenses

        // Build category_balances using running balances for start
        const monthCategoryBalances: CategoryMonthBalance[] = categoryIds.map(catId => {
          const startBalance = runningCategoryBalances[catId] ?? 0

          let allocated = 0
          if (allocationsFinalized && allocations.length > 0) {
            const alloc = allocations.find((a: { category_id: string }) => a.category_id === catId)
            if (alloc) allocated = alloc.amount
          }

          let spent = 0
          if (expenses.length > 0) {
            spent = expenses
              .filter((e: { category_id: string }) => e.category_id === catId)
              .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
          }

          const endBalance = startBalance + allocated - spent

          return {
            category_id: catId,
            start_balance: startBalance,
            allocated,
            spent,
            end_balance: endBalance,
          }
        })

        // Update running balances for next month
        monthCategoryBalances.forEach(cb => {
          runningCategoryBalances[cb.category_id] = cb.end_balance
        })

        // Update the month's previous_month_snapshot to reflect any corrections
        let previousMonthSnapshot = fullMonthData.previous_month_snapshot

        // For the first month we're processing, use the actual previous month data
        // For subsequent months, use the previous processed month
        const prevMonthForSnapshot = i === 0 ? previousMonth : monthsToProcess[i - 1]

        if (prevMonthForSnapshot) {
          const prevEndBalances: Record<string, number> = {}

          // Use the start balances we calculated (which are the prev month's end balances)
          monthCategoryBalances.forEach(cb => {
            prevEndBalances[cb.category_id] = cb.start_balance
          })

          previousMonthSnapshot = {
            ...(previousMonthSnapshot || {}),
            total_income: prevMonthForSnapshot.total_income || 0,
            account_balances_end: previousMonthSnapshot?.account_balances_end || {},
            category_balances_end: prevEndBalances,
            snapshot_taken_at: new Date().toISOString(),
          }
        }

        // Save updated month document
        const updatedMonth: MonthDocument = {
          budget_id: selectedBudgetId,
          year: monthData.year,
          month: monthData.month,
          income: income,
          total_income: newTotalIncome,
          expenses: expenses,
          total_expenses: newTotalExpenses,
          allocations: allocations,
          allocations_finalized: allocationsFinalized,
          category_balances: monthCategoryBalances,
          category_balances_stale: false,
          previous_month_snapshot: previousMonthSnapshot,
          previous_month_snapshot_stale: false,
          account_balances_start: fullMonthData.account_balances_start,
          account_balances_end: fullMonthData.account_balances_end,
          created_at: fullMonthData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        await saveMonthToFirestore(selectedBudgetId, updatedMonth)

        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Step 3: Recalculate account balances from ALL months (not just processed ones)
      // Account balance = sum of all income to that account - sum of all expenses from that account
      const accountBalances: Record<string, number> = {}

      // Initialize all accounts to 0
      Object.keys(accounts).forEach(accId => {
        accountBalances[accId] = 0
      })

      // Sum up income and expenses from ALL months
      for (const monthData of allMonths) {
        const monthDocId = getMonthDocId(selectedBudgetId, monthData.year, monthData.month)
        const { exists, data: fullMonthData } = await readDoc<FirestoreData>(
          'months',
          monthDocId,
          `recalculate: reading month ${monthData.year}/${monthData.month} for account balances`
        )

        if (!exists || !fullMonthData) continue

        const income = fullMonthData.income || []
        const expenses = fullMonthData.expenses || []

        // Add income to account balances
        for (const inc of income) {
          if (inc.account_id && accountBalances[inc.account_id] !== undefined) {
            accountBalances[inc.account_id] += inc.amount
          }
        }

        // Subtract expenses from account balances
        for (const exp of expenses) {
          if (exp.account_id && accountBalances[exp.account_id] !== undefined) {
            accountBalances[exp.account_id] -= exp.amount
          }
        }
      }

      // Build updated accounts with recalculated balances
      const updatedAccounts: AccountsMap = {}
      Object.entries(accounts).forEach(([accId, acc]) => {
        updatedAccounts[accId] = {
          ...acc,
          balance: accountBalances[accId] ?? 0,
        }
      })

      // Save updated account balances
      await saveAccounts(updatedAccounts)

      // Step 4: Update budget with final category balances
      setResults({
        status: 'updating_budget',
        monthsFound: monthsToProcess.length,
        monthsProcessed: monthsToProcess.length,
        totalIncomeRecalculated,
        totalExpensesRecalculated,
      })

      // Calculate "current" balances (up to current month) and "total" balances (including all future)
      const currentMonthIdx = monthsToProcess.findIndex(m =>
        m.year === currentYear && m.month === currentMonthNumber
      )

      // Recalculate current balances by walking to current month
      const currentBalances: Record<string, number> = {}
      const tempRunning: Record<string, number> = {}

      // Initialize from previous month's end balances (same as we did for processing)
      if (previousMonth) {
        const prevMonthDocId = getMonthDocId(selectedBudgetId, previousMonth.year, previousMonth.month)
        const { exists, data: prevMonthData } = await readDoc<FirestoreData>(
          'months',
          prevMonthDocId,
          `recalculate: reading previous month for current balance calculation`
        )
        if (exists && prevMonthData?.category_balances) {
          for (const cb of prevMonthData.category_balances) {
            tempRunning[cb.category_id] = cb.end_balance ?? 0
          }
        }
      }

      // Ensure all categories have a value
      categoryIds.forEach(catId => {
        if (tempRunning[catId] === undefined) {
          tempRunning[catId] = 0
        }
      })

      // Walk through processed months to get current month's end balances
      for (let i = 0; i <= currentMonthIdx && i < monthsToProcess.length; i++) {
        const m = monthsToProcess[i]

        categoryIds.forEach(catId => {
          const start = tempRunning[catId] ?? 0
          let allocated = 0
          if (m.allocations_finalized && m.allocations) {
            const alloc = m.allocations.find((a: { category_id: string }) => a.category_id === catId)
            if (alloc) allocated = alloc.amount
          }
          let spent = 0
          if (m.expenses) {
            spent = m.expenses
              .filter((e: { category_id: string }) => e.category_id === catId)
              .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
          }
          tempRunning[catId] = start + allocated - spent
        })
      }

      categoryIds.forEach(catId => {
        currentBalances[catId] = tempRunning[catId] ?? 0
      })

      // Total balances = running balances after ALL months
      const totalBalances: Record<string, number> = { ...runningCategoryBalances }

      // Build updated categories for budget document
      const updatedCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        updatedCategories[catId] = {
          ...cat,
          balance: totalBalances[catId] ?? 0,
        }
      })

      // Build balances record for snapshot
      const balancesForSnapshot: Record<string, { current: number; total: number }> = {}
      categoryIds.forEach(catId => {
        balancesForSnapshot[catId] = {
          current: currentBalances[catId] ?? 0,
          total: totalBalances[catId] ?? 0,
        }
      })

      // Update budget document with recalculated category balances
      await recalculateCategoryBalances(
        updatedCategories,
        balancesForSnapshot,
        currentYear,
        currentMonthNumber
      )

      // Invalidate all month query caches to refresh UI
      for (const m of monthsToProcess) {
        queryClient.invalidateQueries({ queryKey: queryKeys.month(selectedBudgetId, m.year, m.month) })
      }

      // Done!
      setResults({
        status: 'done',
        monthsFound: monthsToProcess.length,
        monthsProcessed: monthsToProcess.length,
        totalIncomeRecalculated,
        totalExpensesRecalculated,
      })
    } catch (err) {
      console.error('Recalculate error:', err)
      setResults({
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to recalculate'
      })
    } finally {
      setIsRecomputing(false)
    }
  }

  function handleCloseModal() {
    setShowModal(false)
    setResults(null)
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

      <RecalculateModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onProceed={handleProceed}
        results={results}
      />
    </>
  )
}

