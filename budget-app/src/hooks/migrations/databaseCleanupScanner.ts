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
  let budgetsNeedingMonthMapUpdate = 0
  let budgetsWithDeprecatedEarliestMonth = 0

  // Track budgets for month_map validation
  const budgetIds = new Set<string>()

  for (const budgetDoc of budgetsResult.docs) {
    const data = budgetDoc.data

    // Check for array format (old schema)
    if (Array.isArray(data.accounts) || Array.isArray(data.categories) || Array.isArray(data.account_groups)) {
      budgetsWithArrays++
      continue // Skip detailed checks for array-format budgets
    }

    budgetIds.add(budgetDoc.id)

    // Check if month_map field is missing entirely
    if (data.month_map === undefined) {
      budgetsNeedingMonthMapUpdate++
    }

    // Check if deprecated earliest_month field exists (should be removed)
    if (data.earliest_month !== undefined) {
      budgetsWithDeprecatedEarliestMonth++
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

  // ========================================
  // SCAN DATA MAPPINGS
  // ========================================
  // Check for data_mappings documents missing budget_id field (security rule requirement)
  const dataMappingsResult = await queryCollection<FirestoreData>(
    'data_mappings',
    'database cleanup: scanning all data mappings'
  )

  let dataMappingsMissingBudgetId = 0
  for (const mappingDoc of dataMappingsResult.docs) {
    const data = mappingDoc.data
    if (data.budget_id === undefined) {
      dataMappingsMissingBudgetId++
    }
  }

  return {
    totalBudgets: budgetsResult.docs.length,
    budgetsWithArrays,
    budgetsWithMissingAccountDefaults,
    budgetsWithMissingCategoryDefaults,
    budgetsWithMissingGroupDefaults,
    accountsNeedingDefaults,
    categoriesNeedingDefaults,
    groupsNeedingDefaults,
    budgetsNeedingMonthMapUpdate,
    budgetsWithDeprecatedEarliestMonth,
    totalMonths: monthsResult.docs.length,
    futureMonthsToDelete,
    monthsWithSchemaIssues,
    monthsWithOldRecalcField,
    totalDataMappings: dataMappingsResult.docs.length,
    dataMappingsMissingBudgetId,
  }
}

