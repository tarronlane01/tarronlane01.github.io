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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { queryKeys } from '../queryClient'
import type {
  MonthDocument,
  IncomeTransaction,
  ExpenseTransaction,
  CategoryAllocation,
  CategoryMonthBalance,
  PreviousMonthSnapshot,
} from '../../types/budget'
import { getMonthDocId } from '../../utils/budgetHelpers'

/**
 * Parse raw Firestore month data into typed MonthDocument
 */
function parseMonthData(data: any, budgetId: string, year: number, month: number): MonthDocument {
  const income: IncomeTransaction[] = (data.income || []).map((inc: any) => ({
    id: inc.id,
    amount: inc.amount,
    account_id: inc.account_id,
    date: inc.date,
    payee: inc.payee,
    description: inc.description,
    created_at: inc.created_at,
  }))

  const expenses: ExpenseTransaction[] = (data.expenses || []).map((exp: any) => ({
    id: exp.id,
    amount: exp.amount,
    category_id: exp.category_id,
    account_id: exp.account_id,
    date: exp.date,
    payee: exp.payee,
    description: exp.description,
    created_at: exp.created_at,
  }))

  const allocations: CategoryAllocation[] = (data.allocations || []).map((alloc: any) => ({
    category_id: alloc.category_id,
    amount: alloc.amount,
  }))

  const categoryBalances: CategoryMonthBalance[] = (data.category_balances || []).map((bal: any) => ({
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
    snapshot_stale: data.snapshot_stale ?? false,
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
    total_income: monthDoc.total_income,
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
 * @param queryClient - Query client for cache access
 */
async function fetchMonth(
  budgetId: string,
  year: number,
  month: number,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<MonthDocument> {
  const db = getFirestore(app)
  const monthDocId = getMonthDocId(budgetId, year, month)
  const monthDocRef = doc(db, 'months', monthDocId)

  const monthDoc = await getDoc(monthDocRef)

  if (monthDoc.exists()) {
    const parsedMonth = parseMonthData(monthDoc.data(), budgetId, year, month)

    // Check if snapshot needs reconciliation
    const needsReconciliation = parsedMonth.snapshot_stale === true ||
      (parsedMonth.previous_month_snapshot === undefined && month !== 1) // January doesn't need prev month

    if (needsReconciliation) {
      const reconciledMonth = await reconcileSnapshot(
        db,
        budgetId,
        year,
        month,
        parsedMonth,
        monthDocRef,
        queryClient
      )
      return reconciledMonth
    }

    return parsedMonth
  }

  // Create new month document with snapshot pre-populated
  const newMonth = await createNewMonthWithSnapshot(
    db,
    budgetId,
    year,
    month,
    monthDocRef,
    queryClient
  )

  return newMonth
}

/**
 * Reconcile a stale or missing snapshot
 *
 * @returns Updated month document with fresh snapshot
 */
async function reconcileSnapshot(
  db: ReturnType<typeof getFirestore>,
  budgetId: string,
  year: number,
  month: number,
  currentMonth: MonthDocument,
  monthDocRef: ReturnType<typeof doc>,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<MonthDocument> {
  const { prevYear, prevMonth } = getPreviousMonthInfo(year, month)

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
    const prevMonthDocRef = doc(db, 'months', prevMonthDocId)
    const prevMonthDoc = await getDoc(prevMonthDocRef)

    if (prevMonthDoc.exists()) {
      prevMonthData = parseMonthData(prevMonthDoc.data(), budgetId, prevYear, prevMonth)
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
    snapshot_stale: false,
    updated_at: new Date().toISOString(),
  }

  // Write to Firestore (1 write)
  await setDoc(monthDocRef, {
    budget_id: updatedMonth.budget_id,
    year: updatedMonth.year,
    month: updatedMonth.month,
    income: updatedMonth.income,
    total_income: updatedMonth.total_income,
    expenses: updatedMonth.expenses,
    total_expenses: updatedMonth.total_expenses,
    allocations: updatedMonth.allocations,
    allocations_finalized: updatedMonth.allocations_finalized,
    category_balances: updatedMonth.category_balances,
    account_balances_start: updatedMonth.account_balances_start,
    account_balances_end: updatedMonth.account_balances_end,
    previous_month_snapshot: newSnapshot,
    snapshot_stale: false,
    created_at: updatedMonth.created_at,
    updated_at: updatedMonth.updated_at,
  })

  return updatedMonth
}

/**
 * Create a new month document with snapshot pre-populated from previous month
 */
async function createNewMonthWithSnapshot(
  db: ReturnType<typeof getFirestore>,
  budgetId: string,
  year: number,
  month: number,
  monthDocRef: ReturnType<typeof doc>,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<MonthDocument> {
  const now = new Date().toISOString()
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
      const prevMonthDocRef = doc(db, 'months', prevMonthDocId)
      const prevMonthDoc = await getDoc(prevMonthDocRef)

      if (prevMonthDoc.exists()) {
        const prevMonthData = parseMonthData(prevMonthDoc.data(), budgetId, prevYear, prevMonth)
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
    snapshot_stale: false,
    created_at: now,
    updated_at: now,
  }

  // Build clean document for Firestore
  const docToWrite: Record<string, any> = {
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
    snapshot_stale: false,
    created_at: now,
    updated_at: now,
  }

  if (snapshot) {
    docToWrite.previous_month_snapshot = snapshot
  }

  await setDoc(monthDocRef, docToWrite)
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
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: budgetId ? queryKeys.month(budgetId, year, month) : ['month', 'none'],
    queryFn: async (): Promise<MonthQueryData> => {
      const monthData = await fetchMonth(budgetId!, year, month, queryClient)
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
  queryClient: ReturnType<typeof useQueryClient>,
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

  if (cachedNextMonth && !cachedNextMonth.month.snapshot_stale) {
    queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
      month: {
        ...cachedNextMonth.month,
        snapshot_stale: true,
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
  month: number,
  queryClient: ReturnType<typeof useQueryClient>
): Promise<void> {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }

  const db = getFirestore(app)
  const nextMonthDocId = getMonthDocId(budgetId, nextYear, nextMonth)
  const nextMonthDocRef = doc(db, 'months', nextMonthDocId)

  // Check if next month exists and if it's already marked stale
  const nextMonthDoc = await getDoc(nextMonthDocRef)

  if (nextMonthDoc.exists()) {
    const data = nextMonthDoc.data()
    // Only write if not already stale (avoid double writes)
    if (!data.snapshot_stale) {
      await setDoc(nextMonthDocRef, {
        ...data,
        snapshot_stale: true,
        updated_at: new Date().toISOString(),
      })

      // Also update cache
      const nextMonthKey = queryKeys.month(budgetId, nextYear, nextMonth)
      const cachedNextMonth = queryClient.getQueryData<MonthQueryData>(nextMonthKey)
      if (cachedNextMonth) {
        queryClient.setQueryData<MonthQueryData>(nextMonthKey, {
          month: {
            ...cachedNextMonth.month,
            snapshot_stale: true,
          },
        })
      }
    }
  }
  // If next month doesn't exist yet, no need to mark stale
  // It will get a fresh snapshot when created
}
