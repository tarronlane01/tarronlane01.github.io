/**
 * Types for Hidden Field Migration
 */

export interface HiddenFieldMigrationStatus {
  totalBudgets: number
  totalMonths: number
  accountsNeedingField: number
  categoriesNeedingField: number
  adjustmentsToFix: number
  adjustmentDetails: Array<{
    monthKey: string
    id: string
    description: string
    amount: number
    accountId: string
    categoryId: string
  }>
}

export interface HiddenFieldMigrationResult {
  budgetsProcessed: number
  accountsUpdated: number
  categoriesUpdated: number
  hiddenAccountsCreated: number
  hiddenCategoriesCreated: number
  adjustmentsFixed: number
  errors: string[]
}

export interface AdjustmentFixConfig {
  id: string
  amount: number
  date: string
  description: string
  targetAccount: string | null
  targetCategory: string | null
}

