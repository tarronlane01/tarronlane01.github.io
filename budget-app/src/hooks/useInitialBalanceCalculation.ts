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
// Removed updateBudgetBalances import - we don't save budget balances to Firestore
// Removed batchWriteDocs import - no longer doing batch writes on initial load
import { useUpdateAccounts, useUpdateCategories } from '@data/mutations/budget'
import { getYearMonthOrdinal, roundCurrency, getPreviousMonth } from '@utils'
import { isNoCategory, isNoAccount } from '@data/constants'
import { calculateTotalBalances } from '@data/cachedReads'
import { bannerQueue } from '@components/ui'
import type { MonthDocument, AccountsMap, CategoriesMap, MonthMap } from '@types'
import type { MonthQueryData } from '@data/queries/month'
import { getFirstWindowMonth, isMonthAtOrBeforeWindow } from '@utils/window'
import { writeMonthData } from '@data/mutations/month/useWriteMonthData'
import { convertMonthBalancesToStored } from '@data/firestore/converters/monthBalances'

interface UseInitialBalanceCalculationParams {
  budgetId: string | null
  enabled: boolean
  initialDataLoadComplete: boolean
  months: MonthDocument[]
}

// Removed monthHasChanged, balancesEqual, and budgetBalancesHaveChanged functions
// No longer needed - we don't track changes to calculated fields since they're not saved to Firestore
// Months will recalculate on-demand when missing from cache

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

        // Get first window month (earliest month that should have start_balance saved)
        const firstWindowMonth = getFirstWindowMonth()
        const firstWindowOrdinal = getYearMonthOrdinal(firstWindowMonth.year, firstWindowMonth.month)
        
        // Find the earliest month in our loaded months
        const earliestLoadedMonth = sortedMonths[0]
        const earliestLoadedOrdinal = earliestLoadedMonth 
          ? getYearMonthOrdinal(earliestLoadedMonth.year, earliestLoadedMonth.month)
          : null

        // Check if first window month is in our loaded months and has start_balance
        let firstWindowMonthData: MonthDocument | null = null
        if (earliestLoadedOrdinal && earliestLoadedOrdinal <= firstWindowOrdinal) {
          // First window month is in our loaded months (or before)
          firstWindowMonthData = sortedMonths.find(m => {
            const ordinal = getYearMonthOrdinal(m.year, m.month)
            return ordinal === firstWindowOrdinal
          }) || null
        } else {
          // First window month is before our loaded months - use readMonth to respect cache
          const { readMonth } = await import('@data/queries/month')
          firstWindowMonthData = await readMonth(budgetId, firstWindowMonth.year, firstWindowMonth.month, {
            description: 'initial balance calculation: fetching first window month',
          })
        }

        // Check if first window month has start_balance saved
        let hasStartBalance = false
        if (firstWindowMonthData) {
          // Check if any category/account has non-zero start_balance (indicating it was saved)
          hasStartBalance = (firstWindowMonthData.category_balances || []).some(cb => 
            !isNoCategory(cb.category_id) && cb.start_balance !== 0
          ) || (firstWindowMonthData.account_balances || []).some(ab => 
            !isNoAccount(ab.account_id) && ab.start_balance !== 0
          )
        }

        // If first window month doesn't have start_balance, walk backward to find one
        let prevSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
        const monthsToCalculateBackward: MonthDocument[] = []
        
        if (!hasStartBalance && firstWindowMonthData) {
          // Walk backward from first window month to find a month with start_balance
          let walkYear = firstWindowMonth.year
          let walkMonth = firstWindowMonth.month
          let foundStart = false
          const maxWalkBack = 120 // Don't walk back more than 10 years

          for (let i = 0; i < maxWalkBack && !foundStart; i++) {
            const prev = getPreviousMonth(walkYear, walkMonth)
            walkYear = prev.year
            walkMonth = prev.month

            // Use readMonth to respect cache - prevents duplicate reads
            const { readMonth } = await import('@data/queries/month')
            const prevMonthData = await readMonth(budgetId, walkYear, walkMonth, {
              description: `initial balance calculation: walking backward to find start_balance`,
            })

            if (!prevMonthData) {
              // No more months - start from zero
              foundStart = true
            } else {
              // Check if this month has start_balance saved
              const hasPrevStartBalance = (prevMonthData.category_balances || []).some(cb => 
                !isNoCategory(cb.category_id) && cb.start_balance !== 0
              ) || (prevMonthData.account_balances || []).some(ab => 
                !isNoAccount(ab.account_id) && ab.start_balance !== 0
              )

              if (hasPrevStartBalance) {
                // Found a month with start_balance - use its end_balance as starting point
                foundStart = true
                const categoryStartBalances: Record<string, number> = {}
                const accountStartBalances: Record<string, number> = {}

                for (const cb of prevMonthData.category_balances || []) {
                  if (!isNoCategory(cb.category_id)) {
                    categoryStartBalances[cb.category_id] = roundCurrency(cb.end_balance ?? 0)
                  }
                }

                for (const ab of prevMonthData.account_balances || []) {
                  if (!isNoAccount(ab.account_id)) {
                    accountStartBalances[ab.account_id] = roundCurrency(ab.end_balance ?? 0)
                  }
                }

                prevSnapshot = {
                  categoryEndBalances: categoryStartBalances,
                  accountEndBalances: accountStartBalances,
                  totalIncome: roundCurrency(prevMonthData.total_income ?? 0),
                }
              } else {
                // This month doesn't have start_balance - add to list and keep walking
                monthsToCalculateBackward.push(prevMonthData)
              }
            }
          }

          // Reverse the list so we process oldest first, then walk forward to first window month
          monthsToCalculateBackward.reverse()
          
          // Calculate forward from the starting point to the first window month
          for (const monthData of monthsToCalculateBackward) {
            const recalculated = recalculateMonth(monthData, prevSnapshot, monthData.previous_month_income)
            prevSnapshot = extractSnapshotFromMonth(recalculated)
            
            // Save this month if it's at/before the first window month
            if (isMonthAtOrBeforeWindow(monthData.year, monthData.month)) {
              // Convert to stored format and save (only saves start_balance for months at/before window)
              const storedMonth = convertMonthBalancesToStored(recalculated)
              await writeMonthData({
                budgetId,
                month: storedMonth,
                description: `initial balance calculation: ensuring start_balance for ${monthData.year}/${monthData.month}`,
                updateMonthMap: false,
              })
            }
          }
        } else if (earliestLoadedMonth) {
          // First window month (or earlier) has start_balance - use earliest loaded month's start_balances
          const categoryStartBalances: Record<string, number> = {}
          const accountStartBalances: Record<string, number> = {}
          
          for (const cb of earliestLoadedMonth.category_balances || []) {
            if (!isNoCategory(cb.category_id)) {
              categoryStartBalances[cb.category_id] = roundCurrency(cb.start_balance ?? 0)
            }
          }
          
          for (const ab of earliestLoadedMonth.account_balances || []) {
            if (!isNoAccount(ab.account_id)) {
              accountStartBalances[ab.account_id] = roundCurrency(ab.start_balance ?? 0)
            }
          }
          
          prevSnapshot = {
            categoryEndBalances: categoryStartBalances,
            accountEndBalances: accountStartBalances,
            totalIncome: roundCurrency(earliestLoadedMonth.previous_month_income ?? 0),
          }
        }
        
        const updatedMonths: MonthDocument[] = []

        // Process each month to calculate balances using recalculateMonth (pure function)
        // Just recalculate and update cache - don't save to Firestore (months recalculate on-demand when missing)
        for (const month of sortedMonths) {
          // Recalculate month using previous month's snapshot
          // For the earliest month, this uses its preserved start_balances
          // For subsequent months, this uses the previous month's end_balances
          // Preserve previous_month_income from initial load (computed from budget's percentage_income_months_back)
          const recalculated = recalculateMonth(month, prevSnapshot, month.previous_month_income)
          updatedMonths.push(recalculated)

          // Extract snapshot for next month (end_balances become next month's start_balances)
          prevSnapshot = extractSnapshotFromMonth(recalculated)
        }

        // Get final balances from last processed month's snapshot
        const runningAccountBalances = prevSnapshot.accountEndBalances
        const currentCategoryBalances = prevSnapshot.categoryEndBalances

        // Calculate total category balances (including future allocations) to match what's stored in budget document
        // The budget document stores total balances (all-time including future), not just current month's end_balance
        // Start from the first window month (which has start_balance) and walk forward through all future months
        const lastProcessedMonth = updatedMonths.length > 0 
          ? updatedMonths[updatedMonths.length - 1]
          : sortedMonths.length > 0 
            ? sortedMonths[sortedMonths.length - 1]
            : null

        let runningCategoryBalances: Record<string, number>
        
        if (!lastProcessedMonth) {
          // No months processed - use empty balances
          runningCategoryBalances = {}
          categoryIds.forEach(id => { runningCategoryBalances[id] = 0 })
        } else {
          // Continue from the last processed month forward through all future months in the budget
          // This adds future allocations and expenses to get the all-time total
          runningCategoryBalances = await calculateTotalBalances(
            budgetId,
            categoryIds,
            currentCategoryBalances,
            lastProcessedMonth.year,
            lastProcessedMonth.month
          )
        }

        // Update account balances in budget document
        // Round all balances to ensure 2 decimal precision
        const updatedAccounts: AccountsMap = {}
        Object.entries(accounts).forEach(([accId, acc]) => {
          updatedAccounts[accId] = { ...acc, balance: roundCurrency(runningAccountBalances[accId] ?? 0) }
        })

        // Update category balances in budget document
        // Round all balances to ensure 2 decimal precision
        const updatedCategories: CategoriesMap = {}
        Object.entries(categories).forEach(([catId, cat]) => {
          updatedCategories[catId] = { ...cat, balance: roundCurrency(runningCategoryBalances[catId] ?? 0) }
        })

        // Get month map from budget (just track which months exist, no flags)
        const monthMap: MonthMap = budget.month_map || {}
        const monthOrdinals = new Set(sortedMonths.map(m => getYearMonthOrdinal(m.year, m.month)))
        const updatedMonthMap: MonthMap = {}
        for (const ordinal of Object.keys(monthMap)) {
          if (monthOrdinals.has(ordinal)) {
            updatedMonthMap[ordinal] = {} // Just track presence, no flags
          } else {
            updatedMonthMap[ordinal] = monthMap[ordinal]
          }
        }
        // Add any new months that weren't in the map
        for (const month of sortedMonths) {
          const ordinal = getYearMonthOrdinal(month.year, month.month)
          if (!(ordinal in updatedMonthMap)) {
            updatedMonthMap[ordinal] = {}
          }
        }

        // Removed batch write - months will recalculate on-demand when missing from cache
        // start_balance will be saved when months are actually edited (via writeMonthData)

        // Update all month caches to reflect recalculated values
        // This ensures the UI shows the correct calculated values even if nothing was saved
        for (const month of updatedMonths) {
          queryClient.setQueryData<MonthQueryData>(
            queryKeys.month(budgetId, month.year, month.month),
            { month }
          )
        }

        // Update budget cache with calculated balances (don't save to Firestore - balances are calculated on-the-fly)
        // Only update month_map if it changed (this is the only thing we save to Firestore for budget)
        const monthMapChanged = JSON.stringify(budget.month_map) !== JSON.stringify(updatedMonthMap)

        if (monthMapChanged) {
          // Only save month_map to Firestore (not balances - those are calculated)
          addLoadingHold('initial-balance-calculation', 'Saving month map...')
          const { writeBudgetData } = await import('@data/mutations/budget/writeBudgetData')
          await writeBudgetData({
            budgetId,
            updates: {
              month_map: updatedMonthMap,
            },
            description: 'initial balance calculation: updating month_map',
          })
        }

        // Always update cache with calculated balances (even if nothing was saved)
        // This ensures the UI shows the correct calculated values
        // Note: total_available is calculated on-the-fly in useBudgetData, not stored in cache
        queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
          ...budgetData,
          budget: { 
            ...budget, 
            month_map: updatedMonthMap,
          },
          accounts: updatedAccounts,
          categories: updatedCategories,
        })


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
