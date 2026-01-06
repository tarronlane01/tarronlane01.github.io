/**
 * Orphaned ID Cleanup Migration Hook
 *
 * Finds and fixes transactions with category/account IDs that don't exist
 * in the budget's actual categories/accounts. Converts orphaned IDs to
 * NO_CATEGORY_ID/NO_ACCOUNT_ID so they can be handled properly.
 */

import { useState } from 'react'
import type { MonthDocument, ExpenseTransaction, IncomeTransaction, TransferTransaction, AdjustmentTransaction, BudgetCategory, FinancialAccount } from '@types'
import { NO_ACCOUNT_ID, NO_CATEGORY_ID, isNoAccount, isNoCategory } from '@data/constants'
import { runMigration, readAllBudgetsAndMonths, type MonthUpdate, type MonthReadResult, type BudgetReadResult } from './index'
import { batchWriteMonths } from './migrationDataHelpers'
import type { OrphanedIdCleanupStatus, OrphanedIdCleanupResult, BudgetLookups, ProcessMonthStats } from './orphanedIdCleanupTypes'

export type { OrphanedIdCleanupStatus, OrphanedIdCleanupResult } from './orphanedIdCleanupTypes'

function extractBudgetLookups(budgetData: BudgetReadResult['data']): BudgetLookups {
  const categoryIds = new Set<string>()
  const accountIds = new Set<string>()
  const categories = budgetData.categories as Record<string, BudgetCategory> | undefined
  if (categories) { for (const categoryId of Object.keys(categories)) { categoryIds.add(categoryId) } }
  const accounts = budgetData.accounts as Record<string, FinancialAccount> | undefined
  if (accounts) { for (const accountId of Object.keys(accounts)) { accountIds.add(accountId) } }
  return { categoryIds, accountIds }
}

function isOrphanedCategory(categoryId: string | null | undefined, validIds: Set<string>): boolean {
  if (!categoryId) return false
  if (isNoCategory(categoryId)) return false
  return !validIds.has(categoryId)
}

function isOrphanedAccount(accountId: string | null | undefined, validIds: Set<string>): boolean {
  if (!accountId) return false
  if (isNoAccount(accountId)) return false
  return !validIds.has(accountId)
}

function processMonth(monthData: MonthReadResult, lookups: BudgetLookups): { needsUpdate: boolean; updatedMonth: MonthDocument | null; stats: ProcessMonthStats } {
  const month = monthData.data as unknown as MonthDocument
  let categoryIdsFixed = 0, accountIdsFixed = 0, affectedExpenses = 0, affectedIncome = 0, affectedTransfers = 0, affectedAdjustments = 0, needsUpdate = false

  const fixedExpenses: ExpenseTransaction[] = (month.expenses || []).map(expense => {
    const fixed = { ...expense }
    let expenseModified = false
    if (isOrphanedCategory(expense.category_id, lookups.categoryIds)) { fixed.category_id = NO_CATEGORY_ID; categoryIdsFixed++; expenseModified = true }
    if (isOrphanedAccount(expense.account_id, lookups.accountIds)) { fixed.account_id = NO_ACCOUNT_ID; accountIdsFixed++; expenseModified = true }
    if (expenseModified) { affectedExpenses++; needsUpdate = true }
    return fixed
  })

  const fixedIncome: IncomeTransaction[] = (month.income || []).map(income => {
    const fixed = { ...income }
    let incomeModified = false
    if (isOrphanedAccount(income.account_id, lookups.accountIds)) { fixed.account_id = NO_ACCOUNT_ID; accountIdsFixed++; incomeModified = true }
    if (incomeModified) { affectedIncome++; needsUpdate = true }
    return fixed
  })

  const fixedTransfers: TransferTransaction[] = (month.transfers || []).map(transfer => {
    const fixed = { ...transfer }
    let transferModified = false
    if (isOrphanedCategory(transfer.from_category_id, lookups.categoryIds)) { fixed.from_category_id = NO_CATEGORY_ID; categoryIdsFixed++; transferModified = true }
    if (isOrphanedCategory(transfer.to_category_id, lookups.categoryIds)) { fixed.to_category_id = NO_CATEGORY_ID; categoryIdsFixed++; transferModified = true }
    if (isOrphanedAccount(transfer.from_account_id, lookups.accountIds)) { fixed.from_account_id = NO_ACCOUNT_ID; accountIdsFixed++; transferModified = true }
    if (isOrphanedAccount(transfer.to_account_id, lookups.accountIds)) { fixed.to_account_id = NO_ACCOUNT_ID; accountIdsFixed++; transferModified = true }
    if (transferModified) { affectedTransfers++; needsUpdate = true }
    return fixed
  })

  const fixedAdjustments: AdjustmentTransaction[] = (month.adjustments || []).map(adjustment => {
    const fixed = { ...adjustment }
    let adjustmentModified = false
    if (isOrphanedCategory(adjustment.category_id, lookups.categoryIds)) { fixed.category_id = NO_CATEGORY_ID; categoryIdsFixed++; adjustmentModified = true }
    if (isOrphanedAccount(adjustment.account_id, lookups.accountIds)) { fixed.account_id = NO_ACCOUNT_ID; accountIdsFixed++; adjustmentModified = true }
    if (adjustmentModified) { affectedAdjustments++; needsUpdate = true }
    return fixed
  })

  if (!needsUpdate) return { needsUpdate: false, updatedMonth: null, stats: { categoryIdsFixed: 0, accountIdsFixed: 0, affectedExpenses: 0, affectedIncome: 0, affectedTransfers: 0, affectedAdjustments: 0 } }

  const updatedMonth: MonthDocument = { ...month, expenses: fixedExpenses, income: fixedIncome, transfers: fixedTransfers, adjustments: fixedAdjustments, updated_at: new Date().toISOString() }
  return { needsUpdate: true, updatedMonth, stats: { categoryIdsFixed, accountIdsFixed, affectedExpenses, affectedIncome, affectedTransfers, affectedAdjustments } }
}

async function scanForOrphanedIds(): Promise<OrphanedIdCleanupStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('orphaned-id-scan')
  let totalMonths = 0, orphanedCategoryIds = 0, orphanedAccountIds = 0, affectedExpenses = 0, affectedIncome = 0, affectedTransfers = 0, affectedAdjustments = 0

  for (const budget of budgets) {
    const lookups = extractBudgetLookups(budget.data)
    const months = monthsByBudget.get(budget.id) || []
    totalMonths += months.length

    for (const monthData of months) {
      const month = monthData.data as unknown as MonthDocument
      for (const expense of month.expenses || []) {
        let hasOrphan = false
        if (isOrphanedCategory(expense.category_id, lookups.categoryIds)) { orphanedCategoryIds++; hasOrphan = true }
        if (isOrphanedAccount(expense.account_id, lookups.accountIds)) { orphanedAccountIds++; hasOrphan = true }
        if (hasOrphan) affectedExpenses++
      }
      for (const income of month.income || []) {
        if (isOrphanedAccount(income.account_id, lookups.accountIds)) { orphanedAccountIds++; affectedIncome++ }
      }
      for (const transfer of month.transfers || []) {
        let hasOrphan = false
        if (isOrphanedCategory(transfer.from_category_id, lookups.categoryIds)) { orphanedCategoryIds++; hasOrphan = true }
        if (isOrphanedCategory(transfer.to_category_id, lookups.categoryIds)) { orphanedCategoryIds++; hasOrphan = true }
        if (isOrphanedAccount(transfer.from_account_id, lookups.accountIds)) { orphanedAccountIds++; hasOrphan = true }
        if (isOrphanedAccount(transfer.to_account_id, lookups.accountIds)) { orphanedAccountIds++; hasOrphan = true }
        if (hasOrphan) affectedTransfers++
      }
      for (const adjustment of month.adjustments || []) {
        let hasOrphan = false
        if (isOrphanedCategory(adjustment.category_id, lookups.categoryIds)) { orphanedCategoryIds++; hasOrphan = true }
        if (isOrphanedAccount(adjustment.account_id, lookups.accountIds)) { orphanedAccountIds++; hasOrphan = true }
        if (hasOrphan) affectedAdjustments++
      }
    }
  }
  return { totalBudgets: budgets.length, totalMonths, orphanedCategoryIds, orphanedAccountIds, affectedExpenses, affectedIncome, affectedTransfers, affectedAdjustments }
}

async function runOrphanedIdCleanup(): Promise<OrphanedIdCleanupResult> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('orphaned-id-cleanup')
  const monthUpdates: MonthUpdate[] = []
  let totalCategoryIdsFixed = 0, totalAccountIdsFixed = 0
  const errors: string[] = []

  for (const budget of budgets) {
    const lookups = extractBudgetLookups(budget.data)
    const months = monthsByBudget.get(budget.id) || []
    for (const monthData of months) {
      try {
        const { needsUpdate, updatedMonth, stats } = processMonth(monthData, lookups)
        if (needsUpdate && updatedMonth) {
          monthUpdates.push({ budgetId: budget.id, year: monthData.year, month: monthData.month, data: updatedMonth })
          totalCategoryIdsFixed += stats.categoryIdsFixed
          totalAccountIdsFixed += stats.accountIdsFixed
        }
      } catch (err) { errors.push(`Month ${monthData.year}/${monthData.month} in budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`) }
    }
  }

  if (monthUpdates.length > 0) { await batchWriteMonths(monthUpdates, 'orphaned-id-cleanup') }
  return { budgetsProcessed: budgets.length, monthsProcessed: monthUpdates.length, categoryIdsFixed: totalCategoryIdsFixed, accountIdsFixed: totalAccountIdsFixed, errors }
}

interface UseOrphanedIdCleanupOptions { currentUser: unknown; onComplete?: () => void }

export function useOrphanedIdCleanup({ currentUser, onComplete }: UseOrphanedIdCleanupOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<OrphanedIdCleanupStatus | null>(null)
  const [result, setResult] = useState<OrphanedIdCleanupResult | null>(null)

  async function scanStatus(): Promise<void> {
    if (!currentUser) return
    setIsScanning(true)
    try { const scanResult = await scanForOrphanedIds(); setStatus(scanResult) }
    catch (err) { console.error('Failed to scan for orphaned IDs:', err) }
    finally { setIsScanning(false) }
  }

  async function runMigrationAction(): Promise<void> {
    if (!currentUser) return
    setIsRunning(true); setResult(null)
    try { const migrationResult = await runMigration(() => runOrphanedIdCleanup()); setResult(migrationResult); onComplete?.() }
    catch (err) { setResult({ budgetsProcessed: 0, monthsProcessed: 0, categoryIdsFixed: 0, accountIdsFixed: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] }) }
    finally { setIsRunning(false) }
  }

  const hasItemsToFix = status !== null && (status.orphanedCategoryIds > 0 || status.orphanedAccountIds > 0)
  return { status, isScanning, scanStatus, hasItemsToFix, isRunning, result, runMigration: runMigrationAction }
}
