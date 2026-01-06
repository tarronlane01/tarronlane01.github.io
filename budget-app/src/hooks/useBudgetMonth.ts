/**
 * useBudgetMonth Hook
 *
 * Provides month-level data and mutations for income, expenses, transfers, and adjustments.
 * Allocation mutations are handled directly in useAllocationsPage.
 *
 * Usage:
 *   const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
 *   const {
 *     month, income, expenses, transfers, adjustments, isLoading,
 *     addIncome, deleteIncome, addExpense, addTransfer, addAdjustment, ...
 *   } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
 */

import { useCallback, useEffect } from 'react'
import { useApp } from '@contexts'
import {
  useMonthQuery,
  queryClient,
  queryKeys,
} from '@data'
import {
  useAddIncome,
  useUpdateIncome,
  useDeleteIncome,
  useAddExpense,
  useUpdateExpense,
  useDeleteExpense,
  useAddTransfer,
  useUpdateTransfer,
  useDeleteTransfer,
  useAddAdjustment,
  useUpdateAdjustment,
  useDeleteAdjustment,
} from '../data/mutations/month'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  TransferTransaction,
  AdjustmentTransaction,
  CategoryMonthBalance,
} from '@types'

interface UseBudgetMonthReturn {
  isLoading: boolean; isFetching: boolean; error: Error | null
  month: MonthDocument | null; income: IncomeTransaction[]; expenses: ExpenseTransaction[]
  transfers: TransferTransaction[]; adjustments: AdjustmentTransaction[]; categoryBalances: CategoryMonthBalance[]
  totalIncome: number; totalExpenses: number; areAllocationsFinalized: boolean; previousMonthIncome: number
  addIncome: (amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  updateIncome: (incomeId: string, amount: number, accountId: string, date: string, payee?: string, description?: string) => Promise<void>
  deleteIncome: (incomeId: string) => Promise<void>
  addExpense: (amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) => Promise<void>
  updateExpense: (expenseId: string, amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string, cleared?: boolean) => Promise<void>
  deleteExpense: (expenseId: string) => Promise<void>
  addTransfer: (amount: number, fromAccountId: string, toAccountId: string, fromCategoryId: string, toCategoryId: string, date: string, description?: string, cleared?: boolean) => Promise<void>
  updateTransfer: (transferId: string, amount: number, fromAccountId: string, toAccountId: string, fromCategoryId: string, toCategoryId: string, date: string, description?: string, cleared?: boolean) => Promise<void>
  deleteTransfer: (transferId: string) => Promise<void>
  addAdjustment: (amount: number, accountId: string, categoryId: string, date: string, description?: string, cleared?: boolean) => Promise<void>
  updateAdjustment: (adjustmentId: string, amount: number, accountId: string, categoryId: string, date: string, description?: string, cleared?: boolean) => Promise<void>
  deleteAdjustment: (adjustmentId: string) => Promise<void>
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
  const { addTransfer: addTransferOp } = useAddTransfer()
  const { updateTransfer: updateTransferOp } = useUpdateTransfer()
  const { deleteTransfer: deleteTransferOp } = useDeleteTransfer()
  const { addAdjustment: addAdjustmentOp } = useAddAdjustment()
  const { updateAdjustment: updateAdjustmentOp } = useUpdateAdjustment()
  const { deleteAdjustment: deleteAdjustmentOp } = useDeleteAdjustment()

  // Extract data
  const monthData = monthQuery.data?.month || null
  const income = monthData?.income || []
  const expenses = monthData?.expenses || []
  const transfers = monthData?.transfers || []
  const adjustments = monthData?.adjustments || []
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
  // TRANSFER MUTATIONS
  // ==========================================================================

  const addTransfer = useCallback(async (
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    const [transferYear, transferMonth] = date.split('-').map(Number)

    await addTransferOp(
      budgetId,
      transferYear,
      transferMonth,
      amount,
      fromAccountId,
      toAccountId,
      fromCategoryId,
      toCategoryId,
      date,
      description,
      cleared
    )
  }, [budgetId, addTransferOp])

  const updateTransfer = useCallback(async (
    transferId: string,
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    await updateTransferOp(
      budgetId,
      year,
      month,
      transferId,
      amount,
      fromAccountId,
      toAccountId,
      fromCategoryId,
      toCategoryId,
      date,
      description,
      cleared
    )
  }, [budgetId, year, month, updateTransferOp])

  const deleteTransfer = useCallback(async (transferId: string) => {
    if (!budgetId) throw new Error('No budget selected')

    await deleteTransferOp(budgetId, year, month, transferId)
  }, [budgetId, year, month, deleteTransferOp])

  // ==========================================================================
  // ADJUSTMENT MUTATIONS
  // ==========================================================================

  const addAdjustment = useCallback(async (
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    const [adjustmentYear, adjustmentMonth] = date.split('-').map(Number)

    await addAdjustmentOp(
      budgetId,
      adjustmentYear,
      adjustmentMonth,
      amount,
      accountId,
      categoryId,
      date,
      description,
      cleared
    )
  }, [budgetId, addAdjustmentOp])

  const updateAdjustment = useCallback(async (
    adjustmentId: string,
    amount: number,
    accountId: string,
    categoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => {
    if (!budgetId) throw new Error('No budget selected')

    await updateAdjustmentOp(
      budgetId,
      year,
      month,
      adjustmentId,
      amount,
      accountId,
      categoryId,
      date,
      description,
      cleared
    )
  }, [budgetId, year, month, updateAdjustmentOp])

  const deleteAdjustment = useCallback(async (adjustmentId: string) => {
    if (!budgetId) throw new Error('No budget selected')

    await deleteAdjustmentOp(budgetId, year, month, adjustmentId)
  }, [budgetId, year, month, deleteAdjustmentOp])

  // ==========================================================================
  // CACHE/REFRESH
  // ==========================================================================

  const refreshMonth = useCallback(async () => {
    if (!budgetId) return
    await queryClient.invalidateQueries({ queryKey: queryKeys.month(budgetId, year, month) })
  }, [budgetId, year, month])

  return {
    isLoading: monthQuery.isLoading, isFetching: monthQuery.isFetching, error: monthQuery.error,
    month: monthData, income, expenses, transfers, adjustments, categoryBalances,
    totalIncome, totalExpenses, areAllocationsFinalized, previousMonthIncome,
    addIncome, updateIncome, deleteIncome, addExpense, updateExpense, deleteExpense,
    addTransfer, updateTransfer, deleteTransfer, addAdjustment, updateAdjustment, deleteAdjustment, refreshMonth,
  }
}
