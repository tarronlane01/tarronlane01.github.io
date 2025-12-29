import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useBudget } from '../contexts/budget_context'
import type { Category, CategoriesMap, MonthDocument } from '@types'
import { useBudgetData, useBudgetMonth } from './index'
import {
  useSaveDraftAllocations,
  useFinalizeAllocations,
  useDeleteAllocations,
  type AllocationData,
} from '../data/mutations/month/allocations'

// Helper to compute allocations map from month and categories
function computeAllocationsMap(
  currentMonth: MonthDocument | null,
  categories: CategoriesMap
): Record<string, string> {
  if (!currentMonth) return {}

  const allocMap: Record<string, string> = {}
  Object.entries(categories).forEach(([catId, cat]) => {
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
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, getOnBudgetTotal } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    month: currentMonth,
    isLoading: monthLoading,
    previousMonthIncome,
    areAllocationsFinalized,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

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
  const [isSavingAllocations, setIsSavingAllocations] = useState(false)
  const [isFinalizingAllocations, setIsFinalizingAllocations] = useState(false)
  const [isDeletingAllocations, setIsDeletingAllocations] = useState(false)
  const [isEditingAppliedAllocations, setIsEditingAppliedAllocations] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which month we've synced to (to avoid re-syncing on every render)
  const syncedMonthRef = useRef<string | null>(null)

  // Total finalized allocations - computed from category balances on the budget
  // Uses the balance field directly from each category
  const totalFinalizedAllocations = useMemo(() => {
    return Object.values(categories).reduce((sum, cat) => sum + (cat.balance ?? 0), 0)
  }, [categories])

  // Sync local allocations when month changes (only if different from current sync)
  useEffect(() => {
    if (!currentMonth) return

    const monthKey = `${currentMonth.year}-${currentMonth.month}`
    if (syncedMonthRef.current === monthKey) return

    setLocalAllocations(computeAllocationsMap(currentMonth, categories))
    syncedMonthRef.current = monthKey
  }, [currentMonth, categories])

  // Helper to get allocation amount for a category (handles percentage-based)
  const getAllocationAmount = useCallback((catId: string, cat: Category): number => {
    if (cat.default_monthly_type === 'percentage' && cat.default_monthly_amount !== undefined) {
      return (cat.default_monthly_amount / 100) * previousMonthIncome
    }
    const val = localAllocations[catId]
    const num = parseFloat(val || '0')
    return isNaN(num) ? 0 : num
  }, [localAllocations, previousMonthIncome])

  // Calculate allocation totals (includes both manual and percentage-based)
  const currentDraftTotal = useMemo(() => {
    return Object.entries(categories).reduce((sum, [catId, cat]) => {
      return sum + getAllocationAmount(catId, cat)
    }, 0)
  }, [categories, getAllocationAmount])

  const onBudgetTotal = getOnBudgetTotal()

  // Calculate current month's already-finalized allocation total
  const currentMonthFinalizedTotal = areAllocationsFinalized
    ? (currentMonth?.category_balances || []).reduce((sum, cb) => sum + cb.allocated, 0)
    : 0

  // Available Now = on-budget total minus all finalized allocations
  const availableNow = onBudgetTotal - totalFinalizedAllocations

  // Available After Apply = what it would be if we apply current draft
  const availableAfterApply = useMemo(() => {
    return availableNow - currentDraftTotal + currentMonthFinalizedTotal
  }, [availableNow, currentDraftTotal, currentMonthFinalizedTotal])

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

  // Build allocations data including percentage-based categories
  const buildAllocationsData = useCallback((): AllocationData => {
    const allocations: AllocationData = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      const amount = getAllocationAmount(catId, cat)
      if (amount > 0) {
        allocations[catId] = amount
      }
    })
    return allocations
  }, [categories, getAllocationAmount])

  // Save allocations to database
  const handleSaveAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    setError(null)
    setIsSavingAllocations(true)
    try {
      await saveDraftAllocations(
        selectedBudgetId,
        currentYear,
        currentMonthNumber,
        buildAllocationsData()
      )
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save allocations')
    } finally {
      setIsSavingAllocations(false)
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, saveDraftAllocations, buildAllocationsData])

  // Finalize allocations (saves and finalizes in one operation)
  const handleFinalizeAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    setError(null)
    setIsFinalizingAllocations(true)
    try {
      await finalizeAllocations({
        budgetId: selectedBudgetId,
        year: currentYear,
        month: currentMonthNumber,
        allocations: buildAllocationsData(),
      })
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize allocations')
    } finally {
      setIsFinalizingAllocations(false)
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, finalizeAllocations, buildAllocationsData])

  // Delete allocations (clear and unfinalize)
  const handleDeleteAllocations = useCallback(async () => {
    if (!selectedBudgetId) return
    setError(null)
    setIsDeletingAllocations(true)
    try {
      await deleteAllocations({
        budgetId: selectedBudgetId,
        year: currentYear,
        month: currentMonthNumber,
      })
      // Reset local allocations to defaults after deletion
      const allocMap: Record<string, string> = {}
      Object.entries(categories).forEach(([catId, cat]) => {
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
      setError(err instanceof Error ? err.message : 'Failed to delete allocations')
    } finally {
      setIsDeletingAllocations(false)
    }
  }, [selectedBudgetId, currentYear, currentMonthNumber, deleteAllocations, categories])

  // Change from currently saved allocations (positive = allocating more, negative = allocating less)
  const draftChangeAmount = currentDraftTotal - currentMonthFinalizedTotal

  return {
    // State
    localAllocations,
    isSavingAllocations,
    isFinalizingAllocations,
    isDeletingAllocations,
    isEditingAppliedAllocations,
    error,
    monthLoading,

    // Computed values
    onBudgetTotal,
    availableNow,
    currentDraftTotal,
    draftChangeAmount,
    availableAfterApply,
    previousMonthIncome,
    allocationsFinalized: areAllocationsFinalized,

    // Functions
    getAllocationAmount,
    handleAllocationChange,
    resetAllocationsToSaved,
    handleSaveAllocations,
    handleFinalizeAllocations,
    handleDeleteAllocations,
    setIsEditingAppliedAllocations,
    setError,
  }
}
