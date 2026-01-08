/**
 * useCategoriesPage Hook
 *
 * Main hook for the Categories page. Provides:
 * - Category and group CRUD operations
 * - Category balances (via useCategoryBalances)
 * - Drag and drop (via useCategoryDragDrop)
 *
 * Split into smaller hooks for maintainability:
 * - useCategoryBalances: Balance loading, caching, reconciliation
 * - useCategoryDragDrop: Drag and drop state and handlers
 */

import { useState } from 'react'
import { useBudget } from '@contexts'
import type { Category, CategoriesMap, CategoryGroup } from '@types'
import { useBudgetData } from './useBudgetData'
import { useCategoryBalances } from './useCategoryBalances'
import { useCategoryDragDrop } from './useCategoryDragDrop'
import type { CategoryFormData } from '../components/budget/Categories'

export type CategoryWithId = {
  id: string
  category: Category
}

export type CategoryEntry = [string, Category]

// Re-export CategoryBalance type for consumers
export type { CategoryBalance } from './useCategoryBalances'

export function useCategoriesPage() {
  // Context: identifiers and current month
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()

  // Hook: budget data and mutations
  const {
    budget: currentBudget,
    categories,
    categoryGroups,
    isLoading,
    saveCategories,
    saveCategoryGroups,
    saveCategoriesAndGroups,
    setCategoriesOptimistic,
    setCategoryGroupsOptimistic,
    getOnBudgetTotal,
  } = useBudgetData()

  const [error, setError] = useState<string | null>(null)

  // Hook: category balances (loading, caching, reconciliation)
  const {
    categoryBalances,
    loadingBalances,
    categoryBalanceMismatch,
    checkCategoryBalanceMismatch,
    recalculateAndSaveCategoryBalances,
  } = useCategoryBalances({
    budgetId: selectedBudgetId,
    categories,
    currentYear,
    currentMonth: currentMonthNumber,
    updateCategoriesWithBalances: saveCategories,
  })

  // Hook: drag and drop
  const dragDrop = useCategoryDragDrop({
    categories,
    categoryGroups,
    currentBudget,
    setCategoriesOptimistic,
    setCategoryGroupsOptimistic,
    saveCategories,
    saveCategoryGroups,
    setError,
  })

  // ==========================================================================
  // CATEGORY CRUD HANDLERS
  // ==========================================================================

  async function handleCreateCategory(formData: CategoryFormData, forGroupId: string | null) {
    if (!currentBudget) return

    // Use the group from the context (where form was opened from)
    const effectiveGroupId = forGroupId === 'ungrouped' ? null : forGroupId

    const groupCategories = Object.values(categories).filter(c =>
      (forGroupId === 'ungrouped' ? !c.category_group_id : c.category_group_id === forGroupId)
    )
    const maxSortOrder = groupCategories.length > 0
      ? Math.max(...groupCategories.map(c => c.sort_order))
      : -1

    const newCategoryId = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newCategory: Category = {
      name: formData.name,
      description: formData.description ?? '',
      category_group_id: effectiveGroupId,
      sort_order: maxSortOrder + 1,
      default_monthly_amount: formData.default_monthly_amount ?? 0,
      default_monthly_type: formData.default_monthly_type ?? 'fixed',
      balance: 0,
      is_hidden: formData.is_hidden ?? false,
    }

    const newCategories: CategoriesMap = { ...categories, [newCategoryId]: newCategory }
    setCategoriesOptimistic(newCategories)

    try {
      await saveCategories(newCategories)
    } catch (err) {
      setCategoriesOptimistic(categories)
      setError(err instanceof Error ? err.message : 'Failed to create category')
    }
  }

  async function handleUpdateCategory(categoryId: string, formData: CategoryFormData) {
    if (!currentBudget) return
    try {
      const category = categories[categoryId]
      if (!category) return

      const oldGroupId = category.category_group_id || 'ungrouped'
      const newGroupId = formData.category_group_id

      // If group changed, update sort_order for the new group
      let newSortOrder = category.sort_order
      if (oldGroupId !== (newGroupId || 'ungrouped')) {
        const targetGroupCategories = Object.values(categories).filter(c => {
          const catGroupId = c.category_group_id || 'ungrouped'
          return catGroupId === (newGroupId || 'ungrouped')
        }).filter((_, idx, arr) => {
          // Exclude the current category from the count
          const currentCat = categories[categoryId]
          return currentCat !== arr[idx]
        })
        newSortOrder = targetGroupCategories.length > 0
          ? Math.max(...targetGroupCategories.map(c => c.sort_order)) + 1
          : 0
      }

      const newCategories: CategoriesMap = {
        ...categories,
        [categoryId]: {
          ...category,
          name: formData.name,
          description: formData.description ?? '',
          category_group_id: newGroupId,
          sort_order: newSortOrder,
          default_monthly_amount: formData.default_monthly_amount ?? 0,
          default_monthly_type: formData.default_monthly_type ?? 'fixed',
          is_hidden: formData.is_hidden ?? false,
        },
      }
      setCategoriesOptimistic(newCategories)
      await saveCategories(newCategories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Are you sure you want to delete this category?')) return
    if (!currentBudget) return
    try {
      const { [categoryId]: _removed, ...newCategories } = categories
      void _removed // Intentionally unused - destructuring to exclude from object
      setCategoriesOptimistic(newCategories)
      await saveCategories(newCategories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  // Move category up/down within its group
  async function handleMoveCategory(categoryId: string, direction: 'up' | 'down') {
    const category = categories[categoryId]
    if (!category) return

    const groupId = category.category_group_id || 'ungrouped'
    const groupCategories = Object.entries(categories)
      .filter(([, c]) => (c.category_group_id || 'ungrouped') === groupId)
      .sort((a, b) => a[1].sort_order - b[1].sort_order)

    const currentIndex = groupCategories.findIndex(([catId]) => catId === categoryId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= groupCategories.length) return

    // Swap sort orders
    const [targetCatId, targetCategory] = groupCategories[targetIndex]
    const newCategories: CategoriesMap = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      if (catId === categoryId) {
        newCategories[catId] = { ...cat, sort_order: targetCategory.sort_order }
      } else if (catId === targetCatId) {
        newCategories[catId] = { ...cat, sort_order: category.sort_order }
      } else {
        newCategories[catId] = cat
      }
    })

    setCategoriesOptimistic(newCategories)

    if (!currentBudget) return
    try {
      await saveCategories(newCategories)
    } catch (err) {
      setCategoriesOptimistic(categories)
      setError(err instanceof Error ? err.message : 'Failed to move category')
    }
  }

  // ==========================================================================
  // GROUP CRUD HANDLERS
  // ==========================================================================

  async function handleCreateGroup(formData: { name: string }) {
    if (!currentBudget) return
    try {
      const maxSortOrder = categoryGroups.length > 0
        ? Math.max(...categoryGroups.map(g => g.sort_order))
        : -1

      const newGroup: CategoryGroup = {
        id: `category_group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        sort_order: maxSortOrder + 1,
      }

      const newGroups = [...categoryGroups, newGroup]
      setCategoryGroupsOptimistic(newGroups)
      await saveCategoryGroups(newGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    }
  }

  async function handleUpdateGroup(groupId: string, formData: { name: string }) {
    if (!currentBudget) return
    try {
      const newGroups = categoryGroups.map(group =>
        group.id === groupId ? { ...group, name: formData.name } : group
      )
      setCategoryGroupsOptimistic(newGroups)
      await saveCategoryGroups(newGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group')
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm('Are you sure you want to delete this group? Categories in this group will move to Uncategorized.')) return
    if (!currentBudget) return
    try {
      // Move categories from this group to ungrouped
      const newCategories: CategoriesMap = {}
      Object.entries(categories).forEach(([catId, category]) => {
        newCategories[catId] = category.category_group_id === groupId
          ? { ...category, category_group_id: null }
          : category
      })
      const newGroups = categoryGroups.filter(group => group.id !== groupId)

      setCategoriesOptimistic(newCategories)
      setCategoryGroupsOptimistic(newGroups)
      await saveCategoriesAndGroups(newCategories, newGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group')
    }
  }

  // Move group up/down
  async function handleMoveGroup(groupId: string, direction: 'up' | 'down') {
    const sortedGroupsCopy = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
    const currentIndex = sortedGroupsCopy.findIndex(g => g.id === groupId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= sortedGroupsCopy.length) return

    // Swap positions in array
    const [movedGroup] = sortedGroupsCopy.splice(currentIndex, 1)
    sortedGroupsCopy.splice(targetIndex, 0, movedGroup)

    // Update sort orders
    const updatedGroups = sortedGroupsCopy.map((group, index) => ({
      ...group,
      sort_order: index,
    }))

    setCategoryGroupsOptimistic(updatedGroups)

    if (!currentBudget) return
    try {
      await saveCategoryGroups(updatedGroups)
    } catch (err) {
      setCategoryGroupsOptimistic(categoryGroups)
      setError(err instanceof Error ? err.message : 'Failed to move group')
    }
  }

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  // Organize categories by group (excluding hidden categories)
  const categoriesByGroup = Object.entries(categories)
    .filter(([, category]) => !category.is_hidden)
    .reduce((acc, [catId, category]) => {
      const groupId = category.category_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push([catId, category] as CategoryEntry)
      return acc
    }, {} as Record<string, CategoryEntry[]>)

  // Hidden categories list
  const hiddenCategories = Object.entries(categories)
    .filter(([, category]) => category.is_hidden)
    .map(([catId, category]) => [catId, category] as CategoryEntry)
    .sort((a, b) => a[1].sort_order - b[1].sort_order)

  // Sort groups by sort_order
  const sortedGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)

  return {
    // Data
    currentBudget,
    categories,
    categoryGroups,
    categoriesByGroup,
    hiddenCategories,
    sortedGroups,
    categoryBalances,
    isLoading,
    loadingBalances,
    error,
    setError,
    getOnBudgetTotal,
    // Reconciliation
    categoryBalanceMismatch,
    checkCategoryBalanceMismatch,
    recalculateAndSaveCategoryBalances,
    // Category handlers
    handleCreateCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleMoveCategory,
    // Group handlers
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleMoveGroup,
    // Drag state (from useCategoryDragDrop)
    dragType: dragDrop.dragType,
    draggedId: dragDrop.draggedId,
    dragOverId: dragDrop.dragOverId,
    dragOverGroupId: dragDrop.dragOverGroupId,
    setDragOverId: dragDrop.setDragOverId,
    setDragOverGroupId: dragDrop.setDragOverGroupId,
    // Drag handlers (from useCategoryDragDrop)
    handleCategoryDragStart: dragDrop.handleCategoryDragStart,
    handleCategoryDragOver: dragDrop.handleCategoryDragOver,
    handleDragOverGroup: dragDrop.handleDragOverGroup,
    handleDragLeave: dragDrop.handleDragLeave,
    handleDragLeaveGroup: dragDrop.handleDragLeaveGroup,
    handleDragEnd: dragDrop.handleDragEnd,
    handleCategoryDrop: dragDrop.handleCategoryDrop,
    handleDropOnGroup: dragDrop.handleDropOnGroup,
    handleGroupDragStart: dragDrop.handleGroupDragStart,
    handleGroupDrop: dragDrop.handleGroupDrop,
  }
}
