/**
 * Initial Balance Calculation Hook
 *
 * Calculates and syncs all balances after initial data load:
 * - Calculates category balances from month data
 * - Calculates account balances from month data
 * - Updates budget document with calculated balances
 * - Updates all month documents with calculated balances
 * - Saves all changes to database
 *
 * Runs once after initial data load completes, before removing loading overlay.
 */

import { useEffect, useRef } from 'react'
import { useApp } from '@contexts'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { recalculateMonth, extractSnapshotFromMonth, EMPTY_SNAPSHOT, type PreviousMonthSnapshot } from '@data/recalculation'
import { updateBudgetBalances } from '@data/recalculation/triggerRecalculationHelpers'
import { runRecalculationAssertions, logAssertionResults } from '@data/recalculation/assertions'
// eslint-disable-next-line no-restricted-imports -- Initial balance calculation needs direct Firestore access for batch writes
import { batchWriteDocs, type BatchWriteDoc } from '@firestore'
// eslint-disable-next-line no-restricted-imports -- Initial balance calculation needs direct Firestore access for reading budget
import { readDocByPath } from '@firestore'
import { useUpdateAccounts, useUpdateCategories } from '@data/mutations/budget'
import { getYearMonthOrdinal, getMonthDocId, cleanForFirestore, roundCurrency } from '@utils'
import { isNoCategory, isNoAccount } from '@data/constants'
import { calculateTotalBalances } from '@data/cachedReads'
import { bannerQueue } from '@components/ui'
import type { MonthDocument, AccountsMap, CategoriesMap, MonthMap, FirestoreData } from '@types'
import type { BudgetDocument } from '@data/recalculation/triggerRecalculationTypes'
import type { MonthQueryData } from '@data/queries/month'

interface UseInitialBalanceCalculationParams {
  budgetId: string | null
  enabled: boolean
  initialDataLoadComplete: boolean
  months: MonthDocument[]
}

/**
 * Compare two balance arrays to see if they're equal.
 * Arrays are compared by converting to maps keyed by id for efficient comparison.
 */
function balancesEqual<T extends { account_id?: string; category_id?: string }>(
  a: T[],
  b: T[]
): boolean {
  if (a.length !== b.length) return false

  // Convert to maps for easier comparison
  const mapA = new Map<string, T>()
  const mapB = new Map<string, T>()

  for (const item of a) {
    const id = 'account_id' in item ? item.account_id : item.category_id
    if (id) mapA.set(id, item)
  }

  for (const item of b) {
    const id = 'account_id' in item ? item.account_id : item.category_id
    if (id) mapB.set(id, item)
  }

  if (mapA.size !== mapB.size) return false

  for (const [id, itemA] of mapA) {
    const itemB = mapB.get(id)
    if (!itemB) return false

    // Compare all fields (balance objects should have the same structure)
    const keys = Object.keys(itemA) as Array<keyof T>
    for (const key of keys) {
      if (itemA[key] !== itemB[key]) return false
    }
  }

  return true
}

/**
 * Check if a recalculated month has changed from the original.
 * Compares only the fields that can change during recalculation.
 */
function monthHasChanged(original: MonthDocument, recalculated: MonthDocument): boolean {
  // Compare totals
  if (original.total_income !== recalculated.total_income) return true
  if (original.total_expenses !== recalculated.total_expenses) return true
  if (original.previous_month_income !== recalculated.previous_month_income) return true

  // Compare balance arrays
  if (!balancesEqual(original.account_balances, recalculated.account_balances)) return true
  if (!balancesEqual(original.category_balances, recalculated.category_balances)) return true

  return false
}

/**
 * Check if budget balances have changed.
 */
function budgetBalancesHaveChanged(
  originalAccounts: AccountsMap,
  originalCategories: CategoriesMap,
  updatedAccounts: AccountsMap,
  updatedCategories: CategoriesMap
): boolean {
  // Check if any account balance changed
  for (const [accId, acc] of Object.entries(updatedAccounts)) {
    const original = originalAccounts[accId]
    if (!original || original.balance !== acc.balance) return true
  }

  // Check if any category balance changed
  for (const [catId, cat] of Object.entries(updatedCategories)) {
    const original = originalCategories[catId]
    if (!original || original.balance !== cat.balance) return true
  }

  return false
}

/**
 * Hook to calculate and sync balances after initial data load
 */
export function useInitialBalanceCalculation({
  budgetId,
  enabled,
  initialDataLoadComplete,
  months,
}: UseInitialBalanceCalculationParams) {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { updateAccounts } = useUpdateAccounts()
  const { updateCategories } = useUpdateCategories()
  const hasCalculatedRef = useRef(false)

  useEffect(() => {
    // Only run once when conditions are met
    if (!enabled || !budgetId || !initialDataLoadComplete || months.length === 0 || hasCalculatedRef.current) {
      return
    }

    // Mark as calculated to prevent re-running
    hasCalculatedRef.current = true

    const calculateAndSyncBalances = async () => {
      try {
        addLoadingHold('initial-balance-calculation', 'Calculating balances...')

        // Get budget data from cache
        const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
        if (!budgetData) {
          console.warn('[useInitialBalanceCalculation] No budget data in cache')
          removeLoadingHold('initial-balance-calculation')
          return
        }

        const { budget, accounts, categories } = budgetData
        const categoryIds = Object.keys(categories)

        // Sort months chronologically
        const sortedMonths = [...months].sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

        // For the earliest month, use its existing start_balances as the initial snapshot
        // This preserves the historical balances that summarize everything before the downloaded months
        // For subsequent months, we'll use end_balances from the previous month
        const earliestMonth = sortedMonths[0]
        let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
        
        if (earliestMonth) {
          // Extract start balances from the earliest month to preserve historical data
          const categoryStartBalances: Record<string, number> = {}
          const accountStartBalances: Record<string, number> = {}
          
          // Use existing start_balances from the earliest month (these represent pre-download history)
          // These start_balances summarize everything before the downloaded months
          for (const cb of earliestMonth.category_balances || []) {
            if (!isNoCategory(cb.category_id)) {
              categoryStartBalances[cb.category_id] = roundCurrency(cb.start_balance ?? 0)
            }
          }
          
          for (const ab of earliestMonth.account_balances || []) {
            if (!isNoAccount(ab.account_id)) {
              accountStartBalances[ab.account_id] = roundCurrency(ab.start_balance ?? 0)
            }
          }
          
          prevSnapshot = {
            categoryEndBalances: categoryStartBalances,
            accountEndBalances: accountStartBalances,
            totalIncome: roundCurrency(earliestMonth.previous_month_income ?? 0),
          }
        }
        
        const updatedMonths: MonthDocument[] = []
        const monthsToSave: MonthDocument[] = []

        // Process each month to calculate balances using recalculateMonth (pure function)
        for (const month of sortedMonths) {
          // Recalculate month using previous month's snapshot
          // For the earliest month, this uses its preserved start_balances
          // For subsequent months, this uses the previous month's end_balances
          const recalculated = recalculateMonth(month, prevSnapshot)
          updatedMonths.push(recalculated)

          // Only include in save list if it actually changed
          if (monthHasChanged(month, recalculated)) {
            monthsToSave.push(recalculated)
          }

          // Extract snapshot for next month (end_balances become next month's start_balances)
          prevSnapshot = extractSnapshotFromMonth(recalculated)
        }

        // Get final balances from last month's snapshot
        const runningAccountBalances = prevSnapshot.accountEndBalances
        const currentCategoryBalances = prevSnapshot.categoryEndBalances

        // Calculate total category balances (including future allocations) to match what's stored in budget document
        // The budget document stores total balances (all-time including future), not just current month's end_balance
        const lastMonth = updatedMonths[updatedMonths.length - 1]
        const runningCategoryBalances = await calculateTotalBalances(
          budgetId,
          categoryIds,
          currentCategoryBalances,
          lastMonth.year,
          lastMonth.month
        )

        // Update account balances in budget document
        const updatedAccounts: AccountsMap = {}
        Object.entries(accounts).forEach(([accId, acc]) => {
          updatedAccounts[accId] = { ...acc, balance: runningAccountBalances[accId] ?? 0 }
        })

        // Update category balances in budget document
        const updatedCategories: CategoriesMap = {}
        Object.entries(categories).forEach(([catId, cat]) => {
          updatedCategories[catId] = { ...cat, balance: runningCategoryBalances[catId] ?? 0 }
        })

        // Get month map from budget
        const monthMap: MonthMap = budget.month_map || {}
        const monthOrdinals = new Set(sortedMonths.map(m => getYearMonthOrdinal(m.year, m.month)))
        const updatedMonthMap: MonthMap = {}
        for (const ordinal of Object.keys(monthMap)) {
          if (monthOrdinals.has(ordinal)) {
            updatedMonthMap[ordinal] = { needs_recalculation: false }
          } else {
            updatedMonthMap[ordinal] = monthMap[ordinal]
          }
        }

        // Save only months that actually changed in a batch for better performance
        if (monthsToSave.length > 0) {
          addLoadingHold('initial-balance-calculation', 'Saving month balances...')
          
          // Prepare batch write documents
          const batchDocs: BatchWriteDoc[] = monthsToSave.map(month => ({
            collectionPath: 'months',
            docId: getMonthDocId(budgetId, month.year, month.month),
            data: cleanForFirestore({
              ...month,
              updated_at: new Date().toISOString(),
            }) as FirestoreData,
          }))

          // Write all changed months in a single batch operation
          await batchWriteDocs(batchDocs, 'initial balance calculation: batch write months')
        }

        // Update all month caches (both changed and unchanged) to reflect recalculated values
        // This ensures the UI shows the correct calculated values even if nothing was saved
        for (const month of updatedMonths) {
          queryClient.setQueryData<MonthQueryData>(
            queryKeys.month(budgetId, month.year, month.month),
            { month }
          )
        }

        // Update budget document with calculated balances (only if changed)
        const budgetNeedsUpdate =
          budgetBalancesHaveChanged(accounts, categories, updatedAccounts, updatedCategories) ||
          JSON.stringify(budget.month_map) !== JSON.stringify(updatedMonthMap)

        if (budgetNeedsUpdate) {
          addLoadingHold('initial-balance-calculation', 'Saving budget balances...')
          await updateBudgetBalances(budgetId, runningAccountBalances, runningCategoryBalances, updatedMonthMap)

          // Also update via mutations to ensure cache is updated
          await updateAccounts.mutateAsync({ budgetId, accounts: updatedAccounts })
          await updateCategories.mutateAsync({ budgetId, categories: updatedCategories })

          // Run assertions to validate the recalculation
          const { data: updatedBudgetData } = await readDocByPath<BudgetDocument>(
            'budgets',
            budgetId,
            '[initial balance calculation] reading budget for assertions'
          )

          if (updatedBudgetData && updatedMonths.length > 0) {
            // Use the last month's year/month for assertions
            const lastMonth = updatedMonths[updatedMonths.length - 1]
            const assertionResults = await runRecalculationAssertions({
              budgetId,
              categories: updatedBudgetData.categories || {},
              totalAvailable: updatedBudgetData.total_available ?? 0,
              currentYear: lastMonth.year,
              currentMonth: lastMonth.month,
            })

            // Log results and show banners for failures
            const banners = logAssertionResults(assertionResults, '[Initial Balance Calculation]')
            banners.forEach(banner => bannerQueue.add(banner))
          }
        } else {
          // Still update cache even if we don't save, to ensure UI is in sync
          queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
            ...budgetData,
            budget: { ...budget, month_map: updatedMonthMap },
            accounts: updatedAccounts,
            categories: updatedCategories,
          })
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to calculate initial balances'
        console.error('[useInitialBalanceCalculation] Error calculating balances:', error)
        // Show error in banner system
        bannerQueue.add({
          type: 'error',
          message: `Initial balance calculation failed: ${errorMessage}`,
          autoDismissMs: 10000,
        })
      } finally {
        removeLoadingHold('initial-balance-calculation')
      }
    }

    calculateAndSyncBalances()
  }, [enabled, budgetId, initialDataLoadComplete, months, addLoadingHold, removeLoadingHold, updateAccounts, updateCategories])

  // Reset ref when budget changes
  useEffect(() => {
    if (!budgetId) {
      hasCalculatedRef.current = false
    }
  }, [budgetId])
}
