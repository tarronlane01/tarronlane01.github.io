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
  budgetsNeedingMonthMap: number

  // Months
  totalMonths: number
  futureMonthsToDelete: FutureMonthInfo[]
  monthsWithSchemaIssues: number
  monthsWithOldRecalcField: number
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
  monthMapsAdded: number

  // Months
  futureMonthsDeleted: number
  monthsFixed: number
  oldRecalcFieldsRemoved: number

  errors: string[]
}

