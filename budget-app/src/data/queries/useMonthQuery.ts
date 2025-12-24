/**
 * Month Query Hook
 *
 * Fetches the month-level document containing all month-specific data:
 * - Income transactions
 * - Expense transactions
 * - Category allocations
 * - Category balances
 * - Finalization status
 * - Previous month snapshot (for cross-month calculations)
 *
 * This document is the atomic snapshot for a budget month.
 * Exactly one read per month view (except when reconciling stale snapshots).
 *
 * CROSS-MONTH PATTERN:
 * - Each month stores a snapshot of the previous month's relevant data
 * - Months never read from other month documents during normal rendering
 * - If snapshot is stale or missing, it's reconciled on first view
 */

import { useQuery } from '@tanstack/react-query'
import { queryClient, queryKeys } from '../queryClient'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  CategoryAllocation,
  CategoryMonthBalance,
  PreviousMonthSnapshot,
} from '../../types/budget'
import { getMonthDocId, readDoc, writeDoc, type FirestoreData } from '../firestore/operations'

/**
 * Parse raw Firestore month data into typed MonthDocument
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  const income: IncomeTransaction[] = (data.income || []).map((inc: FirestoreData) => ({
    id: inc.id,
    amount: inc.amount,
    account_id: inc.account_id,
    date: inc.date,
    payee: inc.payee,
    description: inc.description,
    created_at: inc.created_at,
  }))

  const expenses: ExpenseTransaction[] = (data.expenses || []).map((exp: FirestoreData) => ({
    id: exp.id,
    amount: exp.amount,
    category_id: exp.category_id,
    account_id: exp.account_id,
    date: exp.date,
    payee: exp.payee,
    description: exp.description,
    created_at: exp.created_at,
  }))

  const allocations: CategoryAllocation[] = (data.allocations || []).map((alloc: FirestoreData) => ({
    category_id: alloc.category_id,
    amount: alloc.amount,
  }))

  const categoryBalances: CategoryMonthBalance[] = (data.category_balances || []).map((bal: FirestoreData) => ({
    category_id: bal.category_id,
    start_balance: bal.start_balance,
    allocated: bal.allocated,
    spent: bal.spent,
    end_balance: bal.end_balance,
  }))

  // Parse previous month snapshot if exists
  let previousMonthSnapshot: PreviousMonthSnapshot | undefined
  if (data.previous_month_snapshot) {
    previousMonthSnapshot = {
      total_income: data.previous_month_snapshot.total_income ?? 0,
      account_balances_end: data.previous_month_snapshot.account_balances_end ?? {},
      category_balances_end: data.previous_month_snapshot.category_balances_end ?? {},
      snapshot_taken_at: data.previous_month_snapshot.snapshot_taken_at,
    }
  }

  return {
    budget_id: budgetId,
    year,
    month,
    income,
    total_income: data.total_income ?? income.reduce((sum, inc) => sum + inc.amount, 0),
    expenses,
    total_expenses: data.total_expenses ?? expenses.reduce((sum, exp) => sum + exp.amount, 0),
    allocations,
    allocations_finalized: data.allocations_finalized || false,
    account_balances_start: data.account_balances_start,
    account_balances_end: data.account_balances_end,
    category_balances: categoryBalances,
    previous_month_snapshot: previousMonthSnapshot,
    previous_month_snapshot_stale: data.previous_month_snapshot_stale ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  }
}

/**
 * Calculate previous month's year and month number
 */
function getPreviousMonthInfo(year: number, month: number): { prevYear: number; prevMonth: number } {
  let prevYear = year
  let prevMonth = month - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear -= 1
  }
  return { prevYear, prevMonth }
}

/**
 * Build a snapshot from a month document
 */
function buildSnapshotFromMonth(monthDoc: MonthDocument): PreviousMonthSnapshot {
  // Build category balances end from the month's category_balances
  const categoryBalancesEnd: Record<string, number> = {}
  if (monthDoc.category_balances) {
    monthDoc.category_balances.forEach(bal => {
      categoryBalancesEnd[bal.category_id] = bal.end_balance
    })
  }

  return {
    total_income: monthDoc.total_income ?? 0,
    account_balances_end: monthDoc.account_balances_end ?? {},
    category_balances_end: categoryBalancesEnd,
    snapshot_taken_at: new Date().toISOString(),
  }
}

/**
 * Fetch month document from Firestore
 * Creates the document if it doesn't exist
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 */
async function fetchMonth(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthDocument> {
  const monthDocId = getMonthDocId(budgetId, year, month)

  const { exists, data: monthData } = await readDoc<FirestoreData>(
    'months',
    monthDocId,
    'loading month document (cache miss or stale)'
  )

  if (exists && monthData) {
    const parsedMonth = parseMonthData(monthData, budgetId, year, month)

    // Check if snapshot needs reconciliation
    const needsReconciliation = parsedMonth.previous_month_snapshot_stale === true ||
      (parsedMonth.previous_month_snapshot === undefined && month !== 1) // January doesn't need prev month

    if (needsReconciliation) {
      const reconciledMonth = await reconcileSnapshot(
        budgetId,
        year,
        month,
        parsedMonth
      )
      return reconciledMonth
    }

    return parsedMonth
  }

  // Create new month document with snapshot pre-populated
  const newMonth = await createNewMonthWithSnapshot(
    budgetId,
    year,
    month
  )

  return newMonth
}

/**
 * Reconcile a stale or missing snapshot
 *
 * @returns Updated month document with fresh snapshot
 */
async function reconcileSnapshot(
  budgetId: string,
  year: number,
  month: number,
  currentMonth: MonthDocument
): Promise<MonthDocument> {
  const { prevYear, prevMonth } = getPreviousMonthInfo(year, month)
  const monthDocId = getMonthDocId(budgetId, year, month)

  // Try to get previous month from cache first (0 reads)
  let prevMonthData: MonthDocument | null = null
  const cachedPrevMonth = queryClient.getQueryData<MonthQueryData>(
    queryKeys.month(budgetId, prevYear, prevMonth)
  )

  if (cachedPrevMonth) {
    prevMonthData = cachedPrevMonth.month
  } else {
    // Not in cache, fetch from Firestore (1 read - acceptable for reconciliation)
    const prevMonthDocId = getMonthDocId(budgetId, prevYear, prevMonth)
    const { exists, data: prevData } = await readDoc<FirestoreData>(
      'months',
      prevMonthDocId,
      'fetching previous month to rebuild stale snapshot (not in cache)'
    )

    if (exists && prevData) {
      prevMonthData = parseMonthData(prevData, budgetId, prevYear, prevMonth)
      // Cache this for future use
      queryClient.setQueryData<MonthQueryData>(
        queryKeys.month(budgetId, prevYear, prevMonth),
        { month: prevMonthData }
      )
    }
  }

  // Build new snapshot
  const newSnapshot: PreviousMonthSnapshot = prevMonthData
    ? buildSnapshotFromMonth(prevMonthData)
    : {
        total_income: 0,
        account_balances_end: {},
        category_balances_end: {},
        snapshot_taken_at: new Date().toISOString(),
      }

  // Update current month with new snapshot and clear stale flag
  const updatedMonth: MonthDocument = {
    ...currentMonth,
    previous_month_snapshot: newSnapshot,
    previous_month_snapshot_stale: false,
    updated_at: new Date().toISOString(),
  }

  // Write to Firestore (1 write)
  // Build document and strip undefined values (Firestore doesn't allow undefined)
  const docToWrite: FirestoreData = {
    budget_id: updatedMonth.budget_id,
    year: updatedMonth.year,
    month: updatedMonth.month,
    income: updatedMonth.income ?? [],
    total_income: updatedMonth.total_income ?? 0,
    expenses: updatedMonth.expenses ?? [],
    total_expenses: updatedMonth.total_expenses ?? 0,
    allocations: updatedMonth.allocations ?? [],
    allocations_finalized: updatedMonth.allocations_finalized ?? false,
    category_balances: updatedMonth.category_balances ?? [],
    previous_month_snapshot: newSnapshot,
    previous_month_snapshot_stale: false,
    created_at: updatedMonth.created_at ?? new Date().toISOString(),
    updated_at: updatedMonth.updated_at,
  }
  // Only include optional fields if they exist
  if (updatedMonth.account_balances_start !== undefined) {
    docToWrite.account_balances_start = updatedMonth.account_balances_start
  }
  if (updatedMonth.account_balances_end !== undefined) {
    docToWrite.account_balances_end = updatedMonth.account_balances_end
  }
  await writeDoc(
    'months',
    monthDocId,
    docToWrite,
    'saving month with fresh snapshot rebuilt from previous month'
  )

  return updatedMonth
}

/**
 * Create a new month document with snapshot pre-populated from previous month
 */
async function createNewMonthWithSnapshot(
  budgetId: string,
  year: number,
  month: number
): Promise<MonthDocument> {
  const now = new Date().toISOString()
  const monthDocId = getMonthDocId(budgetId, year, month)
  let snapshot: PreviousMonthSnapshot | undefined

  // For months after January, get previous month snapshot
  if (month > 1 || year > new Date().getFullYear() - 10) {
    const { prevYear, prevMonth } = getPreviousMonthInfo(year, month)

    // Try cache first
    const cachedPrevMonth = queryClient.getQueryData<MonthQueryData>(
      queryKeys.month(budgetId, prevYear, prevMonth)
    )

    if (cachedPrevMonth) {
      snapshot = buildSnapshotFromMonth(cachedPrevMonth.month)
    } else {
      // Fetch previous month if not cached (1 read - one time for new month creation)
      const prevMonthDocId = getMonthDocId(budgetId, prevYear, prevMonth)
      const { exists, data: prevData } = await readDoc<FirestoreData>(
        'months',
        prevMonthDocId,
        'fetching previous month to create snapshot for new month (not in cache)'
      )

      if (exists && prevData) {
        const prevMonthData = parseMonthData(prevData, budgetId, prevYear, prevMonth)
        snapshot = buildSnapshotFromMonth(prevMonthData)
        // Cache the previous month
        queryClient.setQueryData<MonthQueryData>(
          queryKeys.month(budgetId, prevYear, prevMonth),
          { month: prevMonthData }
        )
      }
    }
  }

  const newMonth: MonthDocument = {
    budget_id: budgetId,
    year,
    month,
    income: [],
    total_income: 0,
    expenses: [],
    total_expenses: 0,
    allocations: [],
    allocations_finalized: false,
    category_balances: [],
    previous_month_snapshot: snapshot,
    previous_month_snapshot_stale: false,
    created_at: now,
    updated_at: now,
  }

  // Build clean document for Firestore
  const docToWrite: FirestoreData = {
    budget_id: budgetId,
    year,
    month,
    income: [],
    total_income: 0,
    expenses: [],
    total_expenses: 0,
    allocations: [],
    allocations_finalized: false,
    category_balances: [],
    previous_month_snapshot_stale: false,
    created_at: now,
    updated_at: now,
  }

  if (snapshot) {
    docToWrite.previous_month_snapshot = snapshot
  }

  await writeDoc(
    'months',
    monthDocId,
    docToWrite,
    'creating new month document (first time viewing this month)'
  )
  return newMonth
}

/**
 * Extended month data returned by the query
 */
export interface MonthQueryData {
  month: MonthDocument
}

/**
 * Query hook for month-level document
 *
 * Returns the complete month data including income, expenses, allocations,
 * and the previous month snapshot for cross-month calculations.
 *
 * READS:
 * - Normal month view: 1 read (month document)
 * - Stale/missing snapshot (prev in cache): 1 read + 1 write
 * - Stale/missing snapshot (prev not cached): 2 reads + 1 write
 * - Creating new month (prev cached): 1 write
 * - Creating new month (prev not cached): 1 read + 1 write
 *
 * @param budgetId - The budget ID
 * @param year - The year
 * @param month - The month (1-12)
 * @param options - Additional query options
 */
export function useMonthQuery(
  budgetId: string | null,
  year: number,
  month: number,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? queryKeys.month(budgetId, year, month) : ['month', 'none'],
    queryFn: async (): Promise<MonthQueryData> => {
      const monthData = await fetchMonth(budgetId!, year, month)
      return { month: monthData }
    },
    enabled: !!budgetId && (options?.enabled !== false),
  })
}

/**
 * Helper to mark a month's snapshot as stale in cache only
 * Call this when editing a month that affects the next month's snapshot
 */
export function markNextMonthSnapshotStaleInCache(
  budgetId: string,
  year: number,
  month: number
) {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthKey = queryKeys.month(budgetId, nextYear, nextMonth)
  const cachedNextMonth = queryClient.getQueryData<MonthQueryData>(nextMonthKey)

  if (cachedNextMonth && !cachedNextMonth.month.previous_month_snapshot_stale) {
    queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
      month: {
        ...cachedNextMonth.month,
        previous_month_snapshot_stale: true,
      },
    })
  }
}

/**
 * Helper to mark next month as stale in Firestore (only if not already stale)
 * This is called once when the first edit to a month happens,
 * NOT on every subsequent edit.
 */
export async function markNextMonthSnapshotStaleInFirestore(
  budgetId: string,
  year: number,
  month: number
): Promise<void> {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const nextMonthDocId = getMonthDocId(budgetId, nextYear, nextMonth)

  // Check if next month exists and if it's already marked stale
  const { exists, data } = await readDoc<FirestoreData>(
    'months',
    nextMonthDocId,
    'checking if next month exists to mark its snapshot stale'
  )

  if (exists && data) {
    // Only write if not already stale (avoid double writes)
    if (!data.previous_month_snapshot_stale) {
      await writeDoc(
        'months',
        nextMonthDocId,
        {
          ...data,
          previous_month_snapshot_stale: true,
          updated_at: new Date().toISOString(),
        },
        'marking next month snapshot as stale (previous month was edited)'
      )

      // Also update cache
      const nextMonthKey = queryKeys.month(budgetId, nextYear, nextMonth)
      const cachedNextMonth = queryClient.getQueryData<MonthQueryData>(nextMonthKey)
      if (cachedNextMonth) {
        queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
          month: {
            ...cachedNextMonth.month,
            previous_month_snapshot_stale: true,
          },
        })
      }
    }
  }
  // If next month doesn't exist yet, no need to mark stale
  // It will get a fresh snapshot when created
}
