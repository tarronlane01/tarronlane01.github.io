/**
 * Database Cleanup Scanner
 *
 * Scans the database to identify issues that need cleanup.
 */

// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import type { FirestoreData } from '@types'

import type { DatabaseCleanupStatus, FutureMonthInfo } from './databaseCleanupTypes'
import {
  accountNeedsDefaults,
  categoryNeedsDefaults,
  accountGroupNeedsDefaults,
  monthNeedsDefaults,
  getFutureMonthCutoff,
  isMonthBeyondCutoff,
} from './databaseCleanupValidation'

/**
 * Scan the database and return status of all issues.
 */
export async function scanDatabaseStatus(): Promise<DatabaseCleanupStatus> {
  // Scan budgets
  const budgetsResult = await queryCollection<FirestoreData>(
    'budgets',
    'database cleanup: scanning all budgets'
  )

  let budgetsWithArrays = 0
  let budgetsWithMissingAccountDefaults = 0
  let budgetsWithMissingCategoryDefaults = 0
  let budgetsWithMissingGroupDefaults = 0
  let accountsNeedingDefaults = 0
  let categoriesNeedingDefaults = 0
  let groupsNeedingDefaults = 0
  let budgetsNeedingMonthMap = 0

  for (const budgetDoc of budgetsResult.docs) {
    const data = budgetDoc.data

    // Check for array format (old schema)
    if (Array.isArray(data.accounts) || Array.isArray(data.categories) || Array.isArray(data.account_groups)) {
      budgetsWithArrays++
      continue // Skip detailed checks for array-format budgets
    }

    // Check if month_map field is missing entirely
    if (data.month_map === undefined) {
      budgetsNeedingMonthMap++
    }

    // Check accounts
    const accounts = data.accounts as FirestoreData | undefined
    if (accounts && typeof accounts === 'object') {
      let budgetHasAccountIssues = false
      for (const account of Object.values(accounts)) {
        if (accountNeedsDefaults(account as FirestoreData)) {
          accountsNeedingDefaults++
          budgetHasAccountIssues = true
        }
      }
      if (budgetHasAccountIssues) budgetsWithMissingAccountDefaults++
    }

    // Check categories
    const categories = data.categories as FirestoreData | undefined
    if (categories && typeof categories === 'object') {
      let budgetHasCategoryIssues = false
      for (const category of Object.values(categories)) {
        if (categoryNeedsDefaults(category as FirestoreData)) {
          categoriesNeedingDefaults++
          budgetHasCategoryIssues = true
        }
      }
      if (budgetHasCategoryIssues) budgetsWithMissingCategoryDefaults++
    }

    // Check account groups
    const groups = data.account_groups as FirestoreData | undefined
    if (groups && typeof groups === 'object') {
      let budgetHasGroupIssues = false
      for (const group of Object.values(groups)) {
        if (accountGroupNeedsDefaults(group as FirestoreData)) {
          groupsNeedingDefaults++
          budgetHasGroupIssues = true
        }
      }
      if (budgetHasGroupIssues) budgetsWithMissingGroupDefaults++
    }
  }

  // Scan months
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    'database cleanup: scanning all months'
  )

  const cutoff = getFutureMonthCutoff()
  const futureMonthsToDelete: FutureMonthInfo[] = []
  let monthsWithSchemaIssues = 0
  let monthsWithOldRecalcField = 0

  for (const monthDoc of monthsResult.docs) {
    const data = monthDoc.data
    const year = data.year as number
    const month = data.month as number

    // Check for future months
    if (year && month && isMonthBeyondCutoff(year, month, cutoff)) {
      futureMonthsToDelete.push({
        docId: monthDoc.id,
        budgetId: data.budget_id as string,
        year,
        month,
      })
    }

    // Check for schema issues
    if (monthNeedsDefaults(data)) {
      monthsWithSchemaIssues++
    }

    // Check for old is_needs_recalculation field
    if (data.is_needs_recalculation !== undefined) {
      monthsWithOldRecalcField++
    }
  }

  // Sort future months by date
  futureMonthsToDelete.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  return {
    totalBudgets: budgetsResult.docs.length,
    budgetsWithArrays,
    budgetsWithMissingAccountDefaults,
    budgetsWithMissingCategoryDefaults,
    budgetsWithMissingGroupDefaults,
    accountsNeedingDefaults,
    categoriesNeedingDefaults,
    groupsNeedingDefaults,
    budgetsNeedingMonthMap,
    totalMonths: monthsResult.docs.length,
    futureMonthsToDelete,
    monthsWithSchemaIssues,
    monthsWithOldRecalcField,
  }
}

