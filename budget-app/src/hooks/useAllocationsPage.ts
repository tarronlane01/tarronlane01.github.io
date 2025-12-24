import { useState, useEffect, useMemo, useCallback } from 'react'
import { useBudget } from '../contexts/budget_context'
import type { CategoryAllocation, Category } from '../types/budget'
import { useBudgetData, useBudgetMonth } from './index'

export function useAllocationsPage() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, categoryBalancesSnapshot, getOnBudgetTotal } = useBudgetData(selectedBudgetId, currentUserId)
  const {
    month: currentMonth,
    isLoading: monthLoading,
    previousMonthIncome,
    saveAllocations,
    finalizeAllocations,
    deleteAllocations,
  } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)

  // Allocations state - track local edits before saving
  const [localAllocations, setLocalAllocations] = useState<Record<string, string>>({})
  const [isSavingAllocations, setIsSavingAllocations] = useState(false)
  const [isFinalizingAllocations, setIsFinalizingAllocations] = useState(false)
  const [isDeletingAllocations, setIsDeletingAllocations] = useState(false)
  const [isEditingAppliedAllocations, setIsEditingAppliedAllocations] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Total finalized allocations - computed from category balances snapshot
  // Uses 'current' balance to match the Categories admin page calculation
  // Note: We don't require the snapshot to match the viewed month because
  // "Available Now" represents total unallocated funds, which is independent
  // of which month you're viewing for allocations
  const totalFinalizedAllocations = useMemo(() => {
    // If we have a valid (non-stale) snapshot, use its current balances
    if (categoryBalancesSnapshot && !categoryBalancesSnapshot.is_stale) {
      return Object.values(categoryBalancesSnapshot.balances).reduce(
        (sum, bal) => sum + (bal?.current ?? 0),
        0
      )
    }
    // Fallback to stored category balances (less accurate, may be stale)
    return Object.values(categories).reduce((sum, cat) => sum + cat.balance, 0)
  }, [categories, categoryBalancesSnapshot])

  // Initialize local allocations when month changes (only for non-percentage categories)
  useEffect(() => {
    if (!currentMonth) return

    const allocMap: Record<string, string> = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      // Skip percentage-based categories - they're auto-calculated
      if (cat.default_monthly_type === 'percentage') {
        return
      }

      const existingAlloc = currentMonth.allocations?.find(a => a.category_id === catId)
      if (existingAlloc) {
        allocMap[catId] = existingAlloc.amount.toString()
      } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
        allocMap[catId] = cat.default_monthly_amount.toString()
      } else {
        allocMap[catId] = ''
      }
    })
    setLocalAllocations(allocMap)
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
  const currentMonthFinalizedTotal = currentMonth?.allocations_finalized
    ? (currentMonth.allocations || []).reduce((sum, a) => sum + a.amount, 0)
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
      const existingAlloc = currentMonth.allocations?.find(a => a.category_id === catId)
      if (existingAlloc) {
        allocMap[catId] = existingAlloc.amount.toString()
      } else if (cat.default_monthly_amount !== undefined && cat.default_monthly_amount > 0) {
        allocMap[catId] = cat.default_monthly_amount.toString()
      } else {
        allocMap[catId] = ''
      }
    })
    setLocalAllocations(allocMap)
    setIsEditingAppliedAllocations(false)
  }, [currentMonth, categories])

  // Build allocations array including percentage-based categories
  const buildAllocationsArray = useCallback((): CategoryAllocation[] => {
    const allocationsArr: CategoryAllocation[] = []
    Object.entries(categories).forEach(([catId, cat]) => {
      const amount = getAllocationAmount(catId, cat)
      if (amount > 0) {
        allocationsArr.push({ category_id: catId, amount })
      }
    })
    return allocationsArr
  }, [categories, getAllocationAmount])

  // Save allocations to database
  const handleSaveAllocations = useCallback(async () => {
    setError(null)
    setIsSavingAllocations(true)
    try {
      await saveAllocations(buildAllocationsArray())
      setIsEditingAppliedAllocations(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save allocations')
    } finally {
      setIsSavingAllocations(false)
    }
  }, [saveAllocations, buildAllocationsArray])

  // Finalize allocations
  const handleFinalizeAllocations = useCallback(async () => {
    setError(null)
    setIsFinalizingAllocations(true)
    try {
      // First save any pending changes (including percentage-based)
      await saveAllocations(buildAllocationsArray())
      // Then finalize
      await finalizeAllocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize allocations')
    } finally {
      setIsFinalizingAllocations(false)
    }
  }, [saveAllocations, finalizeAllocations, buildAllocationsArray])

  // Delete allocations (clear and unfinalize)
  const handleDeleteAllocations = useCallback(async () => {
    setError(null)
    setIsDeletingAllocations(true)
    try {
      await deleteAllocations()
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
  }, [deleteAllocations, categories])

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
    availableAfterApply,
    previousMonthIncome,
    allocationsFinalized: currentMonth?.allocations_finalized ?? false,

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

