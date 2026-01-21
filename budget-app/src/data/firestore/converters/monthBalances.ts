/**
 * Converters between stored and calculated balance formats.
 * 
 * When reading from Firestore: stored -> calculated (add computed fields)
 * When writing to Firestore: calculated -> stored (strip computed fields)
 */

import type { CategoryMonthBalance, CategoryMonthBalanceStored } from '@types'
import type { AccountMonthBalance, AccountMonthBalanceStored } from '@types'
import { calculateCategoryBalances } from '@utils/calculations/balances/calculateCategoryBalancesFromTransactions'
import { calculateAccountBalances } from '@utils/calculations/balances/calculateAccountBalancesFromTransactions'
import type { MonthDocument } from '@types'
import { isMonthAtOrBeforeWindow } from '@utils/window'
import { roundCurrency } from '@utils'

/**
 * Convert stored category balance to calculated (adds computed fields).
 * This is a no-op if already calculated, but ensures all fields are present.
 */
export function storedToCalculatedCategoryBalance(
  stored: CategoryMonthBalanceStored,
  expenses: MonthDocument['expenses'],
  transfers: MonthDocument['transfers'],
  adjustments: MonthDocument['adjustments']
): CategoryMonthBalance {
  // If it already has calculated fields, it's already converted
  if ('spent' in stored && 'transfers' in stored && 'adjustments' in stored && 'end_balance' in stored) {
    return stored as CategoryMonthBalance
  }

  // Calculate from transactions
  const [calculated] = calculateCategoryBalances([stored], expenses, transfers, adjustments)
  return calculated
}

/**
 * Convert stored account balance to calculated (adds computed fields).
 */
export function storedToCalculatedAccountBalance(
  stored: AccountMonthBalanceStored,
  income: MonthDocument['income'],
  expenses: MonthDocument['expenses'],
  transfers: MonthDocument['transfers'],
  adjustments: MonthDocument['adjustments']
): AccountMonthBalance {
  // If it already has calculated fields, it's already converted
  if ('income' in stored && 'expenses' in stored && 'transfers' in stored && 'adjustments' in stored && 'net_change' in stored && 'end_balance' in stored) {
    return stored as AccountMonthBalance
  }

  // Calculate from transactions
  const [calculated] = calculateAccountBalances([stored], income, expenses, transfers, adjustments)
  return calculated
}

/**
 * Convert calculated category balance to stored (strips computed fields).
 * Only saves start_balance if month is at/before first window month.
 * 
 * @param calculated - Full calculated balance
 * @param year - Year of the month
 * @param month - Month (1-12)
 */
export function calculatedToStoredCategoryBalance(
  calculated: CategoryMonthBalance,
  year: number,
  month: number
): CategoryMonthBalanceStored {
  const isAtOrBeforeWindow = isMonthAtOrBeforeWindow(year, month)
  
  return {
    category_id: calculated.category_id,
    // Round start_balance to ensure 2 decimal precision before saving to Firestore
    start_balance: isAtOrBeforeWindow ? roundCurrency(calculated.start_balance) : 0, // Only save if at/before window
    // Round allocated to ensure 2 decimal precision before saving to Firestore
    allocated: roundCurrency(calculated.allocated), // Always save allocated
  }
}

/**
 * Convert calculated account balance to stored (strips computed fields).
 * Only saves start_balance if month is at/before first window month.
 * 
 * @param calculated - Full calculated balance
 * @param year - Year of the month
 * @param month - Month (1-12)
 */
export function calculatedToStoredAccountBalance(
  calculated: AccountMonthBalance,
  year: number,
  month: number
): AccountMonthBalanceStored {
  const isAtOrBeforeWindow = isMonthAtOrBeforeWindow(year, month)
  
  return {
    account_id: calculated.account_id,
    // Round start_balance to ensure 2 decimal precision before saving to Firestore
    start_balance: isAtOrBeforeWindow ? roundCurrency(calculated.start_balance) : 0, // Only save if at/before window
  }
}

/**
 * Convert month document balances from stored to calculated format.
 * Used when reading from Firestore.
 */
export function convertMonthBalancesFromStored(month: MonthDocument): MonthDocument {
  // Convert category balances
  const calculatedCategoryBalances = month.category_balances.map(cb =>
    storedToCalculatedCategoryBalance(
      cb as CategoryMonthBalanceStored,
      month.expenses,
      month.transfers,
      month.adjustments
    )
  )

  // Convert account balances
  const calculatedAccountBalances = month.account_balances.map(ab =>
    storedToCalculatedAccountBalance(
      ab as AccountMonthBalanceStored,
      month.income,
      month.expenses,
      month.transfers,
      month.adjustments
    )
  )

  return {
    ...month,
    category_balances: calculatedCategoryBalances,
    account_balances: calculatedAccountBalances,
  }
}

/**
 * Convert month document balances from calculated to stored format.
 * Used when writing to Firestore.
 * Only saves start_balance for months at/before first window month.
 * Strips all calculated fields: total_income, total_expenses, previous_month_income, and balance calculated fields.
 * 
 * Exceptions (fields we DO save):
 * - start_balance (for months at/before window)
 * - allocated (for categories)
 * - previous_month_income is NOT saved (calculated from previous month's income array)
 */
export function convertMonthBalancesToStored(month: MonthDocument): MonthDocument {
  // Convert category balances (strip computed fields, only save start_balance if at/before window)
  const storedCategoryBalances: CategoryMonthBalanceStored[] = month.category_balances.map(cb =>
    calculatedToStoredCategoryBalance(cb, month.year, month.month)
  )

  // Convert account balances (strip computed fields, only save start_balance if at/before window)
  const storedAccountBalances: AccountMonthBalanceStored[] = month.account_balances.map(ab =>
    calculatedToStoredAccountBalance(ab, month.year, month.month)
  )

  // Strip calculated totals (they're computed from income/expenses arrays)
  // Also strip previous_month_income (it's calculated from previous month's income array)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Destructuring to remove fields before saving
  const { total_income, total_expenses, previous_month_income, ...monthWithoutCalculatedFields } = month

  // Return type assertion: MonthDocument without calculated fields (they're added back when reading)
  // This is safe because these fields are calculated on-the-fly when reading from Firestore
  return {
    ...monthWithoutCalculatedFields,
    category_balances: storedCategoryBalances as CategoryMonthBalance[], // Type assertion for compatibility
    account_balances: storedAccountBalances as AccountMonthBalance[], // Type assertion for compatibility
  } as MonthDocument
}
