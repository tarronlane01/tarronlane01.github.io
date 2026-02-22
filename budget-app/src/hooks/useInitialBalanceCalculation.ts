/**
 * Initial Balance Calculation Hook
 *
 * After initial data load (same component that populates the cache):
 * 1. Run the single recalc so February etc. get start_balance from Jan end_balance (one write per month).
 * 2. Merge loaded months into the budget's month_map and save to Firestore if changed.
 * 3. Set initialBalanceCalculationComplete when done.
 *
 * Running recalc here guarantees it runs after the cache has been populated with months,
 * so February is in cache and gets chained/written with correct start values.
 */

import { useEffect, useRef } from 'react'
import { useApp } from '@contexts'
import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import { recalculateAllBalancesFromCache } from '@data/recalculation'
import { getYearMonthOrdinal } from '@utils'
import { bannerQueue } from '@components/ui'
import type { MonthDocument, MonthMap } from '@types'

interface UseInitialBalanceCalculationParams {
  budgetId: string | null
  enabled: boolean
  initialDataLoadComplete: boolean
  months: MonthDocument[]
  setInitialBalanceCalculationComplete: (value: boolean) => void
}

export function useInitialBalanceCalculation({
  budgetId,
  enabled,
  initialDataLoadComplete,
  months,
  setInitialBalanceCalculationComplete,
}: UseInitialBalanceCalculationParams) {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const hasCalculatedRef = useRef(false)
  const lastBudgetIdRef = useRef<string | null>(null)
  const lastInitialDataLoadCompleteRef = useRef(false)

  useEffect(() => {
    // Reset hasCalculatedRef when budgetId changes (do this FIRST, before any early returns)
    // This handles direct budget switches (A -> B) where budgetId never becomes null
    if (budgetId !== lastBudgetIdRef.current) {
      hasCalculatedRef.current = false
      lastBudgetIdRef.current = budgetId
    }

    // Reset hasCalculatedRef when initialDataLoadComplete transitions from false to true
    // This handles cache clears for the SAME budget (e.g., after updating sample budget)
    if (initialDataLoadComplete && !lastInitialDataLoadCompleteRef.current) {
      hasCalculatedRef.current = false
    }
    lastInitialDataLoadCompleteRef.current = initialDataLoadComplete

    if (!enabled || !budgetId || !initialDataLoadComplete || hasCalculatedRef.current) {
      return
    }
    if (months.length === 0) {
      // DEBUG: Log when skipping due to no months - remove after fixing bug
      setInitialBalanceCalculationComplete(true)
      return
    }

    hasCalculatedRef.current = true

    const run = async () => {
      try {
        addLoadingHold('initial-balance-calculation', 'Calculating balances...')

        // Run single recalc using in-memory months so Feb (and all months) get start_balance from previous month's end.
        // Pass months so recalc uses only memory and writes to cache at the end — no cache-read race.
        await recalculateAllBalancesFromCache(budgetId, { months })

        const budgetData = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
        if (!budgetData) {
          setInitialBalanceCalculationComplete(true)
          return
        }

        const { budget } = budgetData
        const monthMap: MonthMap = budget.month_map || {}
        const updatedMonthMap: MonthMap = { ...monthMap }
        for (const m of months) {
          const ordinal = getYearMonthOrdinal(m.year, m.month)
          if (!(ordinal in updatedMonthMap)) updatedMonthMap[ordinal] = {}
        }

        const monthMapChanged = JSON.stringify(monthMap) !== JSON.stringify(updatedMonthMap)
        if (monthMapChanged) {
          removeLoadingHold('initial-balance-calculation')
          addLoadingHold('initial-balance-calculation', 'Saving month map...')
          const { writeBudgetData } = await import('@data/mutations/budget/writeBudgetData')
          await writeBudgetData({
            budgetId,
            updates: { month_map: updatedMonthMap },
            description: 'initial balance calculation: updating month_map',
          })
          queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
            ...budgetData,
            budget: { ...budget, month_map: updatedMonthMap },
            monthMap: updatedMonthMap,
          })
        }
      } catch (error) {
        console.error('[useInitialBalanceCalculation] Error:', error)
        bannerQueue.add({
          type: 'error',
          message: `Initial balance calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          autoDismissMs: 10000,
        })
      } finally {
        removeLoadingHold('initial-balance-calculation')
        setInitialBalanceCalculationComplete(true)
      }
    }

    run()
  }, [enabled, budgetId, initialDataLoadComplete, months, addLoadingHold, removeLoadingHold, setInitialBalanceCalculationComplete])
}
