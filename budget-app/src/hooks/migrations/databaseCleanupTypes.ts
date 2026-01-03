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
  budgetsNeedingMonthMapUpdate: number
  budgetsWithDeprecatedEarliestMonth: number

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
  monthMapsUpdated: number
  deprecatedFieldsRemoved: number

  // Months
  futureMonthsDeleted: number
  monthsFixed: number
  oldRecalcFieldsRemoved: number

  errors: string[]
}

