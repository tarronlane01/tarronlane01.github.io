/**
 * Single balance recalculation from cache.
 *
 * One process: find base (walk backward from window if needed), chain forward
 * only through months up to and including the latest finalized allocation month.
 * Unfinalized months are not chained (they keep stored start/end). Write each
 * chained month to cache, then add any finalized months after the last chained
 * (from cache) for budget category all-time. So last finalized month's end = all-time.
 *
 * No separate recalc steps; no coordination between hooks. Call this whenever
 * we need to (re)compute balances (e.g. after initial load, after mutations).
 */

import { queryClient, queryKeys } from '@data/queryClient'
import type { BudgetData } from '@data/queries/budget'
import type { MonthQueryData } from '@data/queries/month'
import { readMonth } from '@data/queries/month'
import { recalculateMonth, extractSnapshotFromMonth, EMPTY_SNAPSHOT, type PreviousMonthSnapshot } from './recalculateMonth'
import { getYearMonthOrdinal, getNextMonth, getPreviousMonth, roundCurrency } from '@utils'
import { isNoCategory, isNoAccount } from '@data/constants'
import { MAX_FUTURE_MONTHS } from '@constants'
import type { MonthDocument, AccountsMap, CategoriesMap, MonthMap } from '@types'

function parseOrdinal(ordinal: string): { year: number; month: number } {
  return {
    year: parseInt(ordinal.substring(0, 4), 10),
    month: parseInt(ordinal.substring(4, 6), 10),
  }
}

const hasStartBalance = (m: MonthDocument) =>
  (m.category_balances || []).some(cb => !isNoCategory(cb.category_id) && (cb.start_balance ?? 0) !== 0) ||
  (m.account_balances || []).some(ab => !isNoAccount(ab.account_id) && (ab.start_balance ?? 0) !== 0)

/**
 * Find prevSnapshot for the first month we'll chain: either the earliest month's
 * start_balance (previous month's end), or walk backward until we find a month
 * with start_balance and use its end_balance.
 */
async function findBaseSnapshot(
  budgetId: string,
  monthsInCache: MonthDocument[]
): Promise<PreviousMonthSnapshot> {
  if (monthsInCache.length === 0) return EMPTY_SNAPSHOT
  const earliest = monthsInCache[0]

  if (hasStartBalance(earliest)) {
    const cat: Record<string, number> = {}
    const acc: Record<string, number> = {}
    for (const cb of earliest.category_balances || []) {
      if (!isNoCategory(cb.category_id)) cat[cb.category_id] = roundCurrency(cb.start_balance ?? 0)
    }
    for (const ab of earliest.account_balances || []) {
      if (!isNoAccount(ab.account_id)) acc[ab.account_id] = roundCurrency(ab.start_balance ?? 0)
    }
    return {
      categoryEndBalances: cat,
      accountEndBalances: acc,
      totalIncome: roundCurrency(earliest.previous_month_income ?? 0),
    }
  }

  // Walk backward from earliest month to find a month with start_balance
  let walkYear = earliest.year
  let walkMonth = earliest.month
  const maxWalkBack = 120
  for (let i = 0; i < maxWalkBack; i++) {
    const prev = getPreviousMonth(walkYear, walkMonth)
    walkYear = prev.year
    walkMonth = prev.month
    const prevData = await readMonth(budgetId, walkYear, walkMonth, {
      description: 'recalculateAllBalances: walking backward for start_balance',
    })
    if (!prevData) return EMPTY_SNAPSHOT
    if (hasStartBalance(prevData)) {
      const cat: Record<string, number> = {}
      const acc: Record<string, number> = {}
      for (const cb of prevData.category_balances || []) {
        if (!isNoCategory(cb.category_id)) cat[cb.category_id] = roundCurrency(cb.end_balance ?? 0)
      }
      for (const ab of prevData.account_balances || []) {
        if (!isNoAccount(ab.account_id)) acc[ab.account_id] = roundCurrency(ab.end_balance ?? 0)
      }
      return {
        categoryEndBalances: cat,
        accountEndBalances: acc,
        totalIncome: roundCurrency(prevData.total_income ?? 0),
      }
    }
  }
  return EMPTY_SNAPSHOT
}

/** Last base ordinal (last month we chained) and future ordinals we added for category totals (for debug). */
let lastChainedOrdinalUsed: string | null = null
let lastFutureMonthsAdded: string[] = []

export function getLastRecalcBaseMonthForDebug(): { baseOrdinal: string | null; futureMonthsAdded: string[] } {
  return { baseOrdinal: lastChainedOrdinalUsed, futureMonthsAdded: lastFutureMonthsAdded }
}

export interface RecalculateAllBalancesOptions {
  /**
   * When provided, use this in-memory list for the walk-forward chain instead of reading from cache.
   * Ensures no cache-read race: we chain only from these values and write to cache at the end.
   */
  months?: MonthDocument[]
}

/**
 * Single recalc: chain only through months up to and including the latest
 * finalized allocation month. Unfinalized months are not chained. Uses in-memory
 * values only, then writes chained months to cache. All-time = last chained
 * (finalized) month's end + any later finalized months from cache.
 */
export async function recalculateAllBalancesFromCache(
  budgetId: string,
  options?: RecalculateAllBalancesOptions
): Promise<void> {
  const cachedBudget = queryClient.getQueryData<BudgetData>(queryKeys.budget(budgetId))
  if (!cachedBudget) {
    console.warn('[recalculateAllBalancesFromCache] Budget not in cache')
    return
  }

  const { budget, accounts, categories } = cachedBudget
  const categoryIds = Object.keys(categories)
  const monthMap: MonthMap = cachedBudget.monthMap || {}

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Build all months we have, sorted by date.
  let allMonthsInOrder: MonthDocument[]
  if (options?.months?.length) {
    allMonthsInOrder = [...options.months].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
  } else {
    const sortedOrdinals = Object.keys(monthMap).sort()
    allMonthsInOrder = []
    for (const ordinal of sortedOrdinals) {
      const { year, month } = parseOrdinal(ordinal)
      const data = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, year, month))
      if (data?.month) allMonthsInOrder.push(data.month)
    }
    allMonthsInOrder.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
  }

  // Chain only up to the latest finalized month. Unfinalized months don't need chained start balances.
  const maxFinalizedOrdinal: string | null = (() => {
    for (let i = allMonthsInOrder.length - 1; i >= 0; i--) {
      const m = allMonthsInOrder[i]
      if (m.are_allocations_finalized) return getYearMonthOrdinal(m.year, m.month)
    }
    return null
  })()

  const monthsInOrder =
    maxFinalizedOrdinal != null
      ? allMonthsInOrder.filter(m => getYearMonthOrdinal(m.year, m.month) <= maxFinalizedOrdinal)
      : allMonthsInOrder

  if (monthsInOrder.length === 0) {
    const zeroAccounts: AccountsMap = {}
    const zeroCategories: CategoriesMap = {}
    for (const [id, acc] of Object.entries(accounts)) zeroAccounts[id] = { ...acc, balance: 0 }
    for (const [id, cat] of Object.entries(categories)) zeroCategories[id] = { ...cat, balance: 0 }
    queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
      ...cachedBudget,
      accounts: zeroAccounts,
      categories: zeroCategories,
      budget: { ...budget, accounts: zeroAccounts, categories: zeroCategories },
    })
    lastChainedOrdinalUsed = null
    lastFutureMonthsAdded = []
    return
  }

  let prevSnapshot = await findBaseSnapshot(budgetId, monthsInOrder)

  // Chain forward using only in-memory values; store results in chainedMonths.
  // Track the last finalized month's snapshot so all-time uses only finalized months (never unfinalized).
  const chainedMonths = new Map<string, MonthDocument>()
  let lastChainedOrdinal: string | null = null
  let lastFinalizedSnapshot: PreviousMonthSnapshot = EMPTY_SNAPSHOT
  let lastFinalizedOrdinal: string | null = null
  for (const month of monthsInOrder) {
    const recalculated = recalculateMonth(month, prevSnapshot, month.previous_month_income)
    const ordinal = getYearMonthOrdinal(recalculated.year, recalculated.month)
    chainedMonths.set(ordinal, recalculated)
    prevSnapshot = extractSnapshotFromMonth(recalculated)
    lastChainedOrdinal = ordinal
    if (recalculated.are_allocations_finalized) {
      lastFinalizedSnapshot = prevSnapshot
      lastFinalizedOrdinal = ordinal
    }
  }
  lastChainedOrdinalUsed = lastChainedOrdinal

  // Write chained months to cache so the rest of the session can use precomputed values.
  for (const [, recalculated] of chainedMonths) {
    const monthKey = queryKeys.month(budgetId, recalculated.year, recalculated.month)
    queryClient.setQueryData<MonthQueryData>(monthKey, { month: recalculated })
  }

  // Invalidate chained month queries so subscribers (e.g. useMonthQuery) refetch and re-render
  // with the recalculated data. fetchMonth reads cache first, so refetch returns our data.
  for (const recalculated of chainedMonths.values()) {
    queryClient.invalidateQueries({ queryKey: queryKeys.month(budgetId, recalculated.year, recalculated.month) })
  }

  // Budget category all-time: start from the last FINALIZED month's end (never from unfinalized).
  // That way chaining past unfinalized months cannot add them to all-time.
  const runningCategory: Record<string, number> = { ...lastFinalizedSnapshot.categoryEndBalances }
  for (const id of categoryIds) if (runningCategory[id] === undefined) runningCategory[id] = 0

  const maxFutureOrdinal = getYearMonthOrdinal(
    currentYear + Math.floor((currentMonth + MAX_FUTURE_MONTHS - 1) / 12),
    ((currentMonth + MAX_FUTURE_MONTHS - 1) % 12) + 1
  )
  const afterLastFinalized = lastFinalizedOrdinal ? parseOrdinal(lastFinalizedOrdinal) : { year: currentYear, month: currentMonth }
  let walkYear = getNextMonth(afterLastFinalized.year, afterLastFinalized.month).year
  let walkMonth = getNextMonth(afterLastFinalized.year, afterLastFinalized.month).month
  const futureAdded: string[] = []
  for (let i = 0; i < MAX_FUTURE_MONTHS * 2; i++) {
    const ordinal = getYearMonthOrdinal(walkYear, walkMonth)
    if (ordinal > maxFutureOrdinal || !(ordinal in monthMap)) break
    const monthData = queryClient.getQueryData<MonthQueryData>(queryKeys.month(budgetId, walkYear, walkMonth))
    const m = monthData?.month
    if (!m) break
    // Only add allocations and expenses from finalized months to all-time.
    if (m.are_allocations_finalized) {
      if (m.category_balances) {
        futureAdded.push(ordinal)
        for (const cb of m.category_balances) {
          if (categoryIds.includes(cb.category_id)) runningCategory[cb.category_id] = (runningCategory[cb.category_id] ?? 0) + (cb.allocated ?? 0)
        }
      }
      if (m.expenses) {
        for (const exp of m.expenses) {
          if (categoryIds.includes(exp.category_id)) runningCategory[exp.category_id] = (runningCategory[exp.category_id] ?? 0) - exp.amount
        }
      }
    }
    const next = getNextMonth(walkYear, walkMonth)
    walkYear = next.year
    walkMonth = next.month
  }
  lastFutureMonthsAdded = futureAdded

  const updatedAccounts: AccountsMap = {}
  for (const [accId, acc] of Object.entries(accounts)) {
    updatedAccounts[accId] = { ...acc, balance: roundCurrency(lastFinalizedSnapshot.accountEndBalances[accId] ?? 0) }
  }
  const updatedCategories: CategoriesMap = {}
  for (const [catId, cat] of Object.entries(categories)) {
    updatedCategories[catId] = { ...cat, balance: roundCurrency(runningCategory[catId] ?? 0) }
  }

  queryClient.setQueryData<BudgetData>(queryKeys.budget(budgetId), {
    ...cachedBudget,
    accounts: updatedAccounts,
    categories: updatedCategories,
    budget: { ...budget, accounts: updatedAccounts, categories: updatedCategories },
  })
}
