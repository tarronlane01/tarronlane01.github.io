/**
 * Precision Cleanup Types
 *
 * Type definitions for currency precision cleanup operations.
 * This migration fixes floating point precision issues by rounding
 * all currency values to 2 decimal places.
 */

export interface PrecisionCleanupStatus {
  // Budgets
  totalBudgets: number
  budgetsWithPrecisionIssues: number
  accountsWithPrecisionIssues: number
  categoriesWithPrecisionIssues: number
  totalAvailableWithPrecisionIssues: number

  // Months
  totalMonths: number
  monthsWithPrecisionIssues: number
  incomeValuesWithPrecisionIssues: number
  expenseValuesWithPrecisionIssues: number
  categoryBalancesWithPrecisionIssues: number
  accountBalancesWithPrecisionIssues: number
}

export interface PrecisionCleanupResult {
  // Budgets
  budgetsProcessed: number
  accountsFixed: number
  categoriesFixed: number
  totalAvailableFixed: number

  // Months
  monthsProcessed: number
  incomeValuesFixed: number
  expenseValuesFixed: number
  categoryBalancesFixed: number
  accountBalancesFixed: number

  errors: string[]
}

