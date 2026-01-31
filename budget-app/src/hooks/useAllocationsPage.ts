import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp, useBudget } from '@contexts'
import type { Category, CategoriesMap, MonthDocument } from '@types'
import { useBudgetData, useMonthData } from './index'
import {
  useSaveDraftAllocations,
  useFinalizeAllocations,
  useDeleteAllocations,
  type AllocationData,
  type AllocationProgress,
} from '../data/mutations/month/allocations'
import { readMonthForEdit } from '@data'
import { queryKeys } from '@data/queryClient'
import { bannerQueue } from '@components/ui'
import { roundCurrency } from '@utils'

// Helper to compute allocations map from month and categories
function computeAllocationsMap(
  currentMonth: MonthDocument | null,
  categories: CategoriesMap
): Record<string, string> {
  if (!currentMonth) return {}

  const allocMap: Record<string, string> = {}
  Object.entries(categories).forEach(([catId, cat]) => {
    // Hidden categories always get zero (no default, no existing)
    if (cat.is_hidden) {
      allocMap[catId] = ''
      return
    }
    // Skip percentage-based categories - they're auto-calculated
    if (cat.default_monthly_type === 'percentage') {
      return
    }

    // Get allocation from category_balances
    const existingBalance = currentMonth.category_balances?.find(cb => cb.category_id === catId)
    if (existingBalance && existingBalance.allocated > 0) {
      allocMap[catId] = existingBalance.allocated.toString()
    } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
      allocMap[catId] = cat.default_monthly_amount.toString()
    } else {
      allocMap[catId] = ''
    }
  })
  return allocMap
}

export function useAllocationsPage() {
  const queryClient = useQueryClient()
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { categories, getOnBudgetTotal, totalAvailable } = useBudgetData()
  const {
    month: currentMonth,
    isLoading: monthLoading,
    previousMonthIncome,
    areAllocationsFinalized,
  } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)

  // Calculate current month's total income
  const currentMonthIncome = useMemo(() => {
    if (!currentMonth?.income) return 0
    return currentMonth.income.reduce((sum, i) => sum + i.amount, 0)
  }, [currentMonth])

  // Allocation mutations
  const { saveDraftAllocations } = useSaveDraftAllocations()
  const { finalizeAllocations } = useFinalizeAllocations()
  const { deleteAllocations } = useDeleteAllocations()

  // Compute initial allocations from cached data (avoids flash on navigation)
  const initialAllocations = useMemo(
    () => computeAllocationsMap(currentMonth, categories),
    [currentMonth, categories]
  )

  // Allocations state - initialized from cached data if available
  const [localAllocations, setLocalAllocations] = useState<Record<string, string>>(initialAllocations)
  const [isEditingAppliedAllocations, setIsEditingAppliedAllocations] = useState(false)

  // Track which month we've synced to (to avoid re-syncing on every render)
  const syncedMonthRef = useRef<string | null>(null)

  // Total finalized allocations - computed from category balances on the budget
  // Uses the balance field directly from each category
  // NOTE: This is still useful for calculations but we now prefer budget.total_available
  const _totalFinalizedAllocations = useMemo(() => {
    return Object.values(categories).reduce((sum, cat) => sum + (cat.balance ?? 0), 0)
  }, [categories])
  // Suppress unused variable warning - keeping for potential future use
  void _totalFinalizedAllocations

  // Sync local allocations when month changes (only if different from current sync)
  // Also cancel any in-progress allocation editing without saving (user navigated away)
  useEffect(() => {
    if (!currentMonth) return

    const monthKey = `${currentMonth.year}-${currentMonth.month}`
    if (syncedMonthRef.current === monthKey) return

    // Cancel allocation editing when navigating to a different month (don't save draft)
    setIsEditingAppliedAllocations(false)

    setLocalAllocations(computeAllocationsMap(currentMonth, categories))
    syncedMonthRef.current = monthKey
  }, [currentMonth, categories])

  // Helper to get allocation amount for a category (handles percentage-based)
  // Hidden categories always get 0 (no default, no worksheet value)
  const getAllocationAmount = useCallback((catId: string, cat: Category): number => {
    if (cat.is_hidden) return 0
    if (cat.default_monthly_type === 'percentage' && cat.default_monthly_amount !== undefined) {
      return roundCurrency((cat.default_monthly_amount / 100) * previousMonthIncome)
    }
    const val = localAllocations[catId]
    const num = parseFloat(val || '0')
    return isNaN(num) ? 0 : roundCurrency(num)
  }, [localAllocations, previousMonthIncome])

  // Calculate allocation totals (includes both manual and percentage-based)
  // For categories with debt (negative balance), only count allocation amounts that exceed the debt
  // This allows debt reduction to happen without reducing actual available dollars
  const currentDraftTotal = useMemo(() => {
    return Object.entries(categories).reduce((sum, [catId, cat]) => {
      const allocationAmount = getAllocationAmount(catId, cat)
      const categoryBalance = cat.balance ?? 0

      // If category has debt (negative balance), only count the portion that exceeds the debt
      if (categoryBalance < 0) {
        const debtAmount = Math.abs(categoryBalance)
        // Only add the amount that goes beyond debt reduction to the total
        const amountBeyondDebt = Math.max(0, allocationAmount - debtAmount)
        return sum + amountBeyondDebt
      }

      return sum + allocationAmount
    }, 0)
  }, [categories, getAllocationAmount])

  const onBudgetTotal = getOnBudgetTotal()

  // Calculate current month's already-finalized allocation total
  // Only count allocations that go beyond debt reduction
  const currentMonthFinalizedTotal = areAllocationsFinalized
    ? (currentMonth?.category_balances || []).reduce((sum, cb) => {
        const categoryBalance = categories[cb.category_id]?.balance ?? 0
        const allocated = cb.allocated

        // If category had debt before this allocation, only count what went beyond debt
        // But we need to check the balance BEFORE the allocation was applied
        // For simplicity in this cache update, we use current balance - allocated to estimate pre-allocation
        const estimatedPreAllocationBalance = categoryBalance - allocated
        if (estimatedPreAllocationBalance < 0) {
          const debtAmount = Math.abs(estimatedPreAllocationBalance)
          return sum + Math.max(0, allocated - debtAmount)
        }

        return sum + allocated
      }, 0)
    : 0

  // Available Now: Uses the pre-calculated total_available from the budget document.
  // This ensures consistency across all months regardless of which month is currently viewed.
  // The value is updated during recalculation and persists until the next recalc.
  // When editing applied allocations, temporarily add back the finalized amount so users
  // can see the full amount available if they were to release/reallocate those funds.
  const availableNow = isEditingAppliedAllocations
    ? totalAvailable + currentMonthFinalizedTotal
    : totalAvailable

  // Available After Apply = what it would be if we apply current draft
  // When editing applied allocations, availableNow already includes the finalized amount,
  // so we only need to subtract the draft total.
  // For regular draft mode, add back finalized amount (since it's already reflected
  // in totalAvailable) and subtract the new draft amount.
  const availableAfterApply = useMemo(() => {
    if (isEditingAppliedAllocations) {
      return availableNow - currentDraftTotal
    }
    return availableNow - currentDraftTotal + currentMonthFinalizedTotal
  }, [availableNow, currentDraftTotal, currentMonthFinalizedTotal, isEditingAppliedAllocations])

  // Handle allocation changes
  const handleAllocationChange = useCallback((categoryId: string, value: string) => {
    setLocalAllocations(prev => ({
      ...prev,
      [categoryId]: value,
    }))
  }, [])

  // Reset allocations back to what's saved/applied (for Cancel button)
  const resetAllocationsToSaved = useCallback(() => {
    if (!currentMonth) return
    const allocMap: Record<string, string> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      if (cat.is_hidden) {
        allocMap[catId] = ''
        return
      }
      if (cat.default_monthly_type === 'percentage') return
      const existingBalance = currentMonth.category_balances?.find(cb => cb.category_id === catId)
      if (existingBalance && existingBalance.allocated > 0) {
        allocMap[catId] = existingBalance.allocated.toString()
      } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
        allocMap[catId] = cat.default_monthly_amount.toString()
      } else {
        allocMap[catId] = ''
      }
    })
    setLocalAllocations(allocMap)
    setIsEditingAppliedAllocations(false)
  }, [currentMonth, categories])

  // Edit Allocations: fetch month for edit (includes previous_month_income) behind loading overlay, then enter edit mode
  const handleEditAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    addLoadingHold('allocations-edit', 'Loading allocations...')
    try {
      const monthDoc = await readMonthForEdit(
        selectedBudgetId,
        currentYear,
        currentMonthNumber,
        'Edit Allocations'
      )
      const monthKey = queryKeys.month(selectedBudgetId, currentYear, currentMonthNumber)
      queryClient.setQueryData(monthKey, { month: monthDoc })
      setIsEditingAppliedAllocations(true)
    } catch (err) {
      console.error('[useAllocationsPage] Edit Allocations failed:', err)
      bannerQueue.add({ type: 'error', message: 'Failed to load allocations. See console for details.', autoDismissMs: 0 })
    } finally {
      removeLoadingHold('allocations-edit')
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, queryClient, addLoadingHold, removeLoadingHold])

  // Build allocations data: visible categories get worksheet/default amount, hidden always 0
  const buildAllocationsData = useCallback((): AllocationData => {
    const allocations: AllocationData = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      const amount = cat.is_hidden ? 0 : getAllocationAmount(catId, cat)
      if (amount > 0 || cat.is_hidden) {
        allocations[catId] = amount
      }
    })
    return allocations
  }, [categories, getAllocationAmount])

  // Save allocations to database
  const handleSaveAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    addLoadingHold('allocations-save', 'Saving allocations...')
    try {
      await saveDraftAllocations(
        selectedBudgetId,
        currentYear,
        currentMonthNumber,
        buildAllocationsData()
      )
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      console.error('[useAllocationsPage] Save allocations failed:', err)
      bannerQueue.add({ type: 'error', message: 'Failed to save allocations. See console for details.', autoDismissMs: 0 })
    } finally {
      removeLoadingHold('allocations-save')
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, saveDraftAllocations, buildAllocationsData, addLoadingHold, removeLoadingHold])

  // Finalize allocations (saves and finalizes in one operation)
  // Now triggers immediate recalculation and shows detailed progress
  const handleFinalizeAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    addLoadingHold('allocations-finalize', 'Applying allocations...')
    try {
      await finalizeAllocations({
        budgetId: selectedBudgetId,
        year: currentYear,
        month: currentMonthNumber,
        allocations: buildAllocationsData(),
        onProgress: (progress: AllocationProgress) => {
          // Update loading message as operation progresses
          addLoadingHold('allocations-finalize', progress.message)
        },
      })
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      console.error('[useAllocationsPage] Finalize allocations failed:', err)
      bannerQueue.add({ type: 'error', message: 'Failed to apply allocations. See console for details.', autoDismissMs: 0 })
    } finally {
      removeLoadingHold('allocations-finalize')
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, finalizeAllocations, buildAllocationsData, addLoadingHold, removeLoadingHold])

  // Delete allocations (clear and unfinalize)
  // Now triggers immediate recalculation and shows detailed progress
  const handleDeleteAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    addLoadingHold('allocations-delete', 'Deleting allocations...')
    try {
      await deleteAllocations({
        budgetId: selectedBudgetId,
        year: currentYear,
        month: currentMonthNumber,
        onProgress: (progress: AllocationProgress) => {
          // Update loading message as operation progresses
          addLoadingHold('allocations-delete', progress.message)
        },
      })
      // Reset local allocations to defaults after deletion (hidden stay at zero)
      const allocMap: Record<string, string> = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        if (cat.is_hidden) {
          allocMap[catId] = ''
          return
        }
        if (cat.default_monthly_type === 'percentage') return
        if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
          allocMap[catId] = cat.default_monthly_amount.toString()
        } else {
          allocMap[catId] = ''
        }
      })
      setLocalAllocations(allocMap)
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      console.error('[useAllocationsPage] Delete allocations failed:', err)
      bannerQueue.add({ type: 'error', message: 'Failed to delete allocations. See console for details.', autoDismissMs: 0 })
    } finally {
      removeLoadingHold('allocations-delete')
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, deleteAllocations, categories, addLoadingHold, removeLoadingHold])

  // Change from currently saved allocations (positive = allocating more, negative = allocating less)
  const draftChangeAmount = currentDraftTotal - currentMonthFinalizedTotal

  return {
    // State
    localAllocations,
    isEditingAppliedAllocations,
    monthLoading,

    // Computed values (On-Budget and totalAvailable use same isAccountOnBudget as Settings/calculateTotalAvailable)
    onBudgetTotal,
    totalAvailable,
    availableNow,
    currentDraftTotal,
    draftChangeAmount,
    availableAfterApply,
    previousMonthIncome,
    currentMonthIncome,
    allocationsFinalized: areAllocationsFinalized,

    // Functions
    getAllocationAmount,
    handleAllocationChange,
    resetAllocationsToSaved,
    handleSaveAllocations,
    handleFinalizeAllocations,
    handleDeleteAllocations,
    handleEditAllocations,
    setIsEditingAppliedAllocations,
  }
}
