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
import { queryClient, queryKeys, getFutureMonths, writeMonthData } from '../../../data'
// eslint-disable-next-line no-restricted-imports -- Recalculation needs direct Firestore access
import { readDocByPath, queryCollection } from '@firestore'
import { getMonthDocId, getPreviousMonth, getYearMonthOrdinal } from '@utils'
import type { CategoriesMap, AccountsMap, MonthDocument, FirestoreData, CategoryMonthBalance, AccountMonthBalance } from '@types'
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
    saveCategories,
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

      // Determine starting month: use viewing month, or current calendar month if not set
      const now = new Date()
      const startYear = currentYear || now.getFullYear()
      const startMonth = currentMonthNumber || (now.getMonth() + 1)

      // Get previous month info for starting balances
      const { year: prevYear, month: prevMonth } = getPreviousMonth(startYear, startMonth)
      const previousMonth = { year: prevYear, month: prevMonth }

      // Query future months (from startMonth onwards)
      const monthsToProcess = await getFutureMonths(
        selectedBudgetId,
        prevYear,
        prevMonth
      )

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

      // Read previous month data for starting balances
      let previousMonthData: FirestoreData | null = null
      const prevMonthDocId = getMonthDocId(selectedBudgetId, previousMonth.year, previousMonth.month)
      const { exists: prevExists, data: prevData } = await readDocByPath<FirestoreData>(
        'months',
        prevMonthDocId,
        `recalculate: reading previous month for starting balances`
      )
      if (prevExists && prevData) {
        previousMonthData = prevData
        if (prevData.category_balances) {
          for (const cb of prevData.category_balances) {
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
        const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
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
        const areAllocationsFinalized = fullMonthData.are_allocations_finalized || false

        const newTotalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0)
        const newTotalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0)

        totalIncomeRecalculated += newTotalIncome
        totalExpensesRecalculated += newTotalExpenses

        // Get existing allocations from category_balances (they're stored there now)
        const existingCategoryBalances: Record<string, { allocated: number }> = {}
        if (fullMonthData.category_balances) {
          for (const cb of fullMonthData.category_balances) {
            existingCategoryBalances[cb.category_id] = { allocated: cb.allocated ?? 0 }
          }
        }

        // Build category_balances using running balances for start
        const monthCategoryBalances: CategoryMonthBalance[] = categoryIds.map(catId => {
          const startBalance = runningCategoryBalances[catId] ?? 0

          // Use existing allocation if finalized
          let allocated = 0
          if (areAllocationsFinalized && existingCategoryBalances[catId]) {
            allocated = existingCategoryBalances[catId].allocated
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

        // Get previous month's income for this month's previous_month_income field
        const prevMonthForIncome = i === 0 ? previousMonthData : monthsToProcess[i - 1]
        const previousMonthIncome = prevMonthForIncome?.total_income ?? 0

        // Build account_balances (recalculate from income/expenses)
        const accountIds = Object.keys(accounts)
        const monthAccountBalances: AccountMonthBalance[] = accountIds.map(accountId => {
          // For start balance, we'd need to track running account balances
          // For now, just calculate income/expenses for this month
          const accountIncome = income
            .filter((inc: { account_id: string }) => inc.account_id === accountId)
            .reduce((sum: number, inc: { amount: number }) => sum + inc.amount, 0)

          const accountExpenses = expenses
            .filter((exp: { account_id: string }) => exp.account_id === accountId)
            .reduce((sum: number, exp: { amount: number }) => sum + exp.amount, 0)

          const netChange = accountIncome - accountExpenses

          // Get start balance from existing data or 0
          let startBalance = 0
          if (fullMonthData.account_balances) {
            const existing = fullMonthData.account_balances.find(
              (ab: { account_id: string }) => ab.account_id === accountId
            )
            if (existing) {
              startBalance = existing.start_balance ?? 0
            }
          }

          return {
            account_id: accountId,
            start_balance: startBalance,
            income: accountIncome,
            expenses: accountExpenses,
            net_change: netChange,
            end_balance: startBalance + netChange,
          }
        })

        // Save updated month document
        const updatedMonth: MonthDocument = {
          budget_id: selectedBudgetId,
          year_month_ordinal: getYearMonthOrdinal(monthData.year, monthData.month),
          year: monthData.year,
          month: monthData.month,
          income: income,
          total_income: newTotalIncome,
          previous_month_income: previousMonthIncome,
          expenses: expenses,
          total_expenses: newTotalExpenses,
          account_balances: monthAccountBalances,
          category_balances: monthCategoryBalances,
          are_allocations_finalized: areAllocationsFinalized,
          is_needs_recalculation: false,
          created_at: fullMonthData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        await writeMonthData({
          budgetId: selectedBudgetId,
          month: updatedMonth,
          description: 'recalculate all months',
        })

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

      // Query ALL months for this budget to calculate account balances
      const allMonthsResult = await queryCollection<{ year: number; month: number }>(
        'months',
        'recalculate: querying all months for account balances',
        [{ field: 'budget_id', op: '==', value: selectedBudgetId }]
      )

      // Sum up income and expenses from ALL months
      for (const monthDoc of allMonthsResult.docs) {
        const monthDocId = getMonthDocId(selectedBudgetId, monthDoc.data.year, monthDoc.data.month)
        const { exists, data: fullMonthData } = await readDocByPath<FirestoreData>(
          'months',
          monthDocId,
          `recalculate: reading month ${monthDoc.data.year}/${monthDoc.data.month} for account balances`
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

      // Update budget document with recalculated category balances
      await saveCategories(updatedCategories)

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
