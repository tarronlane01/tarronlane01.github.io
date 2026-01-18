/**
 * Hidden Field Migration
 *
 * This migration:
 * 1. Adds is_hidden field to all existing accounts and categories (defaults to false)
 * 2. Creates a hidden account "Alerus 401K Eide Bailly" for historical 401K tracking
 * 3. Creates a hidden category "House" for historical house-related transactions
 * 4. Fixes specific adjustment transactions that have both NO_ACCOUNT and NO_CATEGORY
 */

import { useState } from 'react'
import type { MonthDocument, AdjustmentTransaction, FinancialAccount, Category, FirestoreData } from '@types'
import { isNoAccount, isNoCategory } from '@data/constants'
import { useMigrationProgress, type ProgressReporter } from './migrationProgress'
import { readAllBudgetsAndMonths, batchWriteBudgets, writeMonthUpdatesAndRecalculate, type BudgetUpdate, type MonthUpdate } from './migrationDataHelpers'
import type { HiddenFieldMigrationStatus, HiddenFieldMigrationResult, AdjustmentFixConfig } from './hiddenFieldMigrationTypes'

export type { HiddenFieldMigrationStatus, HiddenFieldMigrationResult } from './hiddenFieldMigrationTypes'

const ADJUSTMENTS_TO_FIX: AdjustmentFixConfig[] = [
  { id: 'adjustment_import_1767473622525_qzkq34i7r', amount: 14877.86, date: '2020-08-23', description: 'Starting Balance on app switchover', targetAccount: 'Alerus 401K Eide Bailly', targetCategory: null },
  { id: 'adjustment_import_1767473622530_nj6pnwlb2', amount: -2000, date: '2022-03-01', description: 'Transfer', targetAccount: null, targetCategory: 'House' },
]

export async function scanHiddenFieldStatus(): Promise<HiddenFieldMigrationStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('hidden-field-migration-scan')
  let accountsNeedingField = 0, categoriesNeedingField = 0, adjustmentsToFix = 0, totalMonths = 0
  const adjustmentDetails: HiddenFieldMigrationStatus['adjustmentDetails'] = []

  for (const budget of budgets) {
    const budgetData = budget.data
    const accounts = budgetData.accounts as Record<string, FirestoreData> | undefined
    if (accounts && typeof accounts === 'object') { for (const account of Object.values(accounts)) { if (account.is_hidden === undefined) accountsNeedingField++ } }
    const categories = budgetData.categories as Record<string, FirestoreData> | undefined
    if (categories && typeof categories === 'object') { for (const category of Object.values(categories)) { if (category.is_hidden === undefined) categoriesNeedingField++ } }

    const months = monthsByBudget.get(budget.id) || []
    totalMonths += months.length
    for (const month of months) {
      const monthData = month.data as unknown as MonthDocument
      const monthKey = `${monthData.year}-${String(monthData.month).padStart(2, '0')}`
      for (const adjustment of monthData.adjustments || []) {
        const hasNoAccount = isNoAccount(adjustment.account_id) || !adjustment.account_id
        const hasNoCategory = isNoCategory(adjustment.category_id) || !adjustment.category_id
        if (hasNoAccount && hasNoCategory) {
          adjustmentsToFix++
          adjustmentDetails.push({ monthKey, id: adjustment.id, description: adjustment.description || '', amount: adjustment.amount, accountId: adjustment.account_id, categoryId: adjustment.category_id })
        }
      }
    }
  }
  return { totalBudgets: budgets.length, totalMonths, accountsNeedingField, categoriesNeedingField, adjustmentsToFix, adjustmentDetails }
}

export async function runHiddenFieldMigration(progress: ProgressReporter): Promise<HiddenFieldMigrationResult> {
  const result: HiddenFieldMigrationResult = { budgetsProcessed: 0, accountsUpdated: 0, categoriesUpdated: 0, hiddenAccountsCreated: 0, hiddenCategoriesCreated: 0, adjustmentsFixed: 0, errors: [] }
  progress.setStage('Reading all budgets and months...'); progress.setProgress(null)
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('hidden-field-migration')
  progress.setDetails(`Found ${budgets.length} budget(s) to process`)

  const budgetUpdates: BudgetUpdate[] = []
  const monthUpdates: MonthUpdate[] = []
  progress.setStage('Processing budgets...')

  for (let i = 0; i < budgets.length; i++) {
    const budget = budgets[i]
    progress.updateItemProgress(i + 1, budgets.length, `Budget: ${budget.data.name || budget.id}`)

    try {
      const budgetData = { ...budget.data }
      let budgetNeedsUpdate = false
      const accounts = { ...(budgetData.accounts as Record<string, FinancialAccount> || {}) }
      const categories = { ...(budgetData.categories as Record<string, Category> || {}) }

      // Add is_hidden field to all accounts
      for (const [accountId, account] of Object.entries(accounts)) {
        if (account.is_hidden === undefined) { accounts[accountId] = { ...account, is_hidden: false }; result.accountsUpdated++; budgetNeedsUpdate = true }
      }

      // Add is_hidden field to all categories
      for (const [categoryId, category] of Object.entries(categories)) {
        if (category.is_hidden === undefined) { categories[categoryId] = { ...category, is_hidden: false }; result.categoriesUpdated++; budgetNeedsUpdate = true }
      }

      // Create hidden account "Alerus 401K Eide Bailly" if needed
      let alerusAccountId: string | null = null
      const alerusAccountName = 'Alerus 401K Eide Bailly'
      for (const [accountId, account] of Object.entries(accounts)) { if (account.nickname?.toLowerCase() === alerusAccountName.toLowerCase()) { alerusAccountId = accountId; break } }
      if (!alerusAccountId) {
        alerusAccountId = `account_hidden_${Date.now()}_alerus`
        const maxSortOrder = Math.max(0, ...Object.values(accounts).map(a => a.sort_order || 0))
        accounts[alerusAccountId] = { nickname: alerusAccountName, description: 'Historical 401K account (hidden)', balance: 0, account_group_id: 'ungrouped_accounts', sort_order: maxSortOrder + 1, is_income_account: false, is_income_default: false, is_outgo_account: false, is_outgo_default: false, on_budget: false, is_active: true, is_hidden: true }
        result.hiddenAccountsCreated++; budgetNeedsUpdate = true
      } else if (!accounts[alerusAccountId].is_hidden) { accounts[alerusAccountId] = { ...accounts[alerusAccountId], is_hidden: true }; budgetNeedsUpdate = true }

      // Create hidden category "House" if needed
      let houseCategoryId: string | null = null
      const houseCategoryName = 'House'
      for (const [categoryId, category] of Object.entries(categories)) { if (category.name?.toLowerCase() === houseCategoryName.toLowerCase()) { houseCategoryId = categoryId; break } }
      if (!houseCategoryId) {
        houseCategoryId = `category_hidden_${Date.now()}_house`
        const maxSortOrder = Math.max(0, ...Object.values(categories).map(c => c.sort_order || 0))
        categories[houseCategoryId] = { name: houseCategoryName, description: 'Historical house-related transactions (hidden)', category_group_id: 'ungrouped_categories', sort_order: maxSortOrder + 1, default_monthly_amount: 0, default_monthly_type: 'fixed', balance: 0, is_hidden: true }
        result.hiddenCategoriesCreated++; budgetNeedsUpdate = true
      } else if (!categories[houseCategoryId].is_hidden) { categories[houseCategoryId] = { ...categories[houseCategoryId], is_hidden: true }; budgetNeedsUpdate = true }

      // Fix adjustment transactions
      const months = monthsByBudget.get(budget.id) || []
      for (const month of months) {
        const monthData = month.data as unknown as MonthDocument
        let monthNeedsUpdate = false
        const updatedAdjustments: AdjustmentTransaction[] = (monthData.adjustments || []).map(adjustment => {
          const hasNoAccount = isNoAccount(adjustment.account_id) || !adjustment.account_id
          const hasNoCategory = isNoCategory(adjustment.category_id) || !adjustment.category_id
          if (hasNoAccount && hasNoCategory) {
            const knownFix = ADJUSTMENTS_TO_FIX.find(fix => fix.id === adjustment.id || (Math.abs(fix.amount - adjustment.amount) < 0.01 && fix.date === adjustment.date && fix.description.toLowerCase() === (adjustment.description || '').toLowerCase()))
            if (knownFix) {
              const updatedAdjustment = { ...adjustment }
              if (knownFix.targetAccount) updatedAdjustment.account_id = alerusAccountId!
              if (knownFix.targetCategory) updatedAdjustment.category_id = houseCategoryId!
              result.adjustmentsFixed++; monthNeedsUpdate = true
              return updatedAdjustment
            }
          }
          return adjustment
        })
        if (monthNeedsUpdate) { monthUpdates.push({ budgetId: budget.id, year: monthData.year, month: monthData.month, data: { ...monthData, adjustments: updatedAdjustments } }) }
      }

      if (budgetNeedsUpdate) {
        budgetUpdates.push({ budgetId: budget.id, data: { ...budgetData, accounts, categories, updated_at: new Date().toISOString() } })
        result.budgetsProcessed++
      }
    } catch (err) { result.errors.push(`Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`) }
  }

  if (budgetUpdates.length > 0) { progress.setStage('Writing budget updates...'); progress.setProgress(null); progress.setCurrentItem(`${budgetUpdates.length} budget(s) to update`); await batchWriteBudgets(budgetUpdates, 'hidden-field-migration') }
  if (monthUpdates.length > 0) { progress.setStage('Writing month updates and recalculating...'); progress.setCurrentItem(`${monthUpdates.length} month(s) to update`); await writeMonthUpdatesAndRecalculate(monthUpdates, 'hidden-field-migration') }
  progress.setStage('Migration complete'); progress.setProgress(100)
  return result
}

interface UseHiddenFieldMigrationOptions { currentUser: unknown }

export function useHiddenFieldMigration({ currentUser }: UseHiddenFieldMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<HiddenFieldMigrationStatus | null>(null)
  const [result, setResult] = useState<HiddenFieldMigrationResult | null>(null)
  const { runMigrationWithProgress } = useMigrationProgress()

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try { const scanResult = await scanHiddenFieldStatus(); setStatus(scanResult) }
    catch (err) { console.error('Failed to scan hidden field status:', err) }
    finally { setIsScanning(false) }
  }

  async function runMigrationHandler(): Promise<void> {
    if (!currentUser) return
    setIsRunning(true); setResult(null)
    try { const migrationResult = await runMigrationWithProgress('Hidden Field Migration', (progress) => runHiddenFieldMigration(progress)); setResult(migrationResult) }
    catch (err) { setResult({ budgetsProcessed: 0, accountsUpdated: 0, categoriesUpdated: 0, hiddenAccountsCreated: 0, hiddenCategoriesCreated: 0, adjustmentsFixed: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] }) }
    finally { setIsRunning(false) }
  }

  const needsMigration = status !== null && (status.accountsNeedingField > 0 || status.categoriesNeedingField > 0 || status.adjustmentsToFix > 0)
  const totalItemsToFix = status !== null ? (status.accountsNeedingField + status.categoriesNeedingField + status.adjustmentsToFix) : 0
  return { isScanning, isRunning, status, result, scanStatus, runMigration: runMigrationHandler, needsMigration, totalItemsToFix }
}
