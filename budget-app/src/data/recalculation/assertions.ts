/**
 * Recalculation Assertions
 *
 * Validation checks that run after recalculation to ensure data integrity.
 * All assertions should pass after a successful recalculation.
 *
 * Usage:
 *   const results = await runRecalculationAssertions(budgetId, {
 *     categories,
 *     accounts,
 *     totalAvailable,
 *     currentYear,
 *     currentMonth,
 *   })
 *
 *   if (results.failed.length > 0) {
 *     // Handle failures
 *   }
 */

import { calculateCategoryBalances } from '../cachedReads'
import type { CategoriesMap } from '@types'
import { formatCurrency } from '@components/ui'

// ============================================================================
// TYPES
// ============================================================================

export interface AssertionResult {
  name: string
  passed: boolean
  message: string
  details?: Record<string, unknown>
}

export interface AssertionResults {
  passed: AssertionResult[]
  failed: AssertionResult[]
}

export interface RunAssertionsParams {
  budgetId: string
  categories: CategoriesMap
  totalAvailable: number
  currentYear: number
  currentMonth: number
}

// ============================================================================
// INDIVIDUAL ASSERTIONS
// ============================================================================

/**
 * Assertion 1: Stored category balances match calculated balances
 *
 * After recalculation, the stored category.balance values in the budget document
 * should match the calculated total balances (including future allocations).
 */
async function assertStoredMatchesCalculated(
  budgetId: string,
  categories: CategoriesMap,
  currentYear: number,
  currentMonth: number
): Promise<AssertionResult> {
  const categoryIds = Object.keys(categories)

  // Calculate total balances (including future allocations)
  const { total: calculatedBalances } = await calculateCategoryBalances(
    budgetId,
    categoryIds,
    currentYear,
    currentMonth
  )

  // Sum positive stored balances
  const allocatedFromStored = Object.values(categories).reduce(
    (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
    0
  )

  // Sum positive calculated balances
  const allocatedFromCalculated = Object.values(calculatedBalances).reduce(
    (sum, bal) => sum + Math.max(0, bal),
    0
  )

  const diff = Math.abs(allocatedFromStored - allocatedFromCalculated)
  const passed = diff <= 0.01

  return {
    name: 'Stored balances match calculated balances',
    passed,
    message: passed
      ? 'Stored and calculated balances match'
      : `Balance calculation mismatch: ${formatCurrency(diff)} difference between stored and calculated balances`,
    details: {
      allocatedFromStored,
      allocatedFromCalculated,
      difference: diff,
    },
  }
}

/**
 * Assertion 2: Accounting relationship holds (On Budget = Allocated + Unallocated)
 *
 * The fundamental accounting relationship must always hold:
 * On Budget = Allocated (positive category balances) + Unallocated (remaining)
 */
function assertAccountingRelationship(
  categories: CategoriesMap,
  totalAvailable: number
): AssertionResult {
  // Calculate allocated (sum of positive category balances)
  const allocated = Object.values(categories).reduce(
    (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
    0
  )

  // Unallocated = totalAvailable (money not yet allocated to categories)
  const unallocated = totalAvailable

  const expectedSum = allocated + unallocated
  const diff = Math.abs(totalAvailable - expectedSum)
  const passed = diff <= 0.01

  return {
    name: 'Accounting relationship (On Budget = Allocated + Unallocated)',
    passed,
    message: passed
      ? 'Accounting relationship holds'
      : `Accounting relationship broken: On Budget (${formatCurrency(totalAvailable)}) ≠ Allocated (${formatCurrency(allocated)}) + Unallocated (${formatCurrency(unallocated)}). Difference: ${formatCurrency(diff)}`,
    details: {
      onBudgetTotal: totalAvailable,
      allocated,
      unallocated,
      expectedSum,
      actualSum: allocated + unallocated,
      difference: diff,
    },
  }
}

/**
 * Assertion 3: Month view ALL-TIME matches settings page Allocated
 *
 * Both the month view "ALL-TIME" column and the settings page "Allocated" stat
 * calculate the same value: sum of positive category.balance values.
 * They should always match.
 */
function assertMonthViewMatchesSettings(
  categories: CategoriesMap
): AssertionResult {
  // Both calculate the same: sum of positive category.balance values
  const monthViewAllTime = Object.values(categories).reduce(
    (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
    0
  )

  const settingsPageAllocated = Object.values(categories).reduce(
    (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
    0
  )

  const diff = Math.abs(monthViewAllTime - settingsPageAllocated)
  const passed = diff <= 0.01

  return {
    name: 'Month view ALL-TIME matches settings Allocated',
    passed,
    message: passed
      ? 'Month view and settings page totals match'
      : `Balance display mismatch: Settings "Allocated" (${formatCurrency(settingsPageAllocated)}) ≠ Month view "ALL-TIME" (${formatCurrency(monthViewAllTime)}). Difference: ${formatCurrency(diff)}`,
    details: {
      monthViewAllTime,
      settingsPageAllocated,
      difference: diff,
    },
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Run all recalculation assertions.
 *
 * @param params - Budget data and context needed for assertions
 * @returns Results of all assertions, grouped by pass/fail
 */
export async function runRecalculationAssertions(
  params: RunAssertionsParams
): Promise<AssertionResults> {
  const { budgetId, categories, totalAvailable, currentYear, currentMonth } = params

  const results: AssertionResult[] = []

  // Run all assertions
  results.push(
    await assertStoredMatchesCalculated(budgetId, categories, currentYear, currentMonth)
  )
  results.push(assertAccountingRelationship(categories, totalAvailable))
  results.push(assertMonthViewMatchesSettings(categories))

  // Group by pass/fail
  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  return { passed, failed }
}

/**
 * Log assertion results to console and return banner messages for failed assertions.
 *
 * @param results - Assertion results
 * @param logPrefix - Prefix for console logs (e.g., '[Recalc]')
 * @returns Array of banner messages for failed assertions
 */
export function logAssertionResults(
  results: AssertionResults,
  logPrefix = '[Recalculation Assertions]'
): Array<{ type: 'error'; message: string; autoDismissMs: number }> {
  const banners: Array<{ type: 'error'; message: string; autoDismissMs: number }> = []

  // Log all results (only failures are logged - successes are silent to reduce noise)

  if (results.failed.length > 0) {
    console.error(`${logPrefix} ${results.failed.length} assertion(s) failed:`)
    results.failed.forEach(r => {
      console.error(`  ✗ ${r.name}: ${r.message}`, r.details)
      // Create banner for each failure
      // Accounting relationship failures are more critical, so don't auto-dismiss
      const isCritical = r.name.includes('Accounting relationship')
      banners.push({
        type: 'error',
        message: r.message + '. Budget may need recalculation.',
        autoDismissMs: isCritical ? 0 : 10000,
      })
    })
  }

  return banners
}
