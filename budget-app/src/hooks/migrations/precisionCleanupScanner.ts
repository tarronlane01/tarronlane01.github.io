/**
 * Precision Cleanup Scanner
 *
 * Scans the database to identify currency values with precision issues
 * (more than 2 decimal places).
 */

// eslint-disable-next-line no-restricted-imports
import { queryCollection } from '@firestore'
import type { FirestoreData } from '@types'
import { needsPrecisionFix } from '@utils'
import type { PrecisionCleanupStatus } from './precisionCleanupTypes'

/**
 * Check if any value in an array of balance objects has precision issues
 */
function checkBalanceArrayPrecision(
  balances: Array<{ start_balance?: number; end_balance?: number; allocated?: number; spent?: number; income?: number; expenses?: number; net_change?: number }> | undefined
): number {
  if (!balances) return 0
  let count = 0
  for (const balance of balances) {
    if (needsPrecisionFix(balance.start_balance ?? 0)) count++
    if (needsPrecisionFix(balance.end_balance ?? 0)) count++
    if (needsPrecisionFix(balance.allocated ?? 0)) count++
    if (needsPrecisionFix(balance.spent ?? 0)) count++
    if (needsPrecisionFix(balance.income ?? 0)) count++
    if (needsPrecisionFix(balance.expenses ?? 0)) count++
    if (needsPrecisionFix(balance.net_change ?? 0)) count++
  }
  return count
}

/**
 * Check if any transaction in an array has precision issues
 */
function checkTransactionArrayPrecision(
  transactions: Array<{ amount?: number }> | undefined
): number {
  if (!transactions) return 0
  let count = 0
  for (const txn of transactions) {
    if (needsPrecisionFix(txn.amount ?? 0)) count++
  }
  return count
}

/**
 * Scan the database and return status of all precision issues.
 */
export async function scanPrecisionStatus(): Promise<PrecisionCleanupStatus> {
  // Scan budgets
  const budgetsResult = await queryCollection<FirestoreData>(
    'budgets',
    'precision cleanup: scanning all budgets'
  )

  let budgetsWithPrecisionIssues = 0
  let accountsWithPrecisionIssues = 0
  let categoriesWithPrecisionIssues = 0
  let totalAvailableWithPrecisionIssues = 0

  for (const budgetDoc of budgetsResult.docs) {
    const data = budgetDoc.data
    let budgetHasIssues = false

    // Check total_available
    if (needsPrecisionFix(data.total_available ?? 0)) {
      totalAvailableWithPrecisionIssues++
      budgetHasIssues = true
    }

    // Check accounts
    const accounts = data.accounts as FirestoreData | undefined
    if (accounts && typeof accounts === 'object') {
      for (const account of Object.values(accounts)) {
        if (needsPrecisionFix((account as { balance?: number }).balance ?? 0)) {
          accountsWithPrecisionIssues++
          budgetHasIssues = true
        }
      }
    }

    // Check categories
    const categories = data.categories as FirestoreData | undefined
    if (categories && typeof categories === 'object') {
      for (const category of Object.values(categories)) {
        if (needsPrecisionFix((category as { balance?: number }).balance ?? 0)) {
          categoriesWithPrecisionIssues++
          budgetHasIssues = true
        }
        // Also check default_monthly_amount for percentage categories
        if (needsPrecisionFix((category as { default_monthly_amount?: number }).default_monthly_amount ?? 0)) {
          categoriesWithPrecisionIssues++
          budgetHasIssues = true
        }
      }
    }

    if (budgetHasIssues) budgetsWithPrecisionIssues++
  }

  // Scan months
  const monthsResult = await queryCollection<FirestoreData>(
    'months',
    'precision cleanup: scanning all months'
  )

  let monthsWithPrecisionIssues = 0
  let incomeValuesWithPrecisionIssues = 0
  let expenseValuesWithPrecisionIssues = 0
  let categoryBalancesWithPrecisionIssues = 0
  let accountBalancesWithPrecisionIssues = 0

  for (const monthDoc of monthsResult.docs) {
    const data = monthDoc.data
    let monthHasIssues = false

    // Check totals
    if (needsPrecisionFix(data.total_income ?? 0) || needsPrecisionFix(data.total_expenses ?? 0) || needsPrecisionFix(data.previous_month_income ?? 0)) {
      monthHasIssues = true
    }

    // Check income transactions
    const incomeIssues = checkTransactionArrayPrecision(data.income)
    if (incomeIssues > 0) {
      incomeValuesWithPrecisionIssues += incomeIssues
      monthHasIssues = true
    }

    // Check expense transactions
    const expenseIssues = checkTransactionArrayPrecision(data.expenses)
    if (expenseIssues > 0) {
      expenseValuesWithPrecisionIssues += expenseIssues
      monthHasIssues = true
    }

    // Check category balances
    const categoryBalanceIssues = checkBalanceArrayPrecision(data.category_balances)
    if (categoryBalanceIssues > 0) {
      categoryBalancesWithPrecisionIssues += categoryBalanceIssues
      monthHasIssues = true
    }

    // Check account balances
    const accountBalanceIssues = checkBalanceArrayPrecision(data.account_balances)
    if (accountBalanceIssues > 0) {
      accountBalancesWithPrecisionIssues += accountBalanceIssues
      monthHasIssues = true
    }

    if (monthHasIssues) monthsWithPrecisionIssues++
  }

  return {
    totalBudgets: budgetsResult.docs.length,
    budgetsWithPrecisionIssues,
    accountsWithPrecisionIssues,
    categoriesWithPrecisionIssues,
    totalAvailableWithPrecisionIssues,
    totalMonths: monthsResult.docs.length,
    monthsWithPrecisionIssues,
    incomeValuesWithPrecisionIssues,
    expenseValuesWithPrecisionIssues,
    categoryBalancesWithPrecisionIssues,
    accountBalancesWithPrecisionIssues,
  }
}

