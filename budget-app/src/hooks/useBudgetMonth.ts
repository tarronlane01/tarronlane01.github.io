/**
 * useBudgetMonth Hook
 *
 * Provides month-level data and mutations for income, expenses, allocations.
 * Components import this hook directly instead of going through context.
 *
 * Usage:
 *   const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
 *   const {
 *     month, income, expenses, isLoading,
 *     addIncome, deleteIncome, addExpense, ...
 *   } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
 */

import { useCallback, useMemo } from 'react'
import {
  useMonthQuery,
  useMonthMutations,
  usePayeesQuery,
  queryClient,
  queryKeys,
  type MonthQueryData,
} from '../data'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  CategoryAllocation,
  CategoryMonthBalance,
} from '../types/budget'

interface UseBudgetMonthReturn {
  // Query state
  isLoading: boolean
  isFetching: boolean
  error: Error | null

  // Month data
  month: MonthDocument | null
  income: IncomeTransaction[]
  expenses: ExpenseTransaction[]
  allocations: CategoryAllocation[]
  categoryBalances: CategoryMonthBalance[]
  totalIncome: number
  totalExpenses: number
  allocationsFinalized: boolean
  previousMonthIncome: number

  // Payees
  payees: string[]
  payeesLoading: boolean

  // Income mutations
  addIncome: (amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  updateIncome: (incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  deleteIncome: (incomeId: string) => Promise<void>

  // Expense mutations
  addExpense: (amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  updateExpense: (expenseId: string, amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  deleteExpense: (expenseId: string) => Promise<void>

  // Allocation mutations
  saveAllocations: (allocations: CategoryAllocation[]) => Promise<void>
  finalizeAllocations: () => Promise<void>
  unfinalizeAllocations: () => Promise<void>

  // Cache/refresh
  refreshMonth: () => Promise<void>
}

export function useBudgetMonth(
  budgetId: string | null,
  year: number,
  month: number
): UseBudgetMonthReturn {
  // Queries
  const monthQuery = useMonthQuery(budgetId, year, month, { enabled: !!budgetId })
  const payeesQuery = usePayeesQuery(budgetId, { enabled: !!budgetId })

  // Mutations
  const monthMutations = useMonthMutations()

  // Extract data
  const monthData = monthQuery.data?.month || null
  const income = monthData?.income || []
  const expenses = monthData?.expenses || []
  const allocations = monthData?.allocations || []
  const categoryBalances = monthData?.category_balances || []
  const totalIncome = monthData?.total_income || 0
  const totalExpenses = monthData?.total_expenses || 0
  const allocationsFinalized = monthData?.allocations_finalized || false

  // Previous month income from snapshot
  const previousMonthIncome = useMemo(() => {
    if (monthData?.previous_month_snapshot?.total_income !== undefined) {
      return monthData.previous_month_snapshot.total_income
    }

    // Fallback: try cache for backwards compatibility
    if (!budgetId) return 0
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth < 1) {
      prevMonth = 12
      prevYear -= 1
    }

    const cachedPrevMonth = queryClient.getQueryData<MonthQueryData>(
      queryKeys.month(budgetId, prevYear, prevMonth)
    )
    return cachedPrevMonth?.month?.total_income || 0
  }, [monthData, budgetId, year, month])

  // Payees
  const payees = payeesQuery.data || []

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

    await monthMutations.addIncome.mutateAsync({
      budgetId,
      year: incomeYear,
      month: incomeMonth,
      amount,
      accountId,
      date,
      payee,
      description,
    })
  }, [budgetId, monthMutations.addIncome])

  const updateIncome = useCallback(async (
    incomeId: string,
    amount: number,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    if (!budgetId || !monthData) throw new Error('No budget or month loaded')

    const oldIncome = monthData.income.find(i => i.id === incomeId)
    if (!oldIncome) throw new Error('Income not found')

    await monthMutations.updateIncome.mutateAsync({
      budgetId,
      year,
      month,
      incomeId,
      amount,
      accountId,
      date,
      payee,
      description,
      oldAmount: oldIncome.amount,
      oldAccountId: oldIncome.account_id,
    })
  }, [budgetId, monthData, year, month, monthMutations.updateIncome])

  const deleteIncome = useCallback(async (incomeId: string) => {
    if (!budgetId || !monthData) throw new Error('No budget or month loaded')

    const incomeItem = monthData.income.find(i => i.id === incomeId)
    if (!incomeItem) throw new Error('Income not found')

    await monthMutations.deleteIncome.mutateAsync({
      budgetId,
      year,
      month,
      incomeId,
      amount: incomeItem.amount,
      accountId: incomeItem.account_id,
    })
  }, [budgetId, monthData, year, month, monthMutations.deleteIncome])

  // ==========================================================================
  // EXPENSE MUTATIONS
  // ==========================================================================

  const addExpense = useCallback(async (
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    const [expenseYear, expenseMonth] = date.split('-').map(Number)

    await monthMutations.addExpense.mutateAsync({
      budgetId,
      year: expenseYear,
      month: expenseMonth,
      amount,
      categoryId,
      accountId,
      date,
      payee,
      description,
    })
  }, [budgetId, monthMutations.addExpense])

  const updateExpense = useCallback(async (
    expenseId: string,
    amount: number,
    categoryId: string,
    accountId: string,
    date: string,
    payee?: string,
    description?: string
  ) => {
    if (!budgetId || !monthData) throw new Error('No budget or month loaded')

    const oldExpense = monthData.expenses?.find(e => e.id === expenseId)
    if (!oldExpense) throw new Error('Expense not found')

    await monthMutations.updateExpense.mutateAsync({
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
      oldAmount: oldExpense.amount,
      oldAccountId: oldExpense.account_id,
    })
  }, [budgetId, monthData, year, month, monthMutations.updateExpense])

  const deleteExpense = useCallback(async (expenseId: string) => {
    if (!budgetId || !monthData) throw new Error('No budget or month loaded')

    const expense = monthData.expenses?.find(e => e.id === expenseId)
    if (!expense) throw new Error('Expense not found')

    await monthMutations.deleteExpense.mutateAsync({
      budgetId,
      year,
      month,
      expenseId,
      amount: expense.amount,
      accountId: expense.account_id,
    })
  }, [budgetId, monthData, year, month, monthMutations.deleteExpense])

  // ==========================================================================
  // ALLOCATION MUTATIONS
  // ==========================================================================

  const saveAllocations = useCallback(async (newAllocations: CategoryAllocation[]) => {
    if (!budgetId) throw new Error('No budget selected')

    await monthMutations.saveAllocations.mutateAsync({
      budgetId,
      year,
      month,
      allocations: newAllocations,
    })
  }, [budgetId, year, month, monthMutations.saveAllocations])

  const finalizeAllocations = useCallback(async () => {
    if (!budgetId || !monthData) throw new Error('No budget or month loaded')

    await monthMutations.finalizeAllocations.mutateAsync({
      budgetId,
      year,
      month,
      allocations: monthData.allocations || [],
    })
  }, [budgetId, monthData, year, month, monthMutations.finalizeAllocations])

  const unfinalizeAllocations = useCallback(async () => {
    if (!budgetId) throw new Error('No budget selected')

    await monthMutations.unfinalizeAllocations.mutateAsync({
      budgetId,
      year,
      month,
    })
  }, [budgetId, year, month, monthMutations.unfinalizeAllocations])

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
    allocations,
    categoryBalances,
    totalIncome,
    totalExpenses,
    allocationsFinalized,
    previousMonthIncome,

    // Payees
    payees,
    payeesLoading: payeesQuery.isLoading,

    // Mutations
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    saveAllocations,
    finalizeAllocations,
    unfinalizeAllocations,

    // Cache
    refreshMonth,
  }
}

