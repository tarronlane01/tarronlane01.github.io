/**
 * Sample Budget Definition
 * 
 * Static data for the sample budget. This defines accounts, categories, etc.
 * Edit this file to change what the sample budget contains.
 * 
 * The month data is in sampleBudgetMonths.ts with relative month offsets.
 */

import { SAMPLE_BUDGET_ID, SAMPLE_BUDGET_NAME } from '../constants'

export const SAMPLE_BUDGET_OWNER_ID = 'sample_user_id_123'
export const SAMPLE_BUDGET_OWNER_EMAIL = 'sample@example.com'

export interface SampleAccount {
  nickname: string
  description: string
  initialBalance: number
  account_group_id: string
  on_budget: boolean
  is_active: boolean
  is_income_account: boolean
  is_income_default: boolean
  is_outgo_account: boolean
  is_outgo_default: boolean
  sort_order: number
}

export interface SampleCategory {
  name: string
  category_group_id: string
  is_hidden: boolean
  sort_order: number
  default_monthly_amount?: number
  default_monthly_type?: 'fixed' | 'percentage'
}

export interface SampleCategoryGroup {
  name: string
  is_hidden: boolean
  sort_order: number
}

export interface SampleAccountGroup {
  name: string
  on_budget: null
  is_active: null
  sort_order: number
}

export interface SamplePayee {
  name: string
  category_id: string | null
}

export const SAMPLE_ACCOUNTS: Record<string, SampleAccount> = {
  account_main_checking: {
    nickname: 'Main Checking',
    description: 'Primary checking account for daily expenses',
    initialBalance: 5000,
    account_group_id: 'account_group_checking',
    on_budget: true,
    is_active: true,
    is_income_account: true,
    is_income_default: true,
    is_outgo_account: true,
    is_outgo_default: false,
    sort_order: 0,
  },
  account_emergency_fund: {
    nickname: 'Emergency Fund',
    description: '6-month emergency savings',
    initialBalance: 10000,
    account_group_id: 'account_group_savings',
    on_budget: true,
    is_active: true,
    is_income_account: false,
    is_income_default: false,
    is_outgo_account: false,
    is_outgo_default: false,
    sort_order: 0,
  },
  account_vacation_fund: {
    nickname: 'Vacation Fund',
    description: 'Saving for trips and travel',
    initialBalance: 2500,
    account_group_id: 'account_group_savings',
    on_budget: true,
    is_active: true,
    is_income_account: false,
    is_income_default: false,
    is_outgo_account: false,
    is_outgo_default: false,
    sort_order: 1,
  },
  account_credit_card: {
    nickname: 'Rewards Credit Card',
    description: 'Primary credit card for purchases',
    initialBalance: -1200,
    account_group_id: 'account_group_credit_cards',
    on_budget: true,
    is_active: true,
    is_income_account: false,
    is_income_default: false,
    is_outgo_account: true,
    is_outgo_default: true,
    sort_order: 0,
  },
  account_401k: {
    nickname: '401K Retirement',
    description: 'Employer retirement account',
    initialBalance: 45000,
    account_group_id: 'account_group_retirement',
    on_budget: false,
    is_active: true,
    is_income_account: false,
    is_income_default: false,
    is_outgo_account: false,
    is_outgo_default: false,
    sort_order: 0,
  },
}

export const SAMPLE_CATEGORIES: Record<string, SampleCategory> = {
  category_rent: { name: 'Rent', category_group_id: 'group_housing', is_hidden: false, sort_order: 0, default_monthly_amount: 1500, default_monthly_type: 'fixed' },
  category_utilities: { name: 'Utilities', category_group_id: 'group_housing', is_hidden: false, sort_order: 1, default_monthly_amount: 150, default_monthly_type: 'fixed' },
  category_groceries: { name: 'Groceries', category_group_id: 'group_essentials', is_hidden: false, sort_order: 0, default_monthly_amount: 550, default_monthly_type: 'fixed' },
  category_transportation: { name: 'Transportation', category_group_id: 'group_essentials', is_hidden: false, sort_order: 1, default_monthly_amount: 120, default_monthly_type: 'fixed' },
  category_subscriptions: { name: 'Subscriptions', category_group_id: 'group_essentials', is_hidden: false, sort_order: 2, default_monthly_amount: 30, default_monthly_type: 'fixed' },
  category_phone_internet: { name: 'Phone & Internet', category_group_id: 'group_essentials', is_hidden: false, sort_order: 3, default_monthly_amount: 120, default_monthly_type: 'fixed' },
  category_entertainment: { name: 'Entertainment', category_group_id: 'group_lifestyle', is_hidden: false, sort_order: 0, default_monthly_amount: 1, default_monthly_type: 'percentage' },
  category_dining_out: { name: 'Dining Out', category_group_id: 'group_lifestyle', is_hidden: false, sort_order: 1, default_monthly_amount: 100, default_monthly_type: 'fixed' },
  category_personal: { name: 'Personal', category_group_id: 'group_lifestyle', is_hidden: false, sort_order: 2, default_monthly_amount: 75, default_monthly_type: 'fixed' },
  category_clothing: { name: 'Clothing', category_group_id: 'group_lifestyle', is_hidden: false, sort_order: 3, default_monthly_amount: 100, default_monthly_type: 'fixed' },
}

export const SAMPLE_CATEGORY_GROUPS: Record<string, SampleCategoryGroup> = {
  group_housing: { name: 'Housing', is_hidden: false, sort_order: 0 },
  group_essentials: { name: 'Essentials', is_hidden: false, sort_order: 1 },
  group_lifestyle: { name: 'Lifestyle', is_hidden: false, sort_order: 2 },
}

export const SAMPLE_ACCOUNT_GROUPS: Record<string, SampleAccountGroup> = {
  account_group_checking: { name: 'Checking', on_budget: null, is_active: null, sort_order: 0 },
  account_group_savings: { name: 'Savings', on_budget: null, is_active: null, sort_order: 1 },
  account_group_credit_cards: { name: 'Credit Cards', on_budget: null, is_active: null, sort_order: 2 },
  account_group_retirement: { name: 'Retirement', on_budget: null, is_active: null, sort_order: 3 },
  ungrouped_accounts: { name: 'Ungrouped', on_budget: null, is_active: null, sort_order: 999 },
}

export const SAMPLE_PAYEES: SamplePayee[] = [
  { name: 'ABC Corp', category_id: null },
  { name: 'Side Gig Client', category_id: null },
  { name: 'Interest', category_id: null },
  { name: 'Landlord', category_id: 'category_rent' },
  { name: 'Electric Company', category_id: 'category_utilities' },
  { name: 'Water Utility', category_id: 'category_utilities' },
  { name: 'Grocery Mart', category_id: 'category_groceries' },
  { name: 'Costco', category_id: 'category_groceries' },
  { name: 'Shell Gas', category_id: 'category_transportation' },
  { name: 'Netflix', category_id: 'category_subscriptions' },
  { name: 'Spotify', category_id: 'category_subscriptions' },
  { name: 'AT&T', category_id: 'category_phone_internet' },
  { name: 'Comcast', category_id: 'category_phone_internet' },
  { name: 'Movie Theater', category_id: 'category_entertainment' },
  { name: 'Local Restaurant', category_id: 'category_dining_out' },
  { name: 'Coffee Shop', category_id: 'category_dining_out' },
  { name: 'Amazon', category_id: 'category_personal' },
  { name: 'Target', category_id: 'category_clothing' },
]

export { SAMPLE_BUDGET_ID, SAMPLE_BUDGET_NAME }
