/**
 * Precision Cleanup Runner
 *
 * Fixes currency precision issues by rounding all values to 2 decimal places.
 * Uses the migration data helpers for batch read/write and proper recalculation.
 */

import type { FirestoreData, IncomeTransaction, ExpenseTransaction, CategoryMonthBalance, AccountMonthBalance, MonthDocument } from '@types'
import { roundCurrency, needsPrecisionFix } from '@utils'
import type { PrecisionCleanupResult } from './precisionCleanupTypes'
import {
  readAllBudgetsAndMonths,
  batchWriteBudgets,
  recalculateAndWriteBudget,
  type BudgetReadResult,
  type MonthReadResult,
  type BudgetUpdate,
} from './migrationDataHelpers'

/**
 * Round all numeric values in a balance object
 */
function roundBalanceValues<T extends { start_balance?: number; end_balance?: number; allocated?: number; spent?: number; income?: number; expenses?: number; transfers?: number; adjustments?: number; net_change?: number }>(
  balance: T
): T {
  const result = { ...balance }
  if (result.start_balance !== undefined) result.start_balance = roundCurrency(result.start_balance)
  if (result.end_balance !== undefined) result.end_balance = roundCurrency(result.end_balance)
  if (result.allocated !== undefined) result.allocated = roundCurrency(result.allocated)
  if (result.spent !== undefined) result.spent = roundCurrency(result.spent)
  if (result.income !== undefined) result.income = roundCurrency(result.income)
  if (result.expenses !== undefined) result.expenses = roundCurrency(result.expenses)
  if (result.transfers !== undefined) result.transfers = roundCurrency(result.transfers)
  if (result.adjustments !== undefined) result.adjustments = roundCurrency(result.adjustments)
  if (result.net_change !== undefined) result.net_change = roundCurrency(result.net_change)
  return result
}

/**
 * Fix precision issues in budget data (in memory)
 */
function fixBudgetPrecision(
  data: FirestoreData,
  result: PrecisionCleanupResult
): { fixed: boolean; data: FirestoreData } {
  let needsUpdate = false

  // Fix total_available
  if (needsPrecisionFix(data.total_available ?? 0)) {
    data.total_available = roundCurrency(data.total_available ?? 0)
    result.totalAvailableFixed++
    needsUpdate = true
  }

  // Fix accounts
  const accounts = data.accounts as FirestoreData | undefined
  if (accounts && typeof accounts === 'object') {
    for (const [accId, account] of Object.entries(accounts)) {
      const acc = account as { balance?: number }
      if (needsPrecisionFix(acc.balance ?? 0)) {
        (accounts[accId] as { balance: number }).balance = roundCurrency(acc.balance ?? 0)
        result.accountsFixed++
        needsUpdate = true
      }
    }
  }

  // Fix categories
  const categories = data.categories as FirestoreData | undefined
  if (categories && typeof categories === 'object') {
    for (const [catId, category] of Object.entries(categories)) {
      const cat = category as { balance?: number; default_monthly_amount?: number }
      if (needsPrecisionFix(cat.balance ?? 0)) {
        (categories[catId] as { balance: number }).balance = roundCurrency(cat.balance ?? 0)
        result.categoriesFixed++
        needsUpdate = true
      }
      if (needsPrecisionFix(cat.default_monthly_amount ?? 0)) {
        (categories[catId] as { default_monthly_amount: number }).default_monthly_amount = roundCurrency(cat.default_monthly_amount ?? 0)
        result.categoriesFixed++
        needsUpdate = true
      }
    }
  }

  return { fixed: needsUpdate, data }
}

/**
 * Fix precision issues in a single month document (in memory)
 */
function fixMonthPrecision(
  data: FirestoreData,
  result: PrecisionCleanupResult
): { fixed: boolean; data: FirestoreData } {
  let needsUpdate = false

  // Fix totals
  if (needsPrecisionFix(data.total_income ?? 0)) {
    data.total_income = roundCurrency(data.total_income ?? 0)
    needsUpdate = true
  }
  if (needsPrecisionFix(data.total_expenses ?? 0)) {
    data.total_expenses = roundCurrency(data.total_expenses ?? 0)
    needsUpdate = true
  }
  if (needsPrecisionFix(data.previous_month_income ?? 0)) {
    data.previous_month_income = roundCurrency(data.previous_month_income ?? 0)
    needsUpdate = true
  }

  // Fix income transactions
  if (data.income && Array.isArray(data.income)) {
    const updatedIncome: IncomeTransaction[] = []
    for (const inc of data.income) {
      if (needsPrecisionFix(inc.amount ?? 0)) {
        updatedIncome.push({ ...inc, amount: roundCurrency(inc.amount ?? 0) })
        result.incomeValuesFixed++
        needsUpdate = true
      } else {
        updatedIncome.push(inc)
      }
    }
    data.income = updatedIncome
  }

  // Fix expense transactions
  if (data.expenses && Array.isArray(data.expenses)) {
    const updatedExpenses: ExpenseTransaction[] = []
    for (const exp of data.expenses) {
      if (needsPrecisionFix(exp.amount ?? 0)) {
        updatedExpenses.push({ ...exp, amount: roundCurrency(exp.amount ?? 0) })
        result.expenseValuesFixed++
        needsUpdate = true
      } else {
        updatedExpenses.push(exp)
      }
    }
    data.expenses = updatedExpenses
  }

  // Fix category balances
  if (data.category_balances && Array.isArray(data.category_balances)) {
    const updatedBalances: CategoryMonthBalance[] = []
    for (const cb of data.category_balances) {
      const hasIssue = needsPrecisionFix(cb.start_balance ?? 0) ||
        needsPrecisionFix(cb.end_balance ?? 0) ||
        needsPrecisionFix(cb.allocated ?? 0) ||
        needsPrecisionFix(cb.spent ?? 0) ||
        needsPrecisionFix(cb.transfers ?? 0) ||
        needsPrecisionFix(cb.adjustments ?? 0)
      if (hasIssue) {
        updatedBalances.push(roundBalanceValues(cb))
        result.categoryBalancesFixed++
        needsUpdate = true
      } else {
        updatedBalances.push(cb)
      }
    }
    data.category_balances = updatedBalances
  }

  // Fix account balances
  if (data.account_balances && Array.isArray(data.account_balances)) {
    const updatedBalances: AccountMonthBalance[] = []
    for (const ab of data.account_balances) {
      const hasIssue = needsPrecisionFix(ab.start_balance ?? 0) ||
        needsPrecisionFix(ab.end_balance ?? 0) ||
        needsPrecisionFix(ab.income ?? 0) ||
        needsPrecisionFix(ab.expenses ?? 0) ||
        needsPrecisionFix(ab.transfers ?? 0) ||
        needsPrecisionFix(ab.adjustments ?? 0) ||
        needsPrecisionFix(ab.net_change ?? 0)
      if (hasIssue) {
        updatedBalances.push(roundBalanceValues(ab))
        result.accountBalancesFixed++
        needsUpdate = true
      } else {
        updatedBalances.push(ab)
      }
    }
    data.account_balances = updatedBalances
  }

  return { fixed: needsUpdate, data }
}

/**
 * Process a single budget and its months for precision issues.
 * Returns budget update and fixed month documents.
 */
function processBudgetForPrecision(
  budget: BudgetReadResult,
  months: MonthReadResult[],
  result: PrecisionCleanupResult
): {
  budgetUpdate: BudgetUpdate | null
  fixedMonths: MonthDocument[]
  hasMonthFixes: boolean
} {
  // Fix budget precision
  const budgetData = { ...budget.data }
  const { fixed: budgetFixed, data: fixedBudgetData } = fixBudgetPrecision(budgetData, result)

  const budgetUpdate: BudgetUpdate | null = budgetFixed
    ? { budgetId: budget.id, data: fixedBudgetData }
    : null

  if (budgetFixed) {
    result.budgetsProcessed++
  }

  // Fix month precision - process all months in memory
  const fixedMonths: MonthDocument[] = []
  let hasMonthFixes = false

  for (const monthRead of months) {
    const monthData = { ...monthRead.data }
    const { fixed: monthFixed, data: fixedMonthData } = fixMonthPrecision(monthData, result)

    if (monthFixed) {
      result.monthsProcessed++
      hasMonthFixes = true
    }

    // Always keep the month for recalculation (even if not fixed, balances might cascade)
    fixedMonths.push(fixedMonthData as unknown as MonthDocument)
  }

  return { budgetUpdate, fixedMonths, hasMonthFixes }
}

/**
 * Run the precision cleanup on all budgets and months.
 *
 * Uses migration framework patterns:
 * 1. BATCH READ: Reads all budgets and months in 2 queries
 * 2. PROCESS IN MEMORY: Fixes precision issues without database calls
 * 3. BATCH WRITE: Writes all updates in batches
 * 4. RECALCULATE: Properly recalculates and clears needs_recalculation flags
 */
export async function runPrecisionCleanup(): Promise<PrecisionCleanupResult> {
  const result: PrecisionCleanupResult = {
    budgetsProcessed: 0,
    accountsFixed: 0,
    categoriesFixed: 0,
    totalAvailableFixed: 0,
    monthsProcessed: 0,
    incomeValuesFixed: 0,
    expenseValuesFixed: 0,
    categoryBalancesFixed: 0,
    accountBalancesFixed: 0,
    errors: [],
  }

  // ========================================
  // STEP 1: BATCH READ all budgets and months
  // ========================================
  const { budgets, monthsByBudget } = await readAllBudgetsAndMonths('precision cleanup')

  // ========================================
  // STEP 2: PROCESS all data in memory
  // ========================================
  const budgetUpdates: BudgetUpdate[] = []
  const budgetsWithMonthFixes: Array<{ budgetId: string; months: MonthDocument[] }> = []

  for (const budget of budgets) {
    try {
      const months = monthsByBudget.get(budget.id) || []
      const { budgetUpdate, fixedMonths, hasMonthFixes } = processBudgetForPrecision(budget, months, result)

      if (budgetUpdate) {
        budgetUpdates.push(budgetUpdate)
      }

      // Track budgets that need month writes and recalculation
      if (hasMonthFixes || fixedMonths.length > 0) {
        budgetsWithMonthFixes.push({ budgetId: budget.id, months: fixedMonths })
      }
    } catch (err) {
      result.errors.push(`Budget ${budget.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ========================================
  // STEP 3: BATCH WRITE budget updates
  // ========================================
  if (budgetUpdates.length > 0) {
    try {
      await batchWriteBudgets(budgetUpdates, 'precision cleanup')
    } catch (err) {
      result.errors.push(`Budget batch write: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ========================================
  // STEP 4: BATCH WRITE months and RECALCULATE each budget
  // This properly handles needs_recalculation flags
  // ========================================
  for (const { budgetId, months } of budgetsWithMonthFixes) {
    try {
      // recalculateAndWriteBudget handles:
      // 1. Batch writing all months
      // 2. Recalculating running balances
      // 3. Updating budget with final balances
      // 4. Clearing all needs_recalculation flags
      await recalculateAndWriteBudget(budgetId, months, 'precision cleanup')
    } catch (err) {
      result.errors.push(`Budget ${budgetId} recalc: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // NOTE: Cache clearing is handled by the migration framework (runMigration)
  // All migrations automatically clear caches after completion

  return result
}
