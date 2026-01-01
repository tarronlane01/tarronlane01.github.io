/**
 * useBudgetMonth Hook
 *
 * Provides month-level data and mutations for income and expenses.
 * Allocation mutations are handled directly in useAllocationsPage.
 *
 * Usage:
 *   const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
 *   const {
 *     month, income, expenses, isLoading,
 *     addIncome, deleteIncome, addExpense, ...
 *   } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
 */

import { useCallback, useEffect } from 'react'
import { useApp } from '../contexts/app_context'
import {
  useMonthQuery,
  queryClient,
  queryKeys,
} from '../data'
import {
  useAddIncome,
  useUpdateIncome,
  useDeleteIncome,
  useAddExpense,
  useUpdateExpense,
  useDeleteExpense,
} from '../data/mutations/month'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  CategoryMonthBalance,
} from '@types'

interface UseBudgetMonthReturn {
  // Query state
  isLoading: boolean
  isFetching: boolean
  error: Error | null

  // Month data
  month: MonthDocument | null
  income: IncomeTransaction[]
  expenses: ExpenseTransaction[]
  categoryBalances: CategoryMonthBalance[]
  totalIncome: number
  totalExpenses: number
  areAllocationsFinalized: boolean
  previousMonthIncome: number

  // Income mutations
  addIncome: (amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  updateIncome: (incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  deleteIncome: (incomeId: string) => Promise<void>

  // Expense mutations
  addExpense: (amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) => Promise<void>
  updateExpense: (expenseId: string, amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) => Promise<void>
  deleteExpense: (expenseId: string) => Promise<void>

  // Cache/refresh
  refreshMonth: () => Promise<void>
}

export function useBudgetMonth(
  budgetId: string | null,
  year: number,
  month: number
): UseBudgetMonthReturn {
  const { addLoadingHold, removeLoadingHold } = useApp()

  // Queries
  const monthQuery = useMonthQuery(budgetId, year, month, { enabled: !!budgetId })

  // Show loading overlay during month query loading
  useEffect(() => {
    if (monthQuery.isLoading) {
      addLoadingHold('month-query', 'Loading month data...')
    } else {
      removeLoadingHold('month-query')
    }
    return () => removeLoadingHold('month-query')
  }, [monthQuery.isLoading, addLoadingHold, removeLoadingHold])

  // Mutations
  const { addIncome: addIncomeOp } = useAddIncome()
  const { updateIncome: updateIncomeOp } = useUpdateIncome()
  const { deleteIncome: deleteIncomeOp } = useDeleteIncome()
  const { addExpense: addExpenseOp } = useAddExpense()
  const { updateExpense: updateExpenseOp } = useUpdateExpense()
  const { deleteExpense: deleteExpenseOp } = useDeleteExpense()

  // Extract data
  const monthData = monthQuery.data?.month || null
  const income = monthData?.income || []
  const expenses = monthData?.expenses || []
  const categoryBalances = monthData?.category_balances || []
  const totalIncome = monthData?.total_income || 0
  const totalExpenses = monthData?.total_expenses || 0
  const areAllocationsFinalized = monthData?.are_allocations_finalized || false

  // Previous month income is stored directly on the month document
  const previousMonthIncome = monthData?.previous_month_income ?? 0

  // ==========================================================================
  // INCOME MUTATIONS
  // ==========================================================================

  const addIncome = useCallback(async (
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    const [incomeYear, incomeMonth] = date.split('-').map(Number)

    await addIncomeOp(
      budgetId,
      incomeYear,
      incomeMonth,
      amount,
      accountId,
      date,
      payee,
      description
    )
  }, [budgetId, addIncomeOp])

  const updateIncome = useCallback(async (
    incomeId: string,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    await updateIncomeOp(
      budgetId,
      year,
      month,
      incomeId,
      amount,
      accountId,
      date,
      payee,
      description
    )
  }, [budgetId, year, month, updateIncomeOp])

  const deleteIncome = useCallback(async (incomeId: string) => {
    if (!budgetId) throw new Error('No budget selected')

    await deleteIncomeOp(budgetId, year, month, incomeId)
  }, [budgetId, year, month, deleteIncomeOp])

  // ==========================================================================
  // EXPENSE MUTATIONS
  // ==========================================================================

  const addExpense = useCallback(async (
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    const [expenseYear, expenseMonth] = date.split('-').map(Number)

    await addExpenseOp(
      budgetId,
      expenseYear,
      expenseMonth,
      amount,
      categoryId,
      accountId,
      date,
      payee,
      description,
      cleared
    )
  }, [budgetId, addExpenseOp])

  const updateExpense = useCallback(async (
    expenseId: string,
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    await updateExpenseOp(
      budgetId,
      year,
      month,
      expenseId,
      amount,
      categoryId,
      accountId,
      date,
      payee,
      description,
      cleared
    )
  }, [budgetId, year, month, updateExpenseOp])

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!budgetId) throw new Error('No budget selected')

    await deleteExpenseOp(budgetId, year, month, expenseId)
  }, [budgetId, year, month, deleteExpenseOp])

  // ==========================================================================
  // CACHE/REFRESH
  // ==========================================================================

  const refreshMonth = useCallback(async () => {
    if (!budgetId) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.month(budgetId, year, month) })
  }, [budgetId, year, month])

  return {
    // Query state
    isLoading: monthQuery.isLoading,
    isFetching: monthQuery.isFetching,
    error: monthQuery.error,

    // Data
    month: monthData,
    income,
    expenses,
    categoryBalances,
    totalIncome,
    totalExpenses,
    areAllocationsFinalized,
    previousMonthIncome,

    // Mutations
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,

    // Cache
    refreshMonth,
  }
}
