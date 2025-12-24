/**
 * useCategoryBalances Hook
 *
 * Handles category balance loading, caching, and reconciliation.
 * Uses an optimized walk-back/walk-forward approach instead of loading all months.
 *
 * Extracted from useCategoriesPage to reduce file size.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CategoriesMap, CategoryBalancesSnapshot } from '../types/budget'
import { calculateCategoryBalances } from '../data'

// Balance object for each category showing current (spendable now) and total (including future)
export interface CategoryBalance {
  current: number  // Available to spend now (allocations through current month - expenses through current month)
  total: number    // Total including future allocations - all expenses
}

interface UseCategoryBalancesParams {
  budgetId: string | null
  categories: CategoriesMap
  categoryBalancesSnapshot: CategoryBalancesSnapshot | null
  currentYear: number
  currentMonth: number
  saveCategoryBalancesSnapshot: (
    balances: Record<string, CategoryBalance>,
    year: number,
    month: number
  ) => Promise<void>
  recalculateCategoryBalancesMutation: (
    categories: CategoriesMap,
    balances: Record<string, CategoryBalance>,
    year: number,
    month: number
  ) => Promise<void>
}

export function useCategoryBalances({
  budgetId,
  categories,
  categoryBalancesSnapshot,
  currentYear,
  currentMonth,
  saveCategoryBalancesSnapshot,
  recalculateCategoryBalancesMutation,
}: UseCategoryBalancesParams) {
  // State
  const [categoryBalances, setCategoryBalances] = useState<Record<string, CategoryBalance>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)
  const [categoryBalanceMismatch, setCategoryBalanceMismatch] = useState<
    Record<string, { stored: number; calculated: number }> | null
  >(null)

  // Track if we've already loaded for this budget/month combination
  const loadedForRef = useRef<string | null>(null)

  // Check if the snapshot is valid for the current context
  const isSnapshotValid = useCallback((snapshot: CategoryBalancesSnapshot | null): boolean => {
    if (!snapshot) return false
    if (snapshot.is_stale) return false
    if (snapshot.computed_for_year !== currentYear || snapshot.computed_for_month !== currentMonth) {
      return false
    }
    return true
  }, [currentYear, currentMonth])

  // Load category balances - uses snapshot if valid, otherwise recalculates
  useEffect(() => {
    if (!budgetId || Object.keys(categories).length === 0) return

    const loadKey = `${budgetId}_${currentYear}_${currentMonth}`

    // If snapshot is valid, use it immediately without recalculating
    if (isSnapshotValid(categoryBalancesSnapshot)) {
      const balances: Record<string, CategoryBalance> = {}
      Object.keys(categories).forEach(catId => {
        const snapshotBal = categoryBalancesSnapshot!.balances[catId]
        balances[catId] = snapshotBal || { current: 0, total: 0 }
      })
      setCategoryBalances(balances)
      loadedForRef.current = loadKey
      return
    }

    // Skip if we already loaded for this exact context (prevents duplicate loads)
    if (loadedForRef.current === loadKey) return

    const loadBalances = async () => {
      setLoadingBalances(true)
      try {
        const categoryIds = Object.keys(categories)
        // Use optimized walk-back/walk-forward calculation
        // Pass budget snapshot so it can use it for "total" if still valid
        const { current, total } = await calculateCategoryBalances(
          budgetId,
          categoryIds,
          currentYear,
          currentMonth,
          categoryBalancesSnapshot
        )

        const balances: Record<string, CategoryBalance> = {}
        categoryIds.forEach(catId => {
          balances[catId] = {
            current: current[catId] ?? 0,
            total: total[catId] ?? 0,
          }
        })
        setCategoryBalances(balances)
        loadedForRef.current = loadKey

        // Save the freshly calculated snapshot
        await saveCategoryBalancesSnapshot(balances, currentYear, currentMonth)
      } catch (err) {
        console.error('Error loading category balances:', err)
      } finally {
        setLoadingBalances(false)
      }
    }

    loadBalances()
  }, [budgetId, categories, currentYear, currentMonth, categoryBalancesSnapshot, isSnapshotValid, saveCategoryBalancesSnapshot])

  // Check for category balance mismatches (compares stored balance vs calculated total)
  const checkCategoryBalanceMismatch = useCallback(async (): Promise<Record<string, { stored: number; calculated: number }> | null> => {
    if (!budgetId || Object.keys(categories).length === 0) return null

    const categoryIds = Object.keys(categories)
    // Use optimized walk-back/walk-forward calculation (no snapshot - force recalc for accuracy)
    const { total: calculatedBalances } = await calculateCategoryBalances(
      budgetId,
      categoryIds,
      currentYear,
      currentMonth,
      null // Don't use snapshot - we want accurate calculation
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

  // Recalculate and save category balances (also updates the cache)
  const recalculateAndSaveCategoryBalances = useCallback(async (): Promise<void> => {
    if (!budgetId || Object.keys(categories).length === 0) return

    setLoadingBalances(true)
    try {
      const categoryIds = Object.keys(categories)
      // Use optimized calculation (no snapshot - force full recalc)
      const { current, total } = await calculateCategoryBalances(
        budgetId,
        categoryIds,
        currentYear,
        currentMonth,
        null // Don't use snapshot - we want full recalculation
      )

      // Update categories with recalculated total balances (stored balance is total)
      const updatedCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        updatedCategories[catId] = {
          ...cat,
          balance: total[catId] ?? 0,
        }
      })

      // Build the new balances for snapshot
      const balances: Record<string, CategoryBalance> = {}
      categoryIds.forEach(catId => {
        balances[catId] = {
          current: current[catId] ?? 0,
          total: total[catId] ?? 0,
        }
      })

      // Mutation handles Firestore write and optimistic cache updates
      await recalculateCategoryBalancesMutation(
        updatedCategories,
        balances,
        currentYear,
        currentMonth
      )

      // Update local state
      setCategoryBalances(balances)
      setCategoryBalanceMismatch(null)
    } finally {
      setLoadingBalances(false)
    }
  }, [budgetId, categories, recalculateCategoryBalancesMutation, currentYear, currentMonth])

  return {
    categoryBalances,
    loadingBalances,
    categoryBalanceMismatch,
    checkCategoryBalanceMismatch,
    recalculateAndSaveCategoryBalances,
  }
}

