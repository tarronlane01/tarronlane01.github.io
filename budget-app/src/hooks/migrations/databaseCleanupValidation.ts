/**
 * Database Cleanup Validation Helpers
 *
 * Functions to check if database entities need default values applied.
 */

import type { FirestoreData } from '@types'
import { MAX_FUTURE_MONTHS } from '@constants'

export function accountNeedsDefaults(account: FirestoreData): boolean {
  return (
    account.nickname === undefined ||
    account.description === undefined ||
    account.balance === undefined ||
    account.sort_order === undefined ||
    account.is_income_account === undefined ||
    account.is_income_default === undefined ||
    account.is_outgo_account === undefined ||
    account.is_outgo_default === undefined ||
    account.on_budget === undefined ||
    account.is_active === undefined
  )
}

export function categoryNeedsDefaults(category: FirestoreData): boolean {
  return (
    category.name === undefined ||
    category.description === undefined ||
    category.sort_order === undefined ||
    category.default_monthly_amount === undefined ||
    category.default_monthly_type === undefined ||
    category.balance === undefined
  )
}

export function accountGroupNeedsDefaults(group: FirestoreData): boolean {
  return (
    group.name === undefined ||
    group.sort_order === undefined
  )
}

export function monthNeedsDefaults(month: FirestoreData): boolean {
  return (
    month.budget_id === undefined ||
    month.year_month_ordinal === undefined ||
    month.year === undefined ||
    month.month === undefined ||
    !Array.isArray(month.income) ||
    month.total_income === undefined ||
    month.previous_month_income === undefined ||
    !Array.isArray(month.expenses) ||
    month.total_expenses === undefined ||
    !Array.isArray(month.account_balances) ||
    !Array.isArray(month.category_balances) ||
    month.are_allocations_finalized === undefined ||
    month.created_at === undefined ||
    month.updated_at === undefined
  )
}

/**
 * Get cutoff date (MAX_FUTURE_MONTHS from now) - anything beyond should be deleted
 */
export function getFutureMonthCutoff(): { year: number; month: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let cutoffMonth = currentMonth + MAX_FUTURE_MONTHS
  let cutoffYear = currentYear

  while (cutoffMonth > 12) {
    cutoffMonth -= 12
    cutoffYear += 1
  }

  return { year: cutoffYear, month: cutoffMonth }
}

export function isMonthBeyondCutoff(
  year: number,
  month: number,
  cutoff: { year: number; month: number }
): boolean {
  if (year > cutoff.year) return true
  if (year === cutoff.year && month > cutoff.month) return true
  return false
}

