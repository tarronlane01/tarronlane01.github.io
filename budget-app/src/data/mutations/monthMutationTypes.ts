/**
 * Types for Month Mutations
 *
 * Parameter interfaces for income, expense, and allocation mutations.
 */

import type { CategoryAllocation } from '../../types/budget'

// ============================================================================
// INCOME MUTATIONS
// ============================================================================

export interface AddIncomeParams {
  budgetId: string
  year: number
  month: number
  amount: number
  accountId: string
  date: string
  payee?: string
  description?: string
}

export interface UpdateIncomeParams {
  budgetId: string
  year: number
  month: number
  incomeId: string
  amount: number
  accountId: string
  date: string
  payee?: string
  description?: string
  oldAmount: number
  oldAccountId: string
}

export interface DeleteIncomeParams {
  budgetId: string
  year: number
  month: number
  incomeId: string
  amount: number
  accountId: string
}

// ============================================================================
// EXPENSE MUTATIONS
// ============================================================================

export interface AddExpenseParams {
  budgetId: string
  year: number
  month: number
  amount: number
  categoryId: string
  accountId: string
  date: string
  payee?: string
  description?: string
}

export interface UpdateExpenseParams {
  budgetId: string
  year: number
  month: number
  expenseId: string
  amount: number
  categoryId: string
  accountId: string
  date: string
  payee?: string
  description?: string
  oldAmount: number
  oldAccountId: string
}

export interface DeleteExpenseParams {
  budgetId: string
  year: number
  month: number
  expenseId: string
  amount: number
  accountId: string
}

// ============================================================================
// ALLOCATION MUTATIONS
// ============================================================================

export interface SaveAllocationsParams {
  budgetId: string
  year: number
  month: number
  allocations: CategoryAllocation[]
}

export interface FinalizeAllocationsParams {
  budgetId: string
  year: number
  month: number
  allocations: CategoryAllocation[]
}

export interface UnfinalizeAllocationsParams {
  budgetId: string
  year: number
  month: number
}

export interface DeleteAllocationsParams {
  budgetId: string
  year: number
  month: number
}

