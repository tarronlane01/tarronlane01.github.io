/**
 * Initial Data Load Hook
 *
 * Loads and caches initial data on app load:
 * - Last 3 months, current month, and all future months
 * - Budget document
 * - Payees document
 *
 * Uses efficient Firebase queries to minimize reads.
 */

import { useRef, useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBudget } from '@data/queries/budget/fetchBudget'
import { fetchPayees } from '@data/queries/payees/fetchPayees'
// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import { getYearMonthOrdinal, getMonthsBack, roundCurrency } from '@utils'
import type { MonthDocument, FirestoreData } from '@types'
import { determineMonthsToLoad } from './initialDataLoadRange'
import { parseMonthData } from './initialDataLoadParse'
import { ensureLastFinalizedMonthLoaded } from './ensureLastFinalizedMonth'

// ============================================================================
// TYPES
// ============================================================================

interface InitialDataLoadResult {
  budget: Awaited<ReturnType<typeof fetchBudget>>
  payees: string[]
  months: MonthDocument[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch months for initial load.
 * 
 * Uses smart loading:
 * - If reference month provided (from URL), load around that month ± 1
 * - If months exist in the on-the-fly window (current ± 3), load that window
 * - If no months in window (historical budget), load around the latest month ± 1
 */
async function fetchInitialMonths(
  budgetId: string,
  monthMap: Record<string, unknown>,
  referenceMonth?: { year: number; month: number }
): Promise<MonthDocument[]> {
  const range = determineMonthsToLoad(monthMap, referenceMonth)
  if (!range) return []

  // Query months within the determined range
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    'useInitialDataLoad: loading initial months',
    [
      { field: 'budget_id', op: '==', value: budgetId },
      { field: 'year_month_ordinal', op: '>=', value: range.minOrdinal },
      { field: 'year_month_ordinal', op: '<=', value: range.maxOrdinal },
    ]
  )

  // Parse and sort months chronologically
  const months: MonthDocument[] = monthsResult.docs
    .map(doc => {
      const data = doc.data
      const year = data.year as number
      const month = data.month as number
      return parseMonthData(data, budgetId, year, month)
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  return months
}

/**
 * Compute previous_month_income for each month using income from N months back (per budget setting).
 * Uses only the months we already have—no extra Firestore reads.
 */
function applyPreviousMonthIncome(
  months: MonthDocument[],
  monthsBack: number
): MonthDocument[] {
  if (monthsBack < 1) return months
  const byKey = new Map<string, MonthDocument>()
  for (const m of months) {
    byKey.set(`${m.year}/${m.month}`, m)
  }
  return months.map(month => {
    const target = getMonthsBack(month.year, month.month, monthsBack)
    if (!target) return month
    const targetMonth = byKey.get(`${target.year}/${target.month}`)
    if (!targetMonth) return month
    const income = targetMonth.income || []
    const value = roundCurrency(income.reduce((sum, inc) => sum + (inc.amount || 0), 0))
    return { ...month, previous_month_income: value }
  })
}

/**
 * Fetch all initial data.
 * 
 * First fetches budget to get month_map, then intelligently loads months
 * based on the reference month or the on-the-fly window.
 * 
 * Also ensures:
 * 1. The last finalized month is always loaded (for ALL-TIME balance calculation)
 * 2. All months between the last finalized and the reference month are loaded
 * 3. The month that is `percentage_income_months_back` before the earliest loaded
 *    month is loaded (for percentage-based allocation calculations)
 * 
 * @param budgetId - Budget to load
 * @param referenceMonth - Optional month to load around (e.g., from URL)
 */
async function fetchInitialData(
  budgetId: string,
  referenceMonth?: { year: number; month: number }
): Promise<InitialDataLoadResult> {
  // First fetch budget and payees in parallel
  const [budget, payees] = await Promise.all([
    fetchBudget(budgetId),
    fetchPayees(budgetId),
  ])

  // Now fetch months using the budget's month_map to determine which to load
  let months = await fetchInitialMonths(budgetId, budget.monthMap || {}, referenceMonth)

  // CRITICAL: Ensure we always have the last finalized month loaded
  // This is needed to calculate ALL-TIME balances correctly
  months = await ensureLastFinalizedMonthLoaded(budgetId, months, budget.monthMap || {})

  const monthsBack = budget.budget.percentage_income_months_back ?? 1

  // If we have months and monthsBack > 0, ensure we have the month needed for 
  // percentage-based allocation calculations (monthsBack months before earliest loaded)
  if (months.length > 0 && monthsBack > 0) {
    // Find earliest loaded month
    const earliest = months.reduce((min, m) => {
      const mOrdinal = m.year * 100 + m.month
      const minOrdinal = min.year * 100 + min.month
      return mOrdinal < minOrdinal ? m : min
    })

    // Calculate month that's monthsBack before earliest
    const targetMonth = getMonthsBack(earliest.year, earliest.month, monthsBack)
    if (targetMonth) {
      // Check if we already have it
      const alreadyHave = months.some(m => m.year === targetMonth.year && m.month === targetMonth.month)
      if (!alreadyHave) {
        // Check if it exists in month_map
        const targetOrdinal = getYearMonthOrdinal(targetMonth.year, targetMonth.month)
        if (budget.monthMap && targetOrdinal in budget.monthMap) {
          // Fetch just this month
          const extraMonths = await fetchInitialMonths(
            budgetId,
            { [targetOrdinal]: {} },
            { year: targetMonth.year, month: targetMonth.month }
          )
          if (extraMonths.length > 0) {
            months = [...extraMonths, ...months]
          }
        }
      }
    }
  }

  const monthsWithIncome = applyPreviousMonthIncome(months, monthsBack)

  return {
    budget,
    payees,
    months: monthsWithIncome,
  }
}

// ============================================================================
// HOOK
// ============================================================================

interface UseInitialDataLoadOptions {
  enabled?: boolean
  /** 
   * Reference month to load around (e.g., from URL).
   * If provided, loads this month ± 1 regardless of on-the-fly window.
   * If not provided, uses on-the-fly window or budget's latest month.
   */
  referenceMonth?: { year: number; month: number }
}

/**
 * Hook for loading initial data on app start.
 * Loads budget, payees, and months intelligently based on reference month.
 *
 * @param budgetId - The budget ID to load data for
 * @param options - Query options including optional reference month
 */
export function useInitialDataLoad(
  budgetId: string | null,
  options?: UseInitialDataLoadOptions
) {
  const { enabled, referenceMonth } = options || {}
  
  // Track the reference month per budget - update when budget changes
  // This allows month navigation to not re-trigger initial load (same budget),
  // but budget switches get the fresh reference month
  const initialReferenceMonth = useRef(referenceMonth)
  const lastBudgetIdRef = useRef<string | null>(null)
  
  // Update reference month when budget changes (must run in effect to avoid ref access during render)
  useLayoutEffect(() => {
    if (budgetId !== lastBudgetIdRef.current) {
      initialReferenceMonth.current = referenceMonth
      lastBudgetIdRef.current = budgetId
    }
  }, [budgetId, referenceMonth])
  
  // Query key is only based on budgetId - initial load runs once per budget
  const queryKey = budgetId 
    ? ['initialDataLoad', budgetId] 
    : ['initialDataLoad', 'none']

  return useQuery({
    queryKey,
    queryFn: () => fetchInitialData(budgetId!, initialReferenceMonth.current),
    enabled: !!budgetId && (enabled !== false),
    staleTime: Infinity, // Initial load data is considered fresh until explicitly invalidated
  })
}

