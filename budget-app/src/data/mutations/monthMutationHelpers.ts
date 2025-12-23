/**
 * Helper Functions for Month Mutations
 *
 * Shared utilities used across income, expense, and allocation mutations.
 */

import type { QueryClient } from '@tanstack/react-query'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import type { MonthDocument, AccountsMap } from '../../types/budget'
import {
  getMonthDocId,
  cleanIncomeForFirestore,
  cleanExpensesForFirestore,
  cleanAllocationsForFirestore,
  cleanCategoryBalancesForFirestore,
  cleanAccountsForFirestore,
} from '../../utils/budgetHelpers'
import { markNextMonthSnapshotStaleInFirestore } from '../queries/useMonthQuery'

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
  db: ReturnType<typeof getFirestore>,
  budgetId: string,
  month: MonthDocument,
  queryClient: QueryClient
) {
  const monthDocId = getMonthDocId(budgetId, month.year, month.month)
  const monthDocRef = doc(db, 'months', monthDocId)

  const cleanedMonth: Record<string, any> = {
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
  if (month.snapshot_stale !== undefined) cleanedMonth.snapshot_stale = month.snapshot_stale

  // Save the month document
  await setDoc(monthDocRef, cleanedMonth)

  // CROSS-MONTH: Mark next month as stale (only writes to Firestore if not already stale)
  await markNextMonthSnapshotStaleInFirestore(budgetId, month.year, month.month, queryClient)
}

/**
 * Update account balance in budget document and return updated accounts
 */
export async function updateAccountBalance(
  db: ReturnType<typeof getFirestore>,
  budgetId: string,
  accountId: string,
  delta: number
): Promise<AccountsMap | null> {
  const budgetDocRef = doc(db, 'budgets', budgetId)
  const budgetDoc = await getDoc(budgetDocRef)

  if (!budgetDoc.exists()) return null

  const data = budgetDoc.data()
  const accounts = data.accounts || {}

  if (!accounts[accountId]) return null

  const updatedAccounts = {
    ...accounts,
    [accountId]: {
      ...accounts[accountId],
      balance: accounts[accountId].balance + delta,
    },
  }

  await setDoc(budgetDocRef, {
    ...data,
    accounts: cleanAccountsForFirestore(updatedAccounts),
  })

  return updatedAccounts
}

/**
 * Save payee if new and return updated payees list
 */
export async function savePayeeIfNew(
  db: ReturnType<typeof getFirestore>,
  budgetId: string,
  payee: string,
  existingPayees: string[]
): Promise<string[] | null> {
  const trimmed = payee.trim()
  if (!trimmed || existingPayees.includes(trimmed)) return null

  const payeesDocRef = doc(db, 'payees', budgetId)
  const updatedPayees = [...existingPayees, trimmed].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )

  await setDoc(payeesDocRef, {
    budget_id: budgetId,
    payees: updatedPayees,
    updated_at: new Date().toISOString(),
  })

  return updatedPayees
}

