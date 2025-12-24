/**
 * Helper Functions for Month Mutations
 *
 * Shared utilities used across income, expense, and allocation mutations.
 */

import type { MonthDocument, AccountsMap } from '../../types/budget'
import {
  getMonthDocId,
  cleanIncomeForFirestore,
  cleanExpensesForFirestore,
  cleanAllocationsForFirestore,
  cleanCategoryBalancesForFirestore,
  cleanAccountsForFirestore,
  writeDoc,
  readDoc,
  type FirestoreData,
} from '../firestore/operations'
import { markNextMonthSnapshotStaleInFirestore } from '../queries/useMonthQuery'
import { queryClient, queryKeys } from '../queryClient'
import type { BudgetData } from '../queries/useBudgetQuery'

/**
 * Save month document to Firestore AND automatically mark next month as stale.
 *
 * CROSS-MONTH PATTERN:
 * Any change to a month potentially affects the next month's snapshot.
 * This function centralizes both operations so we never forget to mark stale.
 *
 * The stale flag is only written to Firestore if not already stale (avoids duplicate writes).
 */
export async function saveMonthToFirestore(
  budgetId: string,
  month: MonthDocument
) {
  const monthDocId = getMonthDocId(budgetId, month.year, month.month)

  const cleanedMonth: FirestoreData = {
    budget_id: month.budget_id,
    year: month.year,
    month: month.month,
    income: cleanIncomeForFirestore(month.income),
    total_income: month.total_income,
    updated_at: new Date().toISOString(),
  }

  if (month.created_at) cleanedMonth.created_at = month.created_at
  if (month.expenses) cleanedMonth.expenses = cleanExpensesForFirestore(month.expenses)
  if (month.total_expenses !== undefined) cleanedMonth.total_expenses = month.total_expenses
  if (month.allocations) cleanedMonth.allocations = cleanAllocationsForFirestore(month.allocations)
  if (month.allocations_finalized !== undefined) cleanedMonth.allocations_finalized = month.allocations_finalized
  if (month.category_balances) cleanedMonth.category_balances = cleanCategoryBalancesForFirestore(month.category_balances)
  if (month.account_balances_start) cleanedMonth.account_balances_start = month.account_balances_start
  if (month.account_balances_end) cleanedMonth.account_balances_end = month.account_balances_end
  if (month.previous_month_snapshot) cleanedMonth.previous_month_snapshot = month.previous_month_snapshot
  if (month.previous_month_snapshot_stale !== undefined) cleanedMonth.previous_month_snapshot_stale = month.previous_month_snapshot_stale

  // Save the month document
  await writeDoc(
    'months',
    monthDocId,
    cleanedMonth,
    'saveMonthToFirestore: saving month document after mutation'
  )

  // CROSS-MONTH: Mark next month as stale (only writes to Firestore if not already stale)
  await markNextMonthSnapshotStaleInFirestore(budgetId, month.year, month.month)
}

/**
 * Update account balance in budget document and return updated accounts
 */
export async function updateAccountBalance(
  budgetId: string,
  accountId: string,
  delta: number
): Promise<AccountsMap | null> {
  const { exists, data } = await readDoc<FirestoreData>(
    'budgets',
    budgetId,
    `reading budget to update account balance (delta: ${delta})`
  )

  if (!exists || !data) return null

  const accounts = data.accounts || {}

  if (!accounts[accountId]) return null

  const updatedAccounts = {
    ...accounts,
    [accountId]: {
      ...accounts[accountId],
      balance: accounts[accountId].balance + delta,
    },
  }

  await writeDoc(
    'budgets',
    budgetId,
    {
      ...data,
      accounts: cleanAccountsForFirestore(updatedAccounts),
    },
    'saving updated account balance after income/expense change'
  )

  return updatedAccounts
}

/**
 * Save payee if new and return updated payees list
 */
export async function savePayeeIfNew(
  budgetId: string,
  payee: string,
  existingPayees: string[]
): Promise<string[] | null> {
  const trimmed = payee.trim()
  if (!trimmed || existingPayees.includes(trimmed)) return null

  const updatedPayees = [...existingPayees, trimmed].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  await writeDoc(
    'payees',
    budgetId,
    {
      budget_id: budgetId,
      payees: updatedPayees,
      updated_at: new Date().toISOString(),
    },
    `adding new payee "${trimmed}" to autocomplete list`
  )

  return updatedPayees
}

// ============================================================================
// BUDGET-LEVEL CATEGORY BALANCES SNAPSHOT STALE HELPERS
// ============================================================================

/**
 * Mark budget snapshot stale in CACHE only.
 * Use this in onMutate for instant UI feedback.
 */
export function markCategoryBalancesSnapshotStaleInCache(budgetId: string): void {
  const budgetKey = queryKeys.budget(budgetId)
  const budgetData = queryClient.getQueryData<BudgetData>(budgetKey)

  if (budgetData?.categoryBalancesSnapshot && !budgetData.categoryBalancesSnapshot.is_stale) {
    queryClient.setQueryData<BudgetData>(budgetKey, {
      ...budgetData,
      categoryBalancesSnapshot: {
        ...budgetData.categoryBalancesSnapshot,
        is_stale: true,
      },
    })
  }
}

/**
 * Mark budget snapshot stale in FIRESTORE only.
 * Use this in mutationFn. Only writes if not already stale.
 */
export async function markCategoryBalancesSnapshotStaleInFirestore(budgetId: string): Promise<void> {
  try {
    const { exists, data } = await readDoc<FirestoreData>(
      'budgets',
      budgetId,
      'checking if budget category snapshot needs stale flag'
    )
    if (exists && data && data.category_balances_snapshot && !data.category_balances_snapshot.is_stale) {
      await writeDoc(
        'budgets',
        budgetId,
        {
          ...data,
          category_balances_snapshot: {
            ...data.category_balances_snapshot,
            is_stale: true,
          },
        },
        'marking budget category balances snapshot as stale (expense or allocation changed)'
      )
    }
  } catch (err) {
    console.error('Error marking category balances snapshot stale in Firestore:', err)
  }
}

// ============================================================================
// MONTH-LEVEL CATEGORY BALANCES STALE HELPERS
// ============================================================================

import type { MonthQueryData } from '../queries/useMonthQuery'
import { queryCollection } from '../firestore/operations'

/**
 * Mark a specific month's category_balances as stale in CACHE only.
 * Use this in onMutate for instant UI feedback.
 */
export function markMonthCategoryBalancesStaleInCache(
  budgetId: string,
  year: number,
  month: number
): void {
  const monthKey = queryKeys.month(budgetId, year, month)
  const monthData = queryClient.getQueryData<MonthQueryData>(monthKey)

  if (monthData?.month && !monthData.month.category_balances_stale) {
    queryClient.setQueryData<MonthQueryData>(monthKey, {
      ...monthData,
      month: {
        ...monthData.month,
        category_balances_stale: true,
      },
    })
  }
}

/**
 * Mark a specific month's category_balances as stale in FIRESTORE only.
 * Use this in mutationFn. Only writes if not already stale.
 */
export async function markMonthCategoryBalancesStaleInFirestore(
  budgetId: string,
  year: number,
  month: number
): Promise<void> {
  try {
    const monthDocId = getMonthDocId(budgetId, year, month)
    const { exists, data } = await readDoc<FirestoreData>(
      'months',
      monthDocId,
      `checking if ${year}/${month} category balances need stale flag`
    )

    if (exists && data && !data.category_balances_stale) {
      await writeDoc(
        'months',
        monthDocId,
        {
          ...data,
          category_balances_stale: true,
        },
        `marking ${year}/${month} category balances as stale`
      )
    }
  } catch (err) {
    console.error('Error marking month category balances stale in Firestore:', err)
  }
}

/**
 * Mark all future months' category_balances as stale in CACHE only.
 * Use this in onMutate for instant UI feedback.
 */
export function markFutureMonthsCategoryBalancesStaleInCache(
  budgetId: string,
  afterYear: number,
  afterMonth: number
): void {
  // Get all cached month queries for this budget
  const cache = queryClient.getQueryCache()
  const monthQueries = cache.findAll({
    predicate: (query) => {
      const key = query.queryKey
      return key[0] === 'month' && key[1] === budgetId
    },
  })

  for (const query of monthQueries) {
    const key = query.queryKey as readonly ['month', string, number, number]
    const queryYear = key[2]
    const queryMonth = key[3]

    // Check if this month is after the edited month
    const isAfter = queryYear > afterYear ||
      (queryYear === afterYear && queryMonth > afterMonth)

    if (isAfter) {
      const monthData = queryClient.getQueryData<MonthQueryData>(key)
      if (monthData?.month && !monthData.month.category_balances_stale) {
        queryClient.setQueryData<MonthQueryData>(key, {
          ...monthData,
          month: {
            ...monthData.month,
            category_balances_stale: true,
          },
        })
      }
    }
  }
}

/**
 * Mark all future months' category_balances as stale in FIRESTORE only.
 * Use this in mutationFn. Only writes if not already stale.
 */
export async function markFutureMonthsCategoryBalancesStaleInFirestore(
  budgetId: string,
  afterYear: number,
  afterMonth: number
): Promise<void> {
  try {
    const monthsResult = await queryCollection<{
      year: number
      month: number
      category_balances_stale?: boolean
    }>(
      'months',
      `finding months after ${afterYear}/${afterMonth} to mark category balances stale`,
      [{ field: 'budget_id', op: '==', value: budgetId }]
    )

    for (const doc of monthsResult.docs) {
      const docYear = doc.data.year
      const docMonth = doc.data.month

      // Check if this month is after the edited month
      const isAfter = docYear > afterYear ||
        (docYear === afterYear && docMonth > afterMonth)

      if (isAfter && !doc.data.category_balances_stale) {
        await writeDoc(
          'months',
          doc.id,
          {
            ...doc.data,
            budget_id: budgetId,
            category_balances_stale: true,
          },
          `marking ${docYear}/${docMonth} category balances as stale (earlier month was edited)`
        )
      }
    }
  } catch (err) {
    console.error('Error marking future months category balances stale in Firestore:', err)
  }
}

