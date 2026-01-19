/**
 * useCategoryDragDrop Hook
 *
 * Handles drag and drop functionality for categories and category groups.
 * Supports reordering within groups and moving between groups.
 *
 * Extracted from useCategoriesPage to reduce file size.
 */

import { useState, type DragEvent } from 'react'
import type { CategoriesMap, CategoryGroup, Budget } from '@types'
import { UNGROUPED_CATEGORY_GROUP_ID } from '@constants'

type DragType = 'category' | null

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  categoryGroups: _categoryGroups,
  currentBudget,
  setCategoriesOptimistic,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setCategoryGroupsOptimistic: _setCategoryGroupsOptimistic,
  saveCategories,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  saveCategoryGroups: _saveCategoryGroups,
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

    const newGroupId = targetGroupId === 'ungrouped' ? UNGROUPED_CATEGORY_GROUP_ID : targetGroupId
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
  }
}

