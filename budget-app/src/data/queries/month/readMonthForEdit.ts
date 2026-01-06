/**
 * Read Month For Edit
 *
 * Pre-edit read function for mutation operations.
 * Always reads from Firestore (not cache) to ensure fresh data before editing.
 *
 * IMPORTANT: This function parses the raw Firestore data to ensure all fields
 * have proper defaults. This prevents mutations from accidentally dropping fields
 * that don't exist in older documents (e.g., transfers, adjustments).
 */

import type { MonthDocument, FirestoreData } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId, getYearMonthOrdinal } from '@utils'

/**
 * Parse raw Firestore data into a proper MonthDocument with all fields defaulted.
 * This ensures mutations don't accidentally drop fields that don't exist in the DB.
 */
function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  return {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: data.previous_month_income ?? 0,
    expenses: data.expenses || [],
    total_expenses: data.total_expenses ?? 0,
    transfers: data.transfers || [],
    adjustments: data.adjustments || [],
    account_balances: data.account_balances || [],
    category_balances: data.category_balances || [],
    are_allocations_finalized: data.are_allocations_finalized ?? false,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
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
  return parseMonthData(data, budgetId, year, month)
}

