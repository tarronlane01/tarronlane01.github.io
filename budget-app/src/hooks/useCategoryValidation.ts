/**
 * Category Validation Hook
 *
 * Validates category balance calculations and relationships.
 * Shows errors via banner system when mismatches are detected.
 */

import { useEffect, useMemo } from 'react'
import { bannerQueue, formatCurrency } from '@components/ui'
import type { CategoriesMap } from '@types'
import type { CategoryBalance } from './useCategoriesPage'

interface UseCategoryValidationParams {
  categories: CategoriesMap
  categoryBalances: Record<string, CategoryBalance>
  totalAvailable: number
  onBudgetTotal: number
  isDataLoading: boolean
  loadingBalances: boolean
  currentBudget: unknown // Just checking for existence
}

export function useCategoryValidation({
  categories,
  categoryBalances,
  totalAvailable,
  onBudgetTotal,
  isDataLoading,
  loadingBalances,
  currentBudget,
}: UseCategoryValidationParams) {
  // Allocated = sum of only positive category balances from stored balances (same source as totalAvailable)
  // This ensures: On Budget = Allocated + Unallocated
  const allocatedFromStored = useMemo(() =>
    Object.values(categories).reduce(
      (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
      0
    ),
    [categories]
  )

  // Also calculate from calculated balances for comparison/debugging
  // Use 'total' (all-time balance) to match stored balances, not 'current' (current month only)
  const allocatedFromCalculated = useMemo(() =>
    Object.values(categoryBalances).reduce(
      (sum, bal) => sum + Math.max(0, bal.total),
      0
    ),
    [categoryBalances]
  )

  // Use stored balances to match totalAvailable calculation (ensures relationship holds)
  const allocated = allocatedFromStored

  // Calculate what the month view "ALL-TIME" would show (sum of positive category.balance)
  // This should match allocatedFromStored since both use the same calculation
  const monthViewAllTime = useMemo(() =>
    Object.values(categories).reduce(
      (sum, cat) => sum + Math.max(0, cat.balance ?? 0),
      0
    ),
    [categories]
  )

  // Unallocated = totalAvailable (money not yet allocated to categories)
  const unallocated = totalAvailable

  // Check if calculations match - if not, there's a sync issue
  const calculationMismatch = useMemo(() =>
    Math.abs(allocatedFromStored - allocatedFromCalculated) > 0.01,
    [allocatedFromStored, allocatedFromCalculated]
  )
  const relationshipMismatch = useMemo(() =>
    Math.abs(onBudgetTotal - (allocated + unallocated)) > 0.01,
    [onBudgetTotal, allocated, unallocated]
  )
  // Check if month view ALL-TIME matches settings page Allocated (they should always match)
  const monthViewMismatch = useMemo(() =>
    Math.abs(allocatedFromStored - monthViewAllTime) > 0.01,
    [allocatedFromStored, monthViewAllTime]
  )

  // Check for calculation mismatches and log/display errors
  // This must be called before any early returns (rules of hooks)
  useEffect(() => {
    if (isDataLoading || loadingBalances || !currentBudget) return // Don't check while loading

    if (calculationMismatch) {
      const diff = Math.abs(allocatedFromStored - allocatedFromCalculated)
      console.error('[Settings/Categories] Calculation Mismatch:', {
        allocatedFromStored,
        allocatedFromCalculated,
        difference: diff,
        message: 'Stored category balances do not match calculated balances. Budget may need recalculation.',
      })
      bannerQueue.add({
        type: 'error',
        message: `Balance calculation mismatch: ${formatCurrency(diff)} difference between stored and calculated balances. Budget may need recalculation.`,
        autoDismissMs: 10000,
      })
    }

    if (relationshipMismatch) {
      const expectedSum = allocated + unallocated
      const diff = Math.abs(onBudgetTotal - expectedSum)
      console.error('[Settings/Categories] Relationship Mismatch:', {
        onBudgetTotal,
        allocated,
        unallocated,
        expectedSum,
        actualSum: allocated + unallocated,
        difference: diff,
        message: 'On Budget ≠ Allocated + Unallocated',
      })
      bannerQueue.add({
        type: 'error',
        message: `Accounting relationship broken: On Budget (${formatCurrency(onBudgetTotal)}) ≠ Allocated (${formatCurrency(allocated)}) + Unallocated (${formatCurrency(unallocated)}). Difference: ${formatCurrency(diff)}. Budget may need recalculation.`,
        autoDismissMs: 0, // Don't auto-dismiss - this is important
      })
    }

    if (monthViewMismatch) {
      const diff = Math.abs(allocatedFromStored - monthViewAllTime)
      console.error('[Settings/Categories] Month View Mismatch:', {
        allocatedFromStored,
        monthViewAllTime,
        difference: diff,
        message: 'Settings page "Allocated" does not match month view "ALL-TIME" total. These should always match.',
      })
      bannerQueue.add({
        type: 'error',
        message: `Balance display mismatch: Settings "Allocated" (${formatCurrency(allocatedFromStored)}) ≠ Month view "ALL-TIME" (${formatCurrency(monthViewAllTime)}). Difference: ${formatCurrency(diff)}. Budget may need recalculation.`,
        autoDismissMs: 10000,
      })
    }
  }, [calculationMismatch, relationshipMismatch, monthViewMismatch, allocatedFromStored, allocatedFromCalculated, allocated, unallocated, onBudgetTotal, monthViewAllTime, isDataLoading, loadingBalances, currentBudget])

  return {
    allocatedFromStored,
    allocatedFromCalculated,
    allocated,
    unallocated,
    monthViewAllTime,
    calculationMismatch,
    relationshipMismatch,
    monthViewMismatch,
  }
}
