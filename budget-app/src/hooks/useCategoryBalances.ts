/**
 * useCategoryBalances Hook
 *
 * Handles category balance loading and reconciliation.
 * Uses the balance field directly from each category in the budget document.
 * Caches calculated balances in React Query to avoid recalculating on every navigation.
 *
 * Extracted from useCategoriesPage to reduce file size.
 */

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CategoriesMap } from '@types'
import { calculateCategoryBalances } from '@data'
import { queryClient, STALE_TIME } from '@data/queryClient'

// Balance object for each category showing current (spendable now) and total (including future)
export interface CategoryBalance {
  current: number  // Available to spend now (allocations + expenses through current month, expenses negative for money out)
  total: number    // Total including future allocations + all expenses
}

interface UseCategoryBalancesParams {
  budgetId: string | null
  categories: CategoriesMap
  currentYear: number
  currentMonth: number
  updateCategoriesWithBalances: (categories: CategoriesMap) => Promise<void>
}

export function useCategoryBalances({
  budgetId,
  categories,
  currentYear,
  currentMonth,
  updateCategoriesWithBalances,
}: UseCategoryBalancesParams) {
  const categoryIds = Object.keys(categories)
  const hasCategories = categoryIds.length > 0

  // Use React Query to cache calculated balances - only recalculate when needed
  // The query key includes budgetId, year, month, and a hash of category IDs to detect changes
  const categoryIdsHash = useMemo(() => {
    return categoryIds.sort().join(',')
  }, [categoryIds])

  // Build stored balances from categories (always available, already calculated and saved)
  // These are the source of truth - they're updated during recalculation
  const storedBalances = useMemo(() => {
    const balances: Record<string, CategoryBalance> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      balances[catId] = {
        current: cat.balance ?? 0,
        total: cat.balance ?? 0,
      }
    })
    return balances
  }, [categories])

  // Cache calculated balances in React Query - only recalculates when cache is stale
  // This prevents recalculating every time we navigate to the page
  const calculatedBalancesQuery = useQuery({
    queryKey: ['categoryBalances', budgetId, currentYear, currentMonth, categoryIdsHash] as const,
    queryFn: async () => {
      if (!budgetId || !hasCategories) {
        return {} as Record<string, CategoryBalance>
      }
      const { current, total } = await calculateCategoryBalances(budgetId, categoryIds, currentYear, currentMonth)
      const balances: Record<string, CategoryBalance> = {}
      categoryIds.forEach(catId => {
        balances[catId] = {
          current: current[catId] ?? 0,
          total: total[catId] ?? 0,
        }
      })
      return balances
    },
    enabled: !!budgetId && hasCategories,
    staleTime: STALE_TIME, // Use same stale time as other queries (5 minutes)
    // Use stored balances as placeholder - they're accurate and available immediately
    placeholderData: storedBalances,
    // Don't refetch on mount if we have cached data - stored balances are good enough
    refetchOnMount: false,
  })

  // Use calculated balances from cache if available, otherwise use stored balances
  // Stored balances are always available and accurate (updated during recalculation)
  const calculatedBalances = calculatedBalancesQuery.data || storedBalances
  // Don't show loading state - stored balances are always available and accurate
  // Only show loading during manual recalculation (handled by loadingBalances state)
  const isCalculatingBalances = false

  // Use calculated balances from cache if available, otherwise use stored balances
  // Stored balances are always available and accurate (updated during recalculation)
  const categoryBalances = useMemo(() => {
    return calculatedBalances
  }, [calculatedBalances])

  const [loadingBalances, setLoadingBalances] = useState(false)
  // Combine calculating state with loading state
  const isLoadingBalances = loadingBalances || isCalculatingBalances
  const [categoryBalanceMismatch, setCategoryBalanceMismatch] = useState<
    Record<string, { stored: number; calculated: number }> | null
  >(null)

  // Check for category balance mismatches (compares stored balance vs calculated total)
  const checkCategoryBalanceMismatch = useCallback(async (): Promise<Record<string, { stored: number; calculated: number }> | null> => {
    if (!budgetId || Object.keys(categories).length === 0) return null

    const categoryIds = Object.keys(categories)
    // Use optimized walk-back/walk-forward calculation for accurate balances
    const { total: calculatedBalances } = await calculateCategoryBalances(
      budgetId,
      categoryIds,
      currentYear,
      currentMonth
    )

    const mismatches: Record<string, { stored: number; calculated: number }> = {}

    Object.entries(categories).forEach(([catId, cat]) => {
      const stored = cat.balance
      const calculated = calculatedBalances[catId] ?? 0
      // Allow for small floating point differences (within 1 cent)
      if (Math.abs(stored - calculated) > 0.01) {
        mismatches[catId] = { stored, calculated }
      }
    })

    const result = Object.keys(mismatches).length > 0 ? mismatches : null
    setCategoryBalanceMismatch(result)
    return result
  }, [budgetId, categories, currentYear, currentMonth])

  // Recalculate and save category balances (also updates the categories on the budget)
  const recalculateAndSaveCategoryBalances = useCallback(async (): Promise<void> => {
    if (!budgetId || !hasCategories) return

    setLoadingBalances(true)
    try {
      // Use optimized calculation for full recalculation
      const { total } = await calculateCategoryBalances(
        budgetId,
        categoryIds,
        currentYear,
        currentMonth
      )

      // Update categories with recalculated total balances
      const updatedCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        updatedCategories[catId] = {
          ...cat,
          balance: total[catId] ?? 0,
        }
      })

      // Save updated categories to Firestore
      await updateCategoriesWithBalances(updatedCategories)

      // Invalidate the cache so it recalculates with new data
      queryClient.invalidateQueries({
        queryKey: ['categoryBalances', budgetId, currentYear, currentMonth],
      })

      setCategoryBalanceMismatch(null)
    } finally {
      setLoadingBalances(false)
    }
  }, [budgetId, categories, updateCategoriesWithBalances, currentYear, currentMonth, categoryIds, hasCategories])

  return {
    categoryBalances,
    loadingBalances: isLoadingBalances,
    categoryBalanceMismatch,
    checkCategoryBalanceMismatch,
    recalculateAndSaveCategoryBalances,
  }
}
