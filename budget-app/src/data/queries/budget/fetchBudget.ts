/**
 * Fetch Budget
 *
 * Core function for fetching budget documents from Firestore.
 * Handles parsing raw Firestore data into typed structures.
 *
 * NOTE: This does NOT auto-trigger recalculation. Recalculation is triggered
 * by the MonthCategories component when viewing a month that needs it.
 */

import type { QueryClient } from '@tanstack/react-query'
import { readDocByPath } from '@firestore'
import { queryKeys, STALE_TIME } from '@data/queryClient'
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
import { UNGROUPED_ACCOUNT_GROUP_ID, UNGROUPED_CATEGORY_GROUP_ID } from '@constants'

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
  // Removed total_available and is_needs_recalculation - calculated/managed locally
  month_map?: FirestoreData
  percentage_income_months_back?: number
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
  /** Index of months in the budget (just tracks which months exist) */
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
      // Budget-level balance is never stored; always 0 on read. Filled by local recalc.
      balance: 0,
      // Always use ungrouped group ID if not set (never null)
      account_group_id: account.account_group_id ?? UNGROUPED_ACCOUNT_GROUP_ID,
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
 * Ensures the default ungrouped group always exists
 */
function parseAccountGroups(accountGroupsData: FirestoreData = {}): AccountGroupsMap {
  const groups: AccountGroupsMap = {}
  Object.entries(accountGroupsData).forEach(([id, group]) => {
    groups[id] = {
      name: group.name,
      sort_order: group.sort_order ?? 0,
      expected_balance: group.expected_balance ?? 'positive',
      // Use null for missing override fields (means "use account default")
      // Firestore doesn't allow undefined, so we use null
      on_budget: group.on_budget !== undefined ? group.on_budget : null,
      is_active: group.is_active !== undefined ? group.is_active : null,
    } as AccountGroup
  })

  // Ensure ungrouped group always exists
  if (!groups[UNGROUPED_ACCOUNT_GROUP_ID]) {
    groups[UNGROUPED_ACCOUNT_GROUP_ID] = {
      name: 'Ungrouped',
      sort_order: 0,
      expected_balance: 'positive',
      on_budget: null,
      is_active: null,
    }
  }

  return groups
}

/**
 * Parse raw Firestore categories data into typed CategoriesMap
 * Always uses ungrouped category group ID if not set (never null)
 */
function parseCategories(categoriesData: FirestoreData = {}): CategoriesMap {
  const categories: CategoriesMap = {}
  Object.entries(categoriesData).forEach(([id, category]) => {
    categories[id] = {
      name: category.name,
      description: category.description,
      // Always use ungrouped group ID if not set (never null)
      category_group_id: category.category_group_id ?? UNGROUPED_CATEGORY_GROUP_ID,
      sort_order: category.sort_order ?? 0,
      default_monthly_amount: category.default_monthly_amount,
      default_monthly_type: category.default_monthly_type,
      // Budget-level balance is never stored; always 0 on read. Filled by local recalc.
      balance: 0,
      is_hidden: category.is_hidden ?? false,
    } as Category
  })
  return categories
}

/**
 * Parse raw Firestore category groups data into typed CategoryGroupWithId[]
 * Ensures the default ungrouped category group always exists
 */
function parseCategoryGroups(categoryGroupsData: FirestoreData[] = []): CategoryGroupWithId[] {
  const groups: CategoryGroupWithId[] = categoryGroupsData.map((group) => ({
    id: group.id as string,
    name: group.name as string,
    sort_order: (group.sort_order as number) ?? 0,
  }))

  // Ensure ungrouped category group always exists
  const hasUngrouped = groups.some(g => g.id === UNGROUPED_CATEGORY_GROUP_ID)
  if (!hasUngrouped) {
    // If ungrouped doesn't exist, add it with a sort_order higher than all existing groups
    const maxSortOrder = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) : -1
    groups.push({
      id: UNGROUPED_CATEGORY_GROUP_ID,
      name: 'Uncategorized',
      sort_order: maxSortOrder + 1,
    })
  }

  groups.sort((a, b) => a.sort_order - b.sort_order)
  return groups
}

/**
 * Parse raw Firestore month_map data into typed MonthMap
 * month_map is just a set of ordinals - values are empty objects
 */
function parseMonthMap(monthMapData: FirestoreData = {}): MonthMap {
  const monthMap: MonthMap = {}
  Object.keys(monthMapData).forEach((ordinal) => {
    monthMap[ordinal] = {}
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
  const monthMap = parseMonthMap(data.month_map)

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
      // Removed total_available and is_needs_recalculation - calculated/managed locally
      month_map: monthMap,
      percentage_income_months_back: data.percentage_income_months_back,
    },
    accounts,
    accountGroups,
    categories,
    categoryGroups,
    monthMap,
  }
}

// ============================================================================
// BUDGET IN CACHE (for callers that need budget fields like percentage_income_months_back)
// ============================================================================

/**
 * Ensure budget is in the React Query cache (fetch if missing or stale).
 * Use this before reading percentage_income_months_back or other budget fields
 * so we never default from an empty cache; only legacy unmigrated budgets lack the field.
 */
export async function ensureBudgetInCache(
  budgetId: string,
  queryClientInstance: QueryClient
): Promise<BudgetData> {
  return queryClientInstance.fetchQuery({
    queryKey: queryKeys.budget(budgetId),
    queryFn: () => fetchBudget(budgetId),
    staleTime: STALE_TIME,
  })
}

