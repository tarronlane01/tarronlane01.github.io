/**
 * Read Month For Edit
 *
 * Pre-edit read function for mutation operations.
 * Always reads from Firestore (not cache) to ensure fresh data before editing.
 *
 * WHY THIS READ IS NEEDED:
 * Month documents contain multiple arrays (income, expenses, transfers, etc.)
 * and mutations need to add/modify items within these arrays. Unlike simple
 * field updates that can use merge strategy, array item modifications require
 * reading the current array first.
 *
 * IMPORTANT: This function parses the raw Firestore data to ensure all fields
 * have proper defaults. This prevents mutations from accidentally dropping fields
 * that don't exist in older documents (e.g., transfers, adjustments).
 */

import type { MonthDocument, FirestoreData } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'
import { calculatePreviousMonthIncome } from './calculatePreviousMonthIncome'

/**
 * Parse raw Firestore data into a proper MonthDocument with all fields defaulted.
 * This ensures mutations don't accidentally drop fields that don't exist in the DB.
 * Calculates total_income, total_expenses, and previous_month_income from arrays (not stored in Firestore).
 */
async function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): Promise<MonthDocument> {
  const income = data.income || []
  const expenses = data.expenses || []
  
  // Calculate totals from arrays (not stored in Firestore - calculated on-the-fly)
  const totalIncome = income.reduce((sum: number, inc: { amount: number }) => sum + (inc.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum: number, exp: { amount: number }) => sum + (exp.amount || 0), 0)
  
  // Calculate previous_month_income from previous month's income array (not stored in Firestore)
  // Falls back to stored value for backward compatibility during migration
  const previousMonthIncome = data.previous_month_income !== undefined
    ? data.previous_month_income as number // Use stored value if present (backward compatibility)
    : await calculatePreviousMonthIncome(budgetId, year, month)
  
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income,
    total_income: totalIncome, // Calculated from income array
    previous_month_income: previousMonthIncome, // Calculated from previous month's income array
    expenses,
    total_expenses: totalExpenses, // Calculated from expenses array
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }

  // Convert stored balances to calculated balances
  return convertMonthBalancesFromStored(monthDoc)
}

/**
 * Read month data from Firestore before editing.
 *
 * This is specifically for mutation functions that need fresh Firestore data
 * before applying changes. It:
 * - Always reads from Firestore (not cache) to ensure fresh data
 * - Parses raw data to ensure all fields have proper defaults
 * - Throws a clear error if the month doesn't exist
 * - Returns the MonthDocument directly (not wrapped)
 *
 * @param budgetId - Budget ID
 * @param year - Year
 * @param month - Month (1-12)
 * @param operation - Description of the operation for logging (e.g., 'add income')
 * @returns The month document
 * @throws Error if month doesn't exist
 */
export async function readMonthForEdit(
  budgetId: string,
  year: number,
  month: number,
  operation?: string
): Promise<MonthDocument> {
  const monthDocId = getMonthDocId(budgetId, year, month)
  const logDescription = operation ? `PRE-EDIT-READ: ${operation}` : 'PRE-EDIT-READ'

  const { exists, data } = await readDocByPath<FirestoreData>(
    'months',
    monthDocId,
    logDescription
  )

  if (!exists || !data) {
    throw new Error(`Month data not found for ${year}/${month}`)
  }

  // Parse to ensure all fields have proper defaults
  return await parseMonthData(data, budgetId, year, month)
}

