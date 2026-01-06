/**
 * Expense to Adjustment Migration Hook
 *
 * Migrates expense entries that have NO_CATEGORY_ID or NO_ACCOUNT_ID to the
 * new adjustments array. Also fixes invalid account/category IDs like "unknown"
 * by converting them to NO_ACCOUNT_ID/NO_CATEGORY_ID.
 *
 * This migration is needed because:
 * 1. Spend tab now requires real accounts AND categories
 * 2. No Account / No Category selections are only available on Adjustments tab
 * 3. Existing data may have expenses with these special IDs that need to be moved
 */

import { useState } from 'react'
import type { MonthDocument, ExpenseTransaction, AdjustmentTransaction } from '@types'
import { NO_ACCOUNT_ID, NO_CATEGORY_ID, isNoAccount, isNoCategory } from '@data/constants'
import {
  runMigration,
  readAllBudgetsAndMonths,
  type MonthUpdate,
  type MonthReadResult,
  type MigrationResultBase,
} from './index'
import { batchWriteMonths } from './migrationDataHelpers'
import { retotalMonth } from '@data/mutations/month/retotalMonth'

// ============================================================================
// TYPES
// ============================================================================

export interface ExpenseToAdjustmentStatus {
  totalBudgets: number
  totalMonths: number
  expensesToMigrate: number
  invalidAccountsToFix: number
  invalidCategoriesToFix: number
}

export interface ExpenseToAdjustmentResult extends MigrationResultBase {
  budgetsProcessed: number
  monthsProcessed: number
  expensesMigrated: number
  invalidAccountsFixed: number
  invalidCategoriesFixed: number
}

// List of invalid account ID values to convert to NO_ACCOUNT_ID
const INVALID_ACCOUNT_IDS = ['unknown', 'Unknown', 'UNKNOWN', '', 'null', 'undefined', 'N/A', 'n/a']

// List of invalid category ID values to convert to NO_CATEGORY_ID
const INVALID_CATEGORY_IDS = ['unknown', 'Unknown', 'UNKNOWN', '', 'null', 'undefined', 'N/A', 'n/a']

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an account ID should be treated as "no account"
 */
function shouldBeNoAccount(accountId: string | null | undefined): boolean {
  if (!accountId) return true
  if (isNoAccount(accountId)) return true
  return INVALID_ACCOUNT_IDS.includes(accountId)
}

/**
 * Check if a category ID should be treated as "no category"
 */
function shouldBeNoCategory(categoryId: string | null | undefined): boolean {
  if (!categoryId) return true
  if (isNoCategory(categoryId)) return true
  return INVALID_CATEGORY_IDS.includes(categoryId)
}

/**
 * Check if an expense should be migrated to adjustments
 */
function shouldMigrateToAdjustment(expense: ExpenseTransaction): boolean {
  return shouldBeNoAccount(expense.account_id) || shouldBeNoCategory(expense.category_id)
}

/**
 * Convert an expense to an adjustment transaction
 */
function expenseToAdjustment(expense: ExpenseTransaction): AdjustmentTransaction {
  return {
    id: expense.id.replace('expense_', 'adjustment_'),
    amount: expense.amount,
    account_id: shouldBeNoAccount(expense.account_id) ? NO_ACCOUNT_ID : expense.account_id,
    category_id: shouldBeNoCategory(expense.category_id) ? NO_CATEGORY_ID : expense.category_id,
    date: expense.date,
    description: expense.description || expense.payee, // Use payee as description if no description
    cleared: expense.cleared,
    created_at: expense.created_at,
  }
}

/**
 * Process a month and return updated data if changes are needed
 */
function processMonth(monthData: MonthReadResult): {
  needsUpdate: boolean
  updatedMonth: MonthDocument | null
  stats: {
    expensesMigrated: number
    invalidAccountsFixed: number
    invalidCategoriesFixed: number
  }
} {
  const month = monthData.data as unknown as MonthDocument
  const expenses = month.expenses || []
  const existingAdjustments = month.adjustments || []

  const expensesToKeep: ExpenseTransaction[] = []
  const newAdjustments: AdjustmentTransaction[] = []
  let invalidAccountsFixed = 0
  let invalidCategoriesFixed = 0

  for (const expense of expenses) {
    if (shouldMigrateToAdjustment(expense)) {
      // Track what we're fixing
      if (shouldBeNoAccount(expense.account_id) && !isNoAccount(expense.account_id)) {
        invalidAccountsFixed++
      }
      if (shouldBeNoCategory(expense.category_id) && !isNoCategory(expense.category_id)) {
        invalidCategoriesFixed++
      }
      // Convert to adjustment
      newAdjustments.push(expenseToAdjustment(expense))
    } else {
      expensesToKeep.push(expense)
    }
  }

  if (newAdjustments.length === 0) {
    return {
      needsUpdate: false,
      updatedMonth: null,
      stats: { expensesMigrated: 0, invalidAccountsFixed: 0, invalidCategoriesFixed: 0 },
    }
  }

  // Create updated month with moved expenses
  // IMPORTANT: Must call retotalMonth to recalculate category balances (spent field)
  // after removing expenses and adding adjustments. Otherwise the old spent values
  // remain and get double-counted with the new adjustments.
  const updatedMonth = retotalMonth({
    ...month,
    expenses: expensesToKeep,
    adjustments: [...existingAdjustments, ...newAdjustments],
    transfers: month.transfers || [], // Ensure transfers array exists
    updated_at: new Date().toISOString(),
  })

  return {
    needsUpdate: true,
    updatedMonth,
    stats: {
      expensesMigrated: newAdjustments.length,
      invalidAccountsFixed,
      invalidCategoriesFixed,
    },
  }
}

// ============================================================================
// SCAN FUNCTION
// ============================================================================

async function scanForMigration(): Promise<ExpenseToAdjustmentStatus> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('expense-to-adjustment-scan')

  let totalMonths = 0
  let expensesToMigrate = 0
  let invalidAccountsToFix = 0
  let invalidCategoriesToFix = 0

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []
    totalMonths += months.length

    for (const monthData of months) {
      const month = monthData.data as unknown as MonthDocument
      const expenses = month.expenses || []

      for (const expense of expenses) {
        if (shouldMigrateToAdjustment(expense)) {
          expensesToMigrate++
          if (shouldBeNoAccount(expense.account_id) && !isNoAccount(expense.account_id)) {
            invalidAccountsToFix++
          }
          if (shouldBeNoCategory(expense.category_id) && !isNoCategory(expense.category_id)) {
            invalidCategoriesToFix++
          }
        }
      }
    }
  }

  return {
    totalBudgets: budgets.length,
    totalMonths,
    expensesToMigrate,
    invalidAccountsToFix,
    invalidCategoriesToFix,
  }
}

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

async function runExpenseToAdjustmentMigration(): Promise<ExpenseToAdjustmentResult> {
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('expense-to-adjustment-migration')

  const monthUpdates: MonthUpdate[] = []
  let totalExpensesMigrated = 0
  let totalInvalidAccountsFixed = 0
  let totalInvalidCategoriesFixed = 0
  const errors: string[] = []

  for (const budget of budgets) {
    const months = monthsByBudget.get(budget.id) || []

    for (const monthData of months) {
      try {
        const { needsUpdate, updatedMonth, stats } = processMonth(monthData)

        if (needsUpdate && updatedMonth) {
          monthUpdates.push({
            budgetId: budget.id,
            year: monthData.year,
            month: monthData.month,
            data: updatedMonth,
          })
          totalExpensesMigrated += stats.expensesMigrated
          totalInvalidAccountsFixed += stats.invalidAccountsFixed
          totalInvalidCategoriesFixed += stats.invalidCategoriesFixed
        }
      } catch (err) {
        errors.push(`Month ${monthData.year}/${monthData.month} in budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Batch write all updated months
  if (monthUpdates.length > 0) {
    await batchWriteMonths(monthUpdates, 'expense-to-adjustment-migration')
  }

  return {
    budgetsProcessed: budgets.length,
    monthsProcessed: monthUpdates.length,
    expensesMigrated: totalExpensesMigrated,
    invalidAccountsFixed: totalInvalidAccountsFixed,
    invalidCategoriesFixed: totalInvalidCategoriesFixed,
    errors,
  }
}

// ============================================================================
// HOOK
// ============================================================================

interface UseExpenseToAdjustmentMigrationOptions {
  currentUser: unknown
  onComplete?: () => void
}

export function useExpenseToAdjustmentMigration({ currentUser, onComplete }: UseExpenseToAdjustmentMigrationOptions) {
  const [isScanning, setIsScanning] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState<ExpenseToAdjustmentStatus | null>(null)
  const [result, setResult] = useState<ExpenseToAdjustmentResult | null>(null)

  async function scanStatus(): Promise<void> {
    if (!currentUser) return

    setIsScanning(true)

    try {
      const scanResult = await scanForMigration()
      setStatus(scanResult)
    } catch (err) {
      console.error('Failed to scan for expense to adjustment migration:', err)
    } finally {
      setIsScanning(false)
    }
  }

  async function runMigrationAction(): Promise<void> {
    if (!currentUser) return

    setIsRunning(true)
    setResult(null)

    try {
      const migrationResult = await runMigration(() => runExpenseToAdjustmentMigration())
      setResult(migrationResult)
      onComplete?.()
    } catch (err) {
      setResult({
        budgetsProcessed: 0,
        monthsProcessed: 0,
        expensesMigrated: 0,
        invalidAccountsFixed: 0,
        invalidCategoriesFixed: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      })
    } finally {
      setIsRunning(false)
    }
  }

  // Computed properties
  const hasItemsToMigrate = status !== null && status.expensesToMigrate > 0

  return {
    // Status
    status,
    isScanning,
    scanStatus,
    hasItemsToMigrate,
    // Migration
    isRunning,
    result,
    runMigration: runMigrationAction,
  }
}

