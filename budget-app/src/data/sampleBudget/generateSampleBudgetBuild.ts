/**
 * Build budget and payees documents from chained sample months.
 */

import {
  SAMPLE_BUDGET_ID,
  SAMPLE_BUDGET_NAME,
  SAMPLE_ACCOUNTS,
  SAMPLE_CATEGORIES,
  SAMPLE_CATEGORY_GROUPS,
  SAMPLE_ACCOUNT_GROUPS,
  SAMPLE_PAYEES,
} from './sampleBudgetDefinition'
import type { GeneratedMonth } from './generateSampleBudget'

export interface SampleBudgetOutput {
  budgetDocument: Record<string, unknown>
  payeesDocument: Record<string, unknown>
}

export function buildSampleBudgetOutput(months: GeneratedMonth[], timestamp: string): SampleBudgetOutput {
  const monthMap: Record<string, Record<string, never>> = {}
  for (const m of months) {
    const key = `${m.year}${String(m.month).padStart(2, '0')}`
    monthMap[key] = {}
  }

  const accounts: Record<string, Record<string, unknown>> = {}
  for (const [id, account] of Object.entries(SAMPLE_ACCOUNTS)) {
    accounts[id] = {
      nickname: account.nickname,
      description: account.description,
      account_group_id: account.account_group_id,
      on_budget: account.on_budget,
      is_active: account.is_active,
      is_income_account: account.is_income_account,
      is_income_default: account.is_income_default,
      is_outgo_account: account.is_outgo_account,
      is_outgo_default: account.is_outgo_default,
      sort_order: account.sort_order,
    }
  }

  const categoryGroupsArray = Object.entries(SAMPLE_CATEGORY_GROUPS).map(([id, group]) => ({
    id,
    name: group.name,
    is_hidden: group.is_hidden,
    sort_order: group.sort_order,
  }))

  const accountGroupsArray = Object.entries(SAMPLE_ACCOUNT_GROUPS).map(([id, group]) => ({
    id,
    name: group.name,
    on_budget: group.on_budget,
    is_active: group.is_active,
    sort_order: group.sort_order,
  }))

  const categoriesData: Record<string, Record<string, unknown>> = {}
  for (const [id, category] of Object.entries(SAMPLE_CATEGORIES)) {
    categoriesData[id] = {
      name: category.name,
      category_group_id: category.category_group_id,
      is_hidden: category.is_hidden,
      sort_order: category.sort_order,
      default_monthly_amount: category.default_monthly_amount ?? null,
      default_monthly_type: category.default_monthly_type ?? null,
    }
  }

  const budgetDocument = {
    name: SAMPLE_BUDGET_NAME,
    owner_id: '__SYSTEM__',
    owner_email: 'system@sample.budget',
    user_ids: [],
    accepted_user_ids: [],
    percentage_income_months_back: 2,
    month_map: monthMap,
    accounts,
    account_groups: accountGroupsArray,
    categories: categoriesData,
    category_groups: categoryGroupsArray,
    migrated_at: timestamp,
    updated_at: timestamp,
  }

  const payees: Record<string, { name: string; category_id: string | null }> = {}
  SAMPLE_PAYEES.forEach((payee, index) => {
    const id = `payee_sample_${String(index + 1).padStart(3, '0')}`
    payees[id] = { name: payee.name, category_id: payee.category_id }
  })

  const payeesDocument = {
    budget_id: SAMPLE_BUDGET_ID,
    payees,
    updated_at: timestamp,
  }

  return { budgetDocument, payeesDocument }
}
