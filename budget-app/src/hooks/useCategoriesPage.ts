import { useState, useEffect, type DragEvent } from 'react'
import { useBudget, type Category, type CategoriesMap, type CategoryGroup } from '../contexts/budget_context'
import { useBudgetData } from './useBudgetData'
import type { CategoryFormData } from '../components/budget/Categories'

type DragType = 'category' | 'group' | null

export type CategoryWithId = {
  id: string
  category: Category
}

export type CategoryEntry = [string, Category]

export function useCategoriesPage() {
  // Context: identifiers only
  const { selectedBudgetId, currentUserId } = useBudget()

  // Hook: budget data and mutations
  const {
    budget: currentBudget,
    categories,
    categoryGroups,
    saveCategories,
    saveCategoryGroups,
    saveCategoriesAndGroups,
    setCategoriesOptimistic,
    setCategoryGroupsOptimistic,
    getOnBudgetTotal,
  } = useBudgetData(selectedBudgetId, currentUserId)

  const [error, setError] = useState<string | null>(null)

  // Category balances state
  const [categoryBalances, setCategoryBalances] = useState<Record<string, number>>({})
  const [loadingBalances] = useState(false)

  // Drag state
  const [dragType, setDragType] = useState<DragType>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  // Load category balances from category data
  useEffect(() => {
    if (currentBudget && Object.keys(categories).length > 0) {
      const balances: Record<string, number> = {}
      Object.entries(categories).forEach(([catId, cat]) => {
        balances[catId] = cat.balance
      })
      setCategoryBalances(balances)
    }
  }, [currentBudget?.id, categories])

  // Category handlers
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
      description: formData.description,
      category_group_id: effectiveGroupId,
      sort_order: maxSortOrder + 1,
      default_monthly_amount: formData.default_monthly_amount,
      default_monthly_type: formData.default_monthly_type,
      balance: 0,
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
          description: formData.description,
          category_group_id: newGroupId,
          sort_order: newSortOrder,
          default_monthly_amount: formData.default_monthly_amount,
          default_monthly_type: formData.default_monthly_type,
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

  // Group handlers
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

  // Category drag handlers
  function handleCategoryDragStart(e: DragEvent, categoryId: string) {
    setDragType('category')
    setDraggedId(categoryId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleCategoryDragOver(e: DragEvent, categoryId: string, groupId: string) {
    e.preventDefault()
    if (dragType !== 'category') return
    if (categoryId !== draggedId) {
      setDragOverId(categoryId)
    }
    setDragOverGroupId(groupId)
  }

  function handleDragOverGroup(e: DragEvent, groupId: string) {
    e.preventDefault()
    if (dragType === 'category') {
      setDragOverGroupId(groupId)
      setDragOverId(null)
    } else if (dragType === 'group' && groupId !== draggedId) {
      setDragOverId(groupId)
    }
  }

  function handleDragLeave() {
    setDragOverId(null)
  }

  function handleDragLeaveGroup() {
    setDragOverGroupId(null)
  }

  function handleDragEnd() {
    setDragType(null)
    setDraggedId(null)
    setDragOverId(null)
    setDragOverGroupId(null)
  }

  async function handleCategoryDrop(e: DragEvent, targetId: string, targetGroupId: string) {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedId || dragType !== 'category') {
      handleDragEnd()
      return
    }

    const draggedCategory = categories[draggedId]
    if (!draggedCategory) return

    const newGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId
    const targetGroupCategories = Object.entries(categories).filter(([, c]) => {
      const catGroupId = c.category_group_id || 'ungrouped'
      return catGroupId === targetGroupId
    })

    // Start with categories excluding the dragged one
    const newCategories: CategoriesMap = {}
    Object.entries(categories).forEach(([catId, cat]) => {
      if (catId !== draggedId) {
        newCategories[catId] = cat
      }
    })

    let newSortOrder: number

    if (targetId === '__group_end__' || targetGroupCategories.length === 0 || !targetGroupCategories.find(([catId]) => catId === targetId)) {
      const maxInGroup = targetGroupCategories.length > 0
        ? Math.max(...targetGroupCategories.filter(([catId]) => catId !== draggedId).map(([, c]) => c.sort_order))
        : -1
      newSortOrder = maxInGroup + 1
    } else {
      const targetCategoryEntry = targetGroupCategories.find(([catId]) => catId === targetId)
      if (targetCategoryEntry) {
        newSortOrder = targetCategoryEntry[1].sort_order
        // Shift other categories down
        Object.entries(newCategories).forEach(([catId, cat]) => {
          const catGroupId = cat.category_group_id || 'ungrouped'
          if (catGroupId === targetGroupId && cat.sort_order >= newSortOrder) {
            newCategories[catId] = { ...cat, sort_order: cat.sort_order + 1 }
          }
        })
      } else {
        newSortOrder = 0
      }
    }

    // Add the dragged category with updated position
    newCategories[draggedId] = {
      ...draggedCategory,
      category_group_id: newGroupId,
      sort_order: newSortOrder,
    }

    setCategoriesOptimistic(newCategories)
    handleDragEnd()

    if (!currentBudget) return
    try {
      await saveCategories(newCategories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

  async function handleDropOnGroup(e: DragEvent, groupId: string) {
    e.preventDefault()
    if (dragType === 'category') {
      await handleCategoryDrop(e, '__group_end__', groupId)
    } else if (dragType === 'group') {
      await handleGroupDrop(e, groupId)
    }
  }

  // Group drag handlers
  function handleGroupDragStart(e: DragEvent, groupId: string) {
    e.stopPropagation()
    setDragType('group')
    setDraggedId(groupId)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleGroupDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedId || dragType !== 'group' || draggedId === targetId) {
      handleDragEnd()
      return
    }

    const draggedIndex = categoryGroups.findIndex(g => g.id === draggedId)
    const newGroups = [...categoryGroups]
    const [draggedItem] = newGroups.splice(draggedIndex, 1)

    if (targetId === '__end__') {
      newGroups.push(draggedItem)
    } else {
      const targetIndex = newGroups.findIndex(g => g.id === targetId)
      newGroups.splice(targetIndex, 0, draggedItem)
    }

    const updatedGroups = newGroups.map((group, index) => ({
      ...group,
      sort_order: index,
    }))

    setCategoryGroupsOptimistic(updatedGroups)
    handleDragEnd()

    if (!currentBudget) return
    try {
      await saveCategoryGroups(updatedGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new order')
    }
  }

  // Organize categories by group
  const categoriesByGroup = Object.entries(categories).reduce((acc, [catId, category]) => {
    const groupId = category.category_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push([catId, category] as CategoryEntry)
    return acc
  }, {} as Record<string, CategoryEntry[]>)

  // Sort groups by sort_order
  const sortedGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)

  return {
    // Data
    currentBudget,
    categories,
    categoryGroups,
    categoriesByGroup,
    sortedGroups,
    categoryBalances,
    loadingBalances,
    error,
    setError,
    getOnBudgetTotal,
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
    // Drag state
    dragType,
    draggedId,
    dragOverId,
    dragOverGroupId,
    setDragOverId,
    setDragOverGroupId,
    // Drag handlers
    handleCategoryDragStart,
    handleCategoryDragOver,
    handleDragOverGroup,
    handleDragLeave,
    handleDragLeaveGroup,
    handleDragEnd,
    handleCategoryDrop,
    handleDropOnGroup,
    handleGroupDragStart,
    handleGroupDrop,
  }
}

