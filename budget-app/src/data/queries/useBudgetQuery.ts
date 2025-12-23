/**
 * Budget Query Hook
 *
 * Fetches the budget-level document containing global/cross-month data:
 * - Account definitions and groups
 * - Category definitions and groups
 * - Display ordering
 * - Ownership/access metadata
 *
 * This document is read once per session and cached aggressively.
 */

import { useQuery } from '@tanstack/react-query'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import app from '../../firebase'
import { queryKeys } from '../queryClient'
import type {
  Budget,
  AccountsMap,
  AccountGroupsMap,
  CategoriesMap,
  CategoryGroup,
  FinancialAccount,
  AccountGroup,
  Category,
} from '../../types/budget'

// Raw budget document structure from Firestore
interface BudgetDocument {
  name: string
  user_ids: string[]
  accepted_user_ids: string[]
  owner_id: string
  owner_email: string | null
  accounts: Record<string, any>
  account_groups: Record<string, any>
  categories: Record<string, any>
  category_groups: any[]
  created_at?: string
  updated_at?: string
}

// Parsed budget data with proper types
export interface BudgetData {
  budget: Budget
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
}

/**
 * Parse raw Firestore accounts data into typed AccountsMap
 */
function parseAccounts(accountsData: Record<string, any> = {}): AccountsMap {
  const accounts: AccountsMap = {}
  Object.entries(accountsData).forEach(([id, account]) => {
    accounts[id] = {
      nickname: account.nickname,
      balance: account.balance,
      account_group_id: account.account_group_id ?? null,
      sort_order: account.sort_order ?? 0,
      is_income_account: account.is_income_account,
      is_income_default: account.is_income_default,
      is_outgo_account: account.is_outgo_account,
      is_outgo_default: account.is_outgo_default,
      on_budget: account.on_budget,
      is_active: account.is_active,
    } as FinancialAccount
  })
  return accounts
}

/**
 * Parse raw Firestore account groups data into typed AccountGroupsMap
 */
function parseAccountGroups(accountGroupsData: Record<string, any> = {}): AccountGroupsMap {
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
function parseCategories(categoriesData: Record<string, any> = {}): CategoriesMap {
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
 * Parse raw Firestore category groups data into typed CategoryGroup[]
 */
function parseCategoryGroups(categoryGroupsData: any[] = []): CategoryGroup[] {
  const groups = categoryGroupsData.map((group) => ({
    id: group.id,
    name: group.name,
    sort_order: group.sort_order ?? 0,
  }))
  groups.sort((a, b) => a.sort_order - b.sort_order)
  return groups
}

/**
 * Fetch budget document from Firestore
 */
async function fetchBudget(budgetId: string): Promise<BudgetData> {
  const db = getFirestore(app)
  const budgetDocRef = doc(db, 'budgets', budgetId)
  const budgetDoc = await getDoc(budgetDocRef)

  if (!budgetDoc.exists()) {
    throw new Error(`Budget ${budgetId} not found`)
  }

  const data = budgetDoc.data() as BudgetDocument

  return {
    budget: {
      id: budgetId,
      name: data.name,
      user_ids: data.user_ids || [],
      accepted_user_ids: data.accepted_user_ids || [],
      owner_id: data.owner_id || data.user_ids?.[0] || '',
      owner_email: data.owner_email || null,
    },
    accounts: parseAccounts(data.accounts),
    accountGroups: parseAccountGroups(data.account_groups),
    categories: parseCategories(data.categories),
    categoryGroups: parseCategoryGroups(data.category_groups),
  }
}

/**
 * Query hook for budget-level document
 *
 * Returns the complete budget data including accounts, categories, etc.
 * Data is cached for 24 hours and persisted to localStorage.
 *
 * @param budgetId - The budget ID to fetch
 * @param options - Additional query options
 */
export function useBudgetQuery(
  budgetId: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: budgetId ? queryKeys.budget(budgetId) : ['budget', 'none'],
    queryFn: () => fetchBudget(budgetId!),
    enabled: !!budgetId && (options?.enabled !== false),
  })
}

/**
 * Convenience hook that returns just the budget data (not query state)
 * Useful when you need to access budget data in components that don't need loading states
 */
export function useBudgetDataQuery(budgetId: string | null) {
  const query = useBudgetQuery(budgetId)
  return query.data
}

