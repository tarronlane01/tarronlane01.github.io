// Utility functions for budget operations
// Extracted from budget_context.tsx for better organization

import type { AccountsMap, IncomeTransaction, CategoryAllocation } from '../types/budget'

/**
 * Clean accounts for Firestore (removes undefined values)
 * Firebase Firestore does not allow undefined values
 */
export function cleanAccountsForFirestore(accounts: AccountsMap): AccountsMap {
  const cleaned: AccountsMap = {}
  Object.entries(accounts).forEach(([accId, acc]) => {
    cleaned[accId] = {
      nickname: acc.nickname,
      balance: acc.balance,
      account_group_id: acc.account_group_id ?? null,
      sort_order: acc.sort_order,
    }
    // Only include optional fields if they have a value
    if (acc.is_income_account !== undefined) cleaned[accId].is_income_account = acc.is_income_account
    if (acc.is_income_default !== undefined) cleaned[accId].is_income_default = acc.is_income_default
    if (acc.is_outgo_account !== undefined) cleaned[accId].is_outgo_account = acc.is_outgo_account
    if (acc.is_outgo_default !== undefined) cleaned[accId].is_outgo_default = acc.is_outgo_default
    if (acc.on_budget !== undefined) cleaned[accId].on_budget = acc.on_budget
    if (acc.is_active !== undefined) cleaned[accId].is_active = acc.is_active
  })
  return cleaned
}

/**
 * Clean income array for Firestore (removes undefined values)
 */
export function cleanIncomeForFirestore(incomeList: IncomeTransaction[]): Record<string, any>[] {
  return incomeList.map(inc => {
    const cleaned: Record<string, any> = {
      id: inc.id,
      amount: inc.amount,
      account_id: inc.account_id,
      date: inc.date,
      created_at: inc.created_at,
    }
    if (inc.payee) cleaned.payee = inc.payee
    if (inc.description) cleaned.description = inc.description
    return cleaned
  })
}

/**
 * Clean allocations for Firestore
 */
export function cleanAllocationsForFirestore(allocationsList: CategoryAllocation[]): Record<string, any>[] {
  return allocationsList.map(alloc => ({
    category_id: alloc.category_id,
    amount: alloc.amount,
  }))
}

/**
 * Generate month document ID
 */
export function getMonthDocId(budgetId: string, year: number, month: number): string {
  const monthStr = month.toString().padStart(2, '0')
  return `${budgetId}_${year}_${monthStr}`
}

