/**
 * Database Cleanup Runner
 *
 * Executes the actual cleanup operations on the database.
 */

// eslint-disable-next-line no-restricted-imports
import { readDocByPath, writeDocByPath, queryCollection, deleteDocByPath, updateDocByPath } from '@firestore'
// eslint-disable-next-line no-restricted-imports
import { deleteField } from 'firebase/firestore'
import type {
  FirestoreData,
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  FinancialAccount,
  AccountGroup,
  Category,
  MonthMap,
} from '@types'
import { getYearMonthOrdinal } from '@utils'

import type { DatabaseCleanupResult } from './databaseCleanupTypes'
import {
  applyAccountDefaults,
  applyCategoryDefaults,
  applyAccountGroupDefaults,
  applyMonthDefaults,
} from './databaseCleanupDefaults'
import {
  accountNeedsDefaults,
  categoryNeedsDefaults,
  accountGroupNeedsDefaults,
  monthNeedsDefaults,
  getFutureMonthCutoff,
  isMonthBeyondCutoff,
} from './databaseCleanupValidation'

/**
 * Build the complete month_map for a budget by scanning ALL existing months.
 * The month_map now contains ALL months (not just a window) so we can derive
 * earliest/latest month from the map keys.
 */
async function buildCompleteMonthMapForBudget(budgetId: string): Promise<MonthMap> {
  const monthMap: MonthMap = {}

  // Query ALL months for this budget
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    `database cleanup: querying all months for budget ${budgetId}`,
    [{ field: 'budget_id', op: '==', value: budgetId }]
  )

  // Add ALL existing months to the map (just empty objects - no flags)
  for (const monthDoc of monthsResult.docs) {
    const data = monthDoc.data
    if (data.year && data.month) {
      const ordinal = getYearMonthOrdinal(data.year as number, data.month as number)
      monthMap[ordinal] = {}
    }
  }

  return monthMap
}

/**
 * Run the database cleanup and return results.
 */
export async function runDatabaseCleanup(): Promise<DatabaseCleanupResult> {
  const errors: string[] = []
  let budgetsProcessed = 0
  let accountsFixed = 0
  let categoriesFixed = 0
  let groupsFixed = 0
  let arraysConverted = 0
  let monthMapsUpdated = 0
  let deprecatedFieldsRemoved = 0
  let futureMonthsDeleted = 0
  let monthsFixed = 0
  let oldRecalcFieldsRemoved = 0

  // ========================================
  // CLEANUP BUDGETS
  // ========================================
  const budgetsResult = await queryCollection<FirestoreData>(
    'budgets',
    'database cleanup: reading all budgets to fix'
  )

  for (const budgetDoc of budgetsResult.docs) {
    try {
      const { exists, data } = await readDocByPath<FirestoreData>(
        'budgets',
        budgetDoc.id,
        'database cleanup: reading budget for update'
      )

      if (!exists || !data) continue

      let needsUpdate = false
      const updates: FirestoreData = { ...data }

      // Convert arrays to maps (old schema)
      if (Array.isArray(data.accounts)) {
        const accountsArray = data.accounts as FirestoreData[]
        const accountsMap: AccountsMap = {}
        for (const acc of accountsArray) {
          const accId = acc.id || `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          accountsMap[accId] = applyAccountDefaults(acc)
          accountsFixed++
        }
        updates.accounts = accountsMap
        needsUpdate = true
        arraysConverted++
      }

      if (Array.isArray(data.categories)) {
        const categoriesArray = data.categories as FirestoreData[]
        const categoriesMap: CategoriesMap = {}
        for (const cat of categoriesArray) {
          const catId = cat.id || `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          categoriesMap[catId] = applyCategoryDefaults(cat)
          categoriesFixed++
        }
        updates.categories = categoriesMap
        needsUpdate = true
        arraysConverted++
      }

      if (Array.isArray(data.account_groups)) {
        const groupsArray = data.account_groups as FirestoreData[]
        const groupsMap: AccountGroupsMap = {}
        for (const group of groupsArray) {
          const groupId = group.id || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          groupsMap[groupId] = applyAccountGroupDefaults(group)
          groupsFixed++
        }
        updates.account_groups = groupsMap
        needsUpdate = true
        arraysConverted++
      }

      // Fix accounts with missing defaults (map format)
      if (!Array.isArray(data.accounts) && data.accounts && typeof data.accounts === 'object') {
        const accounts = data.accounts as FirestoreData
        const fixedAccounts: AccountsMap = {}
        for (const [id, account] of Object.entries(accounts)) {
          if (accountNeedsDefaults(account as FirestoreData)) {
            fixedAccounts[id] = applyAccountDefaults(account as FirestoreData)
            accountsFixed++
            needsUpdate = true
          } else {
            fixedAccounts[id] = account as FinancialAccount
          }
        }
        if (needsUpdate) updates.accounts = fixedAccounts
      }

      // Fix categories with missing defaults (map format)
      if (!Array.isArray(data.categories) && data.categories && typeof data.categories === 'object') {
        const categories = data.categories as FirestoreData
        const fixedCategories: CategoriesMap = {}
        let categoryNeedsUpdate = false
        for (const [id, category] of Object.entries(categories)) {
          if (categoryNeedsDefaults(category as FirestoreData)) {
            fixedCategories[id] = applyCategoryDefaults(category as FirestoreData)
            categoriesFixed++
            categoryNeedsUpdate = true
          } else {
            fixedCategories[id] = category as Category
          }
        }
        if (categoryNeedsUpdate) {
          updates.categories = fixedCategories
          needsUpdate = true
        }
      }

      // Fix account groups with missing defaults (map format)
      if (!Array.isArray(data.account_groups) && data.account_groups && typeof data.account_groups === 'object') {
        const groups = data.account_groups as FirestoreData
        const fixedGroups: AccountGroupsMap = {}
        let groupNeedsUpdate = false
        for (const [id, group] of Object.entries(groups)) {
          if (accountGroupNeedsDefaults(group as FirestoreData)) {
            fixedGroups[id] = applyAccountGroupDefaults(group as FirestoreData)
            groupsFixed++
            groupNeedsUpdate = true
          } else {
            fixedGroups[id] = group as AccountGroup
          }
        }
        if (groupNeedsUpdate) {
          updates.account_groups = fixedGroups
          needsUpdate = true
        }
      }

      // Add/update month_map to include ALL months (not just window)
      if (data.month_map === undefined) {
        const monthMap = await buildCompleteMonthMapForBudget(budgetDoc.id)
        updates.month_map = monthMap
        needsUpdate = true
        monthMapsUpdated++
      }

      // Remove any old/deprecated fields from the updates object
      delete (updates as { category_balances?: unknown }).category_balances
      delete (updates as { allocations?: unknown }).allocations
      delete (updates as { allocations_finalized?: unknown }).allocations_finalized
      // Removed is_needs_recalculation deletion - field no longer exists
      delete (updates as { earliest_month?: unknown }).earliest_month

      if (needsUpdate) {
        await writeDocByPath(
          'budgets',
          budgetDoc.id,
          updates,
          'database cleanup: saving fixed budget'
        )
        budgetsProcessed++
      }

      // Remove deprecated earliest_month field using updateDoc (deleteField only works with updateDoc)
      if (data.earliest_month !== undefined) {
        await updateDocByPath(
          'budgets',
          budgetDoc.id,
          {
            earliest_month: deleteField(),
            updated_at: new Date().toISOString(),
          },
          `database cleanup: removing deprecated earliest_month from budget ${budgetDoc.id}`
        )
        deprecatedFieldsRemoved++
      }
    } catch (err) {
      errors.push(`Budget ${budgetDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // ========================================
  // CLEANUP MONTHS
  // ========================================
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    'database cleanup: reading all months'
  )

  const cutoff = getFutureMonthCutoff()

  for (const monthDoc of monthsResult.docs) {
    try {
      const data = monthDoc.data
      const year = data.year as number
      const month = data.month as number

      // Delete future months
      if (year && month && isMonthBeyondCutoff(year, month, cutoff)) {
        await deleteDocByPath(
          'months',
          monthDoc.id,
          `database cleanup: deleting future month ${year}-${month}`
        )
        futureMonthsDeleted++
        continue
      }

      // Fix schema issues
      if (monthNeedsDefaults(data)) {
        const fixedMonth = applyMonthDefaults(data, monthDoc.id)
        await writeDocByPath(
          'months',
          monthDoc.id,
          fixedMonth,
          'database cleanup: saving fixed month'
        )
        monthsFixed++
      }

      // Remove old is_needs_recalculation field
      if (data.is_needs_recalculation !== undefined) {
        await updateDocByPath(
          'months',
          monthDoc.id,
          {
            is_needs_recalculation: deleteField(),
            updated_at: new Date().toISOString(),
          },
          `database cleanup: removing is_needs_recalculation from month ${year}/${month}`
        )
        oldRecalcFieldsRemoved++
      }
    } catch (err) {
      errors.push(`Month ${monthDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // ========================================
  // CLEANUP DATA MAPPINGS
  // ========================================
  // Add budget_id to any data_mappings documents missing it (required for security rules)
  let dataMappingsFixed = 0

  const dataMappingsResult = await queryCollection<FirestoreData>(
    'data_mappings',
    'database cleanup: reading all data mappings'
  )

  for (const mappingDoc of dataMappingsResult.docs) {
    try {
      const data = mappingDoc.data

      // Skip if already has budget_id
      if (data.budget_id !== undefined) continue

      // Extract budget_id from document ID format: {budgetId}_import_data_map
      const docId = mappingDoc.id
      const suffixIndex = docId.lastIndexOf('_import_data_map')
      if (suffixIndex === -1) {
        errors.push(`Data mapping ${docId}: Cannot extract budget_id from document ID (unexpected format)`)
        continue
      }

      const budgetId = docId.substring(0, suffixIndex)

      // Verify the budget exists
      const { exists: budgetExists } = await readDocByPath(
        'budgets',
        budgetId,
        `database cleanup: verifying budget exists for data mapping ${docId}`
      )

      if (!budgetExists) {
        errors.push(`Data mapping ${docId}: Referenced budget ${budgetId} does not exist`)
        continue
      }

      // Add budget_id to the document
      await writeDocByPath(
        'data_mappings',
        docId,
        {
          ...data,
          budget_id: budgetId,
        },
        `database cleanup: adding budget_id to data mapping ${docId}`
      )
      dataMappingsFixed++
    } catch (err) {
      errors.push(`Data mapping ${mappingDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return {
    budgetsProcessed,
    accountsFixed,
    categoriesFixed,
    groupsFixed,
    arraysConverted,
    monthMapsUpdated,
    deprecatedFieldsRemoved,
    futureMonthsDeleted,
    monthsFixed,
    oldRecalcFieldsRemoved,
    dataMappingsFixed,
    errors,
  }
}

