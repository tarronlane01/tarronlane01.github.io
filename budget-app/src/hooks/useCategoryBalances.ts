/**
 * useCategoryBalances Hook
 *
 * Handles category balance loading and reconciliation.
 * Uses the balance field directly from each category in the budget document.
 *
 * Extracted from useCategoriesPage to reduce file size.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { CategoriesMap } from '@types'
import { calculateCategoryBalances } from '@data'

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
  // State for calculated balances
  const [calculatedBalances, setCalculatedBalances] = useState<Record<string, CategoryBalance>>({})
  const [isCalculatingBalances, setIsCalculatingBalances] = useState(false)

  // Calculate category balances from actual month data
  useEffect(() => {
    if (!budgetId || Object.keys(categories).length === 0) {
      setCalculatedBalances({})
      return
    }

    let cancelled = false
    setIsCalculatingBalances(true)
    const categoryIds = Object.keys(categories)

    calculateCategoryBalances(budgetId, categoryIds, currentYear, currentMonth)
      .then(({ current, total }) => {
        if (cancelled) return
        const balances: Record<string, CategoryBalance> = {}
        categoryIds.forEach(catId => {
          balances[catId] = {
            current: current[catId] ?? 0,
            total: total[catId] ?? 0,
          }
        })
        setCalculatedBalances(balances)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[useCategoryBalances] Error calculating balances:', error)
        // Fallback to stored balances on error
        const balances: Record<string, CategoryBalance> = {}
        Object.entries(categories).forEach(([catId, cat]) => {
          balances[catId] = {
            current: cat.balance ?? 0,
            total: cat.balance ?? 0,
          }
        })
        setCalculatedBalances(balances)
      })
      .finally(() => {
        if (!cancelled) {
          setIsCalculatingBalances(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [budgetId, currentYear, currentMonth, categories])

  // Use calculated balances, fallback to stored balance if not yet calculated
  const categoryBalances = useMemo(() => {
    const balances: Record<string, CategoryBalance> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      if (calculatedBalances[catId]) {
        balances[catId] = calculatedBalances[catId]
      } else {
        // Fallback to stored balance while calculating
        balances[catId] = {
          current: cat.balance ?? 0,
          total: cat.balance ?? 0,
        }
      }
    })
    return balances
  }, [categories, calculatedBalances])

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
    if (!budgetId || Object.keys(categories).length === 0) return

    setLoadingBalances(true)
    try {
      const categoryIds = Object.keys(categories)
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

      setCategoryBalanceMismatch(null)
    } finally {
      setLoadingBalances(false)
    }
  }, [budgetId, categories, updateCategoriesWithBalances, currentYear, currentMonth])

  return {
    categoryBalances,
    loadingBalances: isLoadingBalances,
    categoryBalanceMismatch,
    checkCategoryBalanceMismatch,
    recalculateAndSaveCategoryBalances,
  }
}
