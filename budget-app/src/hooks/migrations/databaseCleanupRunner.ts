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
 * Get the 7-month window ordinals (3 past, current, 3 future).
 */
function getMonthWindowOrdinals(): string[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const ordinals: string[] = []

  // 3 months in the past
  for (let i = 3; i > 0; i--) {
    let year = currentYear
    let month = currentMonth - i
    while (month < 1) {
      month += 12
      year -= 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  // Current month
  ordinals.push(getYearMonthOrdinal(currentYear, currentMonth))

  // 3 months in the future
  for (let i = 1; i <= 3; i++) {
    let year = currentYear
    let month = currentMonth + i
    while (month > 12) {
      month -= 12
      year += 1
    }
    ordinals.push(getYearMonthOrdinal(year, month))
  }

  return ordinals
}

/**
 * Build the initial month_map for a budget based on existing months.
 */
async function buildMonthMapForBudget(budgetId: string): Promise<MonthMap> {
  const monthMap: MonthMap = {}
  const windowOrdinals = getMonthWindowOrdinals()

  // Query months for this budget
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    `database cleanup: querying months for budget ${budgetId}`,
    [{ field: 'budget_id', op: '==', value: budgetId }]
  )

  // Get ordinals of existing months
  const existingOrdinals = new Set<string>()
  for (const monthDoc of monthsResult.docs) {
    const data = monthDoc.data
    if (data.year && data.month) {
      const ordinal = getYearMonthOrdinal(data.year as number, data.month as number)
      existingOrdinals.add(ordinal)
    }
  }

  // Only add entries for months that exist AND are in the window
  for (const ordinal of windowOrdinals) {
    if (existingOrdinals.has(ordinal)) {
      monthMap[ordinal] = { needs_recalculation: false }
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
  let monthMapsAdded = 0
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

      // Add month_map if field is missing entirely
      if (data.month_map === undefined) {
        const monthMap = await buildMonthMapForBudget(budgetDoc.id)
        updates.month_map = monthMap
        needsUpdate = true
        monthMapsAdded++
        console.log(`[DatabaseCleanup] Added month_map to budget ${budgetDoc.id} with ${Object.keys(monthMap).length} months`)
      }

      // Remove any old/deprecated fields
      delete (updates as { category_balances?: unknown }).category_balances
      delete (updates as { allocations?: unknown }).allocations
      delete (updates as { allocations_finalized?: unknown }).allocations_finalized
      delete (updates as { is_needs_recalculation?: unknown }).is_needs_recalculation

      if (needsUpdate) {
        await writeDocByPath(
          'budgets',
          budgetDoc.id,
          updates,
          'database cleanup: saving fixed budget'
        )
        budgetsProcessed++
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
        console.log(`[DatabaseCleanup] Removed is_needs_recalculation from month ${year}/${month}`)
      }
    } catch (err) {
      errors.push(`Month ${monthDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return {
    budgetsProcessed,
    accountsFixed,
    categoriesFixed,
    groupsFixed,
    arraysConverted,
    monthMapsAdded,
    futureMonthsDeleted,
    monthsFixed,
    oldRecalcFieldsRemoved,
    errors,
  }
}

