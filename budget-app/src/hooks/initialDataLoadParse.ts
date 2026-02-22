/**
 * Parse raw Firestore month data into MonthDocument for initial data load.
 */

import { getYearMonthOrdinal } from '@utils'
import type { MonthDocument, FirestoreData } from '@types'
import { convertMonthBalancesFromStored } from '@data/firestore/converters/monthBalances'

export function parseMonthData(data: FirestoreData, budgetId: string, year: number, month: number): MonthDocument {
  const monthDoc: MonthDocument = {
    budget_id: budgetId,
    year_month_ordinal: data.year_month_ordinal ?? getYearMonthOrdinal(year, month),
    year: data.year ?? year,
    month: data.month ?? month,
    income: data.income || [],
    total_income: data.total_income ?? 0,
    previous_month_income: 0,
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
  return convertMonthBalancesFromStored(monthDoc)
}
