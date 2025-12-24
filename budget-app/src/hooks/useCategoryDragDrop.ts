/**
 * useCategoryDragDrop Hook
 *
 * Handles drag and drop functionality for categories and category groups.
 * Supports reordering within groups and moving between groups.
 *
 * Extracted from useCategoriesPage to reduce file size.
 */

import { useState, type DragEvent } from 'react'
import type { CategoriesMap, CategoryGroup, Budget } from '../types/budget'

type DragType = 'category' | 'group' | null

interface UseCategoryDragDropParams {
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
  currentBudget: Budget | null
  setCategoriesOptimistic: (categories: CategoriesMap) => void
  setCategoryGroupsOptimistic: (groups: CategoryGroup[]) => void
  saveCategories: (categories: CategoriesMap) => Promise<void>
  saveCategoryGroups: (groups: CategoryGroup[]) => Promise<void>
  setError: (error: string | null) => void
}

export function useCategoryDragDrop({
  categories,
  categoryGroups,
  currentBudget,
  setCategoriesOptimistic,
  setCategoryGroupsOptimistic,
  saveCategories,
  saveCategoryGroups,
  setError,
}: UseCategoryDragDropParams) {
  // Drag state
  const [dragType, setDragType] = useState<DragType>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

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

  return {
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

