/**
 * Database Cleanup Types
 *
 * Type definitions for database cleanup operations.
 */

export interface DatabaseCleanupStatus {
  // Budgets
  totalBudgets: number
  budgetsWithArrays: number
  budgetsWithMissingAccountDefaults: number
  budgetsWithMissingCategoryDefaults: number
  budgetsWithMissingGroupDefaults: number
  accountsNeedingDefaults: number
  categoriesNeedingDefaults: number
  groupsNeedingDefaults: number

  // Months
  totalMonths: number
  futureMonthsToDelete: FutureMonthInfo[]
  monthsWithSchemaIssues: number
}

export interface FutureMonthInfo {
  docId: string
  budgetId: string
  year: number
  month: number
}

export interface DatabaseCleanupResult {
  // Budgets
  budgetsProcessed: number
  accountsFixed: number
  categoriesFixed: number
  groupsFixed: number
  arraysConverted: number

  // Months
  futureMonthsDeleted: number
  monthsFixed: number

  errors: string[]
}

