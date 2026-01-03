/**
 * Fetch Budget
 *
 * Core function for fetching budget documents from Firestore.
 * Handles parsing raw Firestore data into typed structures.
 *
 * NOTE: This does NOT auto-trigger recalculation. Recalculation is triggered
 * by the MonthCategories component when viewing a month that needs it.
 */

import { readDocByPath } from '@firestore'
import type {
  Budget,
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  FirestoreData,
  CategoryGroupWithId,
  AccountGroup,
  Category,
  MonthMap,
} from '@types'

// ============================================================================
// TYPES
// ============================================================================

/** Raw budget document structure from Firestore */
interface BudgetDocument {
  name: string
  user_ids: string[]
  accepted_user_ids: string[]
  owner_id: string
  owner_email: string | null
  accounts: FirestoreData
  account_groups: FirestoreData
  categories: FirestoreData
  category_groups: FirestoreData[]
  total_available?: number
  is_needs_recalculation?: boolean
  month_map?: FirestoreData
  created_at?: string
  updated_at?: string
}

/** Parsed budget data with proper types */
export interface BudgetData {
  budget: Budget
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroupWithId[]
  /** Flag indicating balances need recalculation from transaction data */
  isNeedsRecalculation: boolean
  /** Index of recent months with their recalculation status */
  monthMap: MonthMap
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse raw Firestore accounts data into typed AccountsMap
 * Always applies defaults for optional fields to ensure consistent data
 */
function parseAccounts(accountsData: FirestoreData = {}): AccountsMap {
  const accounts: AccountsMap = {}
  Object.entries(accountsData).forEach(([id, account]) => {
    accounts[id] = {
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
    }
  })
  return accounts
}

/**
 * Parse raw Firestore account groups data into typed AccountGroupsMap
 */
function parseAccountGroups(accountGroupsData: FirestoreData = {}): AccountGroupsMap {
  const groups: AccountGroupsMap = {}
  Object.entries(accountGroupsData).forEach(([id, group]) => {
    groups[id] = {
      name: group.name,
      sort_order: group.sort_order ?? 0,
      expected_balance: group.expected_balance ?? 'positive',
      on_budget: group.on_budget,
      is_active: group.is_active,
    } as AccountGroup
  })
  return groups
}

/**
 * Parse raw Firestore categories data into typed CategoriesMap
 */
function parseCategories(categoriesData: FirestoreData = {}): CategoriesMap {
  const categories: CategoriesMap = {}
  Object.entries(categoriesData).forEach(([id, category]) => {
    categories[id] = {
      name: category.name,
      description: category.description,
      category_group_id: category.category_group_id ?? null,
      sort_order: category.sort_order ?? 0,
      default_monthly_amount: category.default_monthly_amount,
      default_monthly_type: category.default_monthly_type,
      balance: category.balance ?? 0,
    } as Category
  })
  return categories
}

/**
 * Parse raw Firestore category groups data into typed CategoryGroupWithId[]
 */
function parseCategoryGroups(categoryGroupsData: FirestoreData[] = []): CategoryGroupWithId[] {
  const groups: CategoryGroupWithId[] = categoryGroupsData.map((group) => ({
    id: group.id as string,
    name: group.name as string,
    sort_order: (group.sort_order as number) ?? 0,
  }))
  groups.sort((a, b) => a.sort_order - b.sort_order)
  return groups
}

/**
 * Parse raw Firestore month_map data into typed MonthMap
 */
function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  Object.entries(monthMapData).forEach(([ordinal, info]) => {
    monthMap[ordinal] = {
      needs_recalculation: info?.needs_recalculation ?? false,
    }
  })
  return monthMap
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Fetch budget document from Firestore
 *
 * NOTE: This does NOT auto-trigger recalculation. Recalculation is triggered
 * by the MonthCategories component when viewing a month that needs it.
 * This ensures recalculation only happens when actually viewing month data,
 * not just when fetching the budget (e.g., after bulk imports).
 */
export async function fetchBudget(budgetId: string): Promise<BudgetData> {
  const { exists, data } = await readDocByPath<BudgetDocument>(
    'budgets',
    budgetId,
    'loading budget data (cache miss or stale)'
  )

  if (!exists || !data) {
    throw new Error(`Budget ${budgetId} not found`)
  }

  const accounts = parseAccounts(data.accounts)
  const accountGroups = parseAccountGroups(data.account_groups)
  const categories = parseCategories(data.categories)
  const categoryGroups = parseCategoryGroups(data.category_groups)
  const totalAvailable = data.total_available ?? 0
  const monthMap = parseMonthMap(data.month_map)
  const isNeedsRecalculation = data.is_needs_recalculation ?? false

  return {
    budget: {
      id: budgetId,
      name: data.name,
      user_ids: data.user_ids || [],
      accepted_user_ids: data.accepted_user_ids || [],
      owner_id: data.owner_id || data.user_ids?.[0] || '',
      owner_email: data.owner_email || '',
      accounts,
      account_groups: accountGroups,
      categories,
      category_groups: categoryGroups,
      total_available: totalAvailable,
      is_needs_recalculation: isNeedsRecalculation,
      month_map: monthMap,
    },
    accounts,
    accountGroups,
    categories,
    categoryGroups,
    isNeedsRecalculation,
    monthMap,
  }
}

