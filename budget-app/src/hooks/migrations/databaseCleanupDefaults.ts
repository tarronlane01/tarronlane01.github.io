/**
 * Database Cleanup Default Values
 *
 * Functions that apply default values to database entities based on TypeScript interfaces.
 */

import type {
  FirestoreData,
  FinancialAccount,
  AccountGroup,
  Category,
  MonthDocument,
} from '@types'

/**
 * Apply defaults to a FinancialAccount based on FinancialAccount interface
 */
export function applyAccountDefaults(account: FirestoreData): FinancialAccount {
  return {
    nickname: account.nickname ?? '',
    description: account.description ?? '',
    balance: account.balance ?? 0,
    account_group_id: account.account_group_id ?? null,
    sort_order: account.sort_order ?? 0,
    is_income_account: account.is_income_account ?? false,
    is_income_default: account.is_income_default ?? false,
    is_outgo_account: account.is_outgo_account ?? false,
    is_outgo_default: account.is_outgo_default ?? false,
    on_budget: account.on_budget ?? true,
    is_active: account.is_active ?? true,
    is_hidden: account.is_hidden ?? false,
  }
}

/**
 * Apply defaults to a Category based on Category interface
 */
export function applyCategoryDefaults(category: FirestoreData): Category {
  return {
    name: category.name ?? '',
    description: category.description ?? '',
    category_group_id: category.category_group_id ?? null,
    sort_order: category.sort_order ?? 0,
    default_monthly_amount: category.default_monthly_amount ?? 0,
    default_monthly_type: category.default_monthly_type ?? 'fixed',
    balance: category.balance ?? 0,
    is_hidden: category.is_hidden ?? false,
  }
}

/**
 * Apply defaults to an AccountGroup based on AccountGroup interface
 * All fields are required - use null for optional override fields if not set
 */
export function applyAccountGroupDefaults(group: FirestoreData): AccountGroup {
  return {
    name: group.name ?? '',
    sort_order: group.sort_order ?? 0,
    expected_balance: group.expected_balance ?? 'positive',
    // Use null for missing override fields (means "use account default")
    on_budget: group.on_budget !== undefined ? group.on_budget : null,
    is_active: group.is_active !== undefined ? group.is_active : null,
  }
}

/**
 * Apply defaults to a MonthDocument based on MonthDocument interface
 */
export function applyMonthDefaults(month: FirestoreData, docId: string): MonthDocument {
  // Extract year and month from docId (format: budgetId_YYYYMM)
  const yearMonthMatch = docId.match(/_(\d{4})(\d{2})$/)
  const year = yearMonthMatch ? parseInt(yearMonthMatch[1]) : new Date().getFullYear()
  const monthNum = yearMonthMatch ? parseInt(yearMonthMatch[2]) : new Date().getMonth() + 1
  const yearMonthOrdinal = `${year}${String(monthNum).padStart(2, '0')}`

  return {
    budget_id: month.budget_id ?? '',
    year_month_ordinal: month.year_month_ordinal ?? yearMonthOrdinal,
    year: month.year ?? year,
    month: month.month ?? monthNum,

    income: Array.isArray(month.income) ? month.income : [],
    total_income: month.total_income ?? 0,
    previous_month_income: month.previous_month_income ?? 0,

    expenses: Array.isArray(month.expenses) ? month.expenses : [],
    total_expenses: month.total_expenses ?? 0,

    transfers: Array.isArray(month.transfers) ? month.transfers : [],
    adjustments: Array.isArray(month.adjustments) ? month.adjustments : [],

    account_balances: Array.isArray(month.account_balances) ? month.account_balances : [],
    category_balances: Array.isArray(month.category_balances) ? month.category_balances : [],
    are_allocations_finalized: month.are_allocations_finalized ?? false,

    created_at: month.created_at ?? new Date().toISOString(),
    updated_at: month.updated_at ?? new Date().toISOString(),
  }
}

