/**
 * Database Cleanup Hook
 *
 * Consolidated migration that ensures all database documents match expected schemas.
 * Combines functionality from multiple previous migrations:
 *
 * 1. Budget Schema Validation:
 *    - Converts arrays to maps (accounts, categories, account_groups)
 *    - Ensures all accounts have required fields with defaults
 *    - Ensures all categories have required fields with defaults
 *    - Ensures all account_groups have required fields with defaults
 *
 * 2. Month Schema Validation:
 *    - Ensures months have all required fields
 *    - Removes months more than 2 months in the future
 *
 * All operations go directly to Firestore - no React Query caching.
 */

import { useState } from 'react'
// eslint-disable-next-line no-restricted-imports
import { readDocByPath, writeDocByPath, queryCollection, deleteDocByPath } from '@firestore'
import type {
  FirestoreData,
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  FinancialAccount,
  AccountGroup,
  Category,
} from '@types'

import type { DatabaseCleanupStatus, DatabaseCleanupResult, FutureMonthInfo } from './databaseCleanupTypes'
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

// Re-export types for consumers
export type { DatabaseCleanupStatus, DatabaseCleanupResult, FutureMonthInfo }

interface UseDatabaseCleanupOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useDatabaseCleanup({ currentUser, onComplete }: UseDatabaseCleanupOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<DatabaseCleanupStatus | null>(null)
  const [result, setResult] = useState<DatabaseCleanupResult | null>(null)

  // ============================================================================
  // SCAN STATUS
  // ============================================================================

  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
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

      for (const budgetDoc of budgetsResult.docs) {
        const data = budgetDoc.data

        // Check for array format (old schema)
        if (Array.isArray(data.accounts) || Array.isArray(data.categories) || Array.isArray(data.account_groups)) {
          budgetsWithArrays++
          continue // Skip detailed checks for array-format budgets
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
      }

      // Sort future months by date
      futureMonthsToDelete.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      setStatus({
        totalBudgets: budgetsResult.docs.length,
        budgetsWithArrays,
        budgetsWithMissingAccountDefaults,
        budgetsWithMissingCategoryDefaults,
        budgetsWithMissingGroupDefaults,
        accountsNeedingDefaults,
        categoriesNeedingDefaults,
        groupsNeedingDefaults,
        totalMonths: monthsResult.docs.length,
        futureMonthsToDelete,
        monthsWithSchemaIssues,
      })
    } catch (err) {
      console.error('Failed to scan database:', err)
    } finally {
      setIsScanning(false)
    }
  }

  // ============================================================================
  // RUN CLEANUP
  // ============================================================================

  async function runCleanup(): Promise<void> {
    if (!currentUser) return

    setIsRunning(true)
    setResult(null)

    const errors: string[] = []
    let budgetsProcessed = 0
    let accountsFixed = 0
    let categoriesFixed = 0
    let groupsFixed = 0
    let arraysConverted = 0
    let futureMonthsDeleted = 0
    let monthsFixed = 0

    try {
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

          // Ensure is_needs_recalculation exists
          if (updates.is_needs_recalculation === undefined) {
            updates.is_needs_recalculation = false
            needsUpdate = true
          }

          // Remove any old/deprecated fields
          delete (updates as { category_balances?: unknown }).category_balances
          delete (updates as { allocations?: unknown }).allocations
          delete (updates as { allocations_finalized?: unknown }).allocations_finalized

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
        } catch (err) {
          errors.push(`Month ${monthDoc.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      setResult({
        budgetsProcessed,
        accountsFixed,
        categoriesFixed,
        groupsFixed,
        arraysConverted,
        futureMonthsDeleted,
        monthsFixed,
        errors,
      })

      onComplete?.()
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        accountsFixed: 0,
        categoriesFixed: 0,
        groupsFixed: 0,
        arraysConverted: 0,
        futureMonthsDeleted: 0,
        monthsFixed: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const hasIssues = status !== null && (
    status.budgetsWithArrays > 0 ||
    status.accountsNeedingDefaults > 0 ||
    status.categoriesNeedingDefaults > 0 ||
    status.groupsNeedingDefaults > 0 ||
    status.futureMonthsToDelete.length > 0 ||
    status.monthsWithSchemaIssues > 0
  )

  const totalIssues = status !== null ? (
    status.budgetsWithArrays +
    status.accountsNeedingDefaults +
    status.categoriesNeedingDefaults +
    status.groupsNeedingDefaults +
    status.futureMonthsToDelete.length +
    status.monthsWithSchemaIssues
  ) : 0

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    hasIssues,
    totalIssues,
    // Cleanup
    isRunning,
    result,
    runCleanup,
  }
}
