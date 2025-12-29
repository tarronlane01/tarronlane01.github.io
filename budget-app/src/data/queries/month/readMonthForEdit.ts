/**
 * Read Month For Edit
 *
 * Pre-edit read function for mutation operations.
 * Always reads from Firestore (not cache) to ensure fresh data before editing.
 */

import type { MonthDocument } from '@types'
import { readDocByPath } from '@firestore'
import { getMonthDocId } from '@utils'

/**
 * Read month data from Firestore before editing.
 *
 * This is specifically for mutation functions that need fresh Firestore data
 * before applying changes. It:
 * - Always reads from Firestore (not cache) to ensure fresh data
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

  const { exists, data: monthData } = await readDocByPath<MonthDocument>(
    'months',
    monthDocId,
    logDescription
  )

  if (!exists || !monthData) {
    throw new Error(`Month data not found for ${year}/${month}`)
  }

  return monthData
}

