import { useState, useEffect, type FormEvent, type DragEvent } from 'react'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget, type Category, type CategoryGroup, type DefaultAmountType, type CategoriesMap } from '../../contexts/budget_context'
import {
  ErrorAlert,
  Button,
  DraggableCard,
  DropZone,
  FormWrapper,
  FormField,
  TextInput,
  TextAreaInput,
  SelectInput,
  FormButtonGroup,
  StatCard,
  CurrencyInput,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import {
  pageSubtitle,
  listContainer,
  itemTitle,
  sectionHeader,
  colors,
  reorderButton,
  reorderButtonGroup,
} from '../../styles/shared'
import { useIsMobile } from '../../hooks/useIsMobile'

interface CategoryFormData {
  name: string
  description?: string
  category_group_id: string | null
  default_monthly_amount?: number
  default_monthly_type?: DefaultAmountType
}

interface GroupFormData {
  name: string
}

type DragType = 'category' | 'group' | null

function Categories() {
  const { currentBudget, categories, setCategories, categoryGroups, setCategoryGroups, getCategoryBalances, getOnBudgetTotal } = useBudget()
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  // Category balances state
  const [categoryBalances, setCategoryBalances] = useState<Record<string, number>>({})
  const [loadingBalances, setLoadingBalances] = useState(false)

  // Category editing state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)

  // Group editing state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  // Drag state
  const [dragType, setDragType] = useState<DragType>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  const db = getFirestore(app)

  // Load category balances on mount
  useEffect(() => {
    if (currentBudget && Object.keys(categories).length > 0) {
      setLoadingBalances(true)
      getCategoryBalances()
        .then(balances => setCategoryBalances(balances))
        .catch(err => console.warn('Failed to load category balances:', err))
        .finally(() => setLoadingBalances(false))
    }
  }, [currentBudget?.id, Object.keys(categories).length, getCategoryBalances])

  // Helper to clean categories for Firestore (avoid undefined values)
  function cleanCategoriesForFirestore(cats: CategoriesMap): CategoriesMap {
    const cleaned: CategoriesMap = {}
    Object.entries(cats).forEach(([catId, cat]) => {
      cleaned[catId] = {
        name: cat.name,
        category_group_id: cat.category_group_id ?? null,
        sort_order: cat.sort_order,
        balance: cat.balance ?? 0,
      }
      // Only include optional fields if they have a value
      if (cat.description) cleaned[catId].description = cat.description
      if (cat.default_monthly_amount !== undefined) cleaned[catId].default_monthly_amount = cat.default_monthly_amount
      if (cat.default_monthly_type !== undefined) cleaned[catId].default_monthly_type = cat.default_monthly_type
    })
    return cleaned
  }

  // Save functions
  async function saveCategories(newCategories: CategoriesMap) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, categories: cleanCategoriesForFirestore(newCategories) })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save categories')
    }
  }

  async function saveCategoryGroups(newGroups: CategoryGroup[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, category_groups: newGroups })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save category groups')
    }
  }

  async function saveBoth(newCategories: CategoriesMap, newGroups: CategoryGroup[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, categories: cleanCategoriesForFirestore(newCategories), category_groups: newGroups })
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save changes')
    }
  }

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
    setCategories(newCategories)
    setCreateForGroupId(null)

    try {
      await saveCategories(newCategories)
    } catch (err) {
      setCategories(categories)
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
      setCategories(newCategories)
      await saveCategories(newCategories)
      setEditingCategoryId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Are you sure you want to delete this category?')) return
    if (!currentBudget) return
    try {
      const { [categoryId]: _, ...newCategories } = categories
      setCategories(newCategories)
      await saveCategories(newCategories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  // Group handlers
  async function handleCreateGroup(formData: GroupFormData) {
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
      setCategoryGroups(newGroups)
      await saveCategoryGroups(newGroups)
      setShowCreateGroupForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group')
    }
  }

  async function handleUpdateGroup(groupId: string, formData: GroupFormData) {
    if (!currentBudget) return
    try {
      const newGroups = categoryGroups.map(group =>
        group.id === groupId ? { ...group, name: formData.name } : group
      )
      setCategoryGroups(newGroups)
      await saveCategoryGroups(newGroups)
      setEditingGroupId(null)
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

      setCategories(newCategories)
      setCategoryGroups(newGroups)
      await saveBoth(newCategories, newGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group')
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
    const targetGroupCategories = Object.entries(categories).filter(([_, c]) => {
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
        ? Math.max(...targetGroupCategories.filter(([catId]) => catId !== draggedId).map(([_, c]) => c.sort_order))
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

    setCategories(newCategories)
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

    setCategoryGroups(updatedGroups)
    handleDragEnd()

    if (!currentBudget) return
    try {
      await saveCategoryGroups(updatedGroups)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new order')
    }
  }

  // Move category up/down within its group
  async function handleMoveCategory(categoryId: string, direction: 'up' | 'down') {
    const category = categories[categoryId]
    if (!category) return

    const groupId = category.category_group_id || 'ungrouped'
    const groupCategories = Object.entries(categories)
      .filter(([_, c]) => (c.category_group_id || 'ungrouped') === groupId)
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

    setCategories(newCategories)

    if (!currentBudget) return
    try {
      await saveCategories(newCategories)
    } catch (err) {
      setCategories(categories)
      setError(err instanceof Error ? err.message : 'Failed to move category')
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

    setCategoryGroups(updatedGroups)

    if (!currentBudget) return
    try {
      await saveCategoryGroups(updatedGroups)
    } catch (err) {
      setCategoryGroups(categoryGroups)
      setError(err instanceof Error ? err.message : 'Failed to move group')
    }
  }

  // Category entry type for working with categories map
  type CategoryEntry = [string, Category]

  // Organize categories by group
  const categoriesByGroup = Object.entries(categories).reduce((acc, [catId, category]) => {
    const groupId = category.category_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push([catId, category] as CategoryEntry)
    return acc
  }, {} as Record<string, CategoryEntry[]>)

  // Sort groups by sort_order, with ungrouped always last
  const sortedGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Categories & Groups</h2>
      <p style={pageSubtitle}>
        Organize your spending categories into groups.
        <br />
        <span style={{ fontSize: '0.9rem' }}>
          {isMobile
            ? 'Use ▲▼ buttons to reorder items, or drag to move between groups.'
            : 'Drag categories between groups, or use ▲▼ buttons to reorder.'}
        </span>
      </p>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <StatCard style={{ flex: 1, minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Categories</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600 }}>
            {Object.keys(categories).length}
          </p>
        </StatCard>
        <StatCard style={{ flex: 1, minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Groups</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600 }}>
            {categoryGroups.length}
          </p>
        </StatCard>
        <StatCard style={{ flex: 1, minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>On-Budget</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600, color: getBalanceColor(getOnBudgetTotal()) }}>
            {formatCurrency(getOnBudgetTotal())}
          </p>
        </StatCard>
        <StatCard style={{ flex: 1, minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Allocated</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600, color: colors.primary }}>
            {loadingBalances ? '...' : formatCurrency(Object.values(categoryBalances).reduce((sum, val) => sum + val, 0))}
          </p>
        </StatCard>
        <StatCard style={{ flex: 1, minWidth: '120px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Available</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600, color: getBalanceColor(getOnBudgetTotal() - Object.values(categoryBalances).reduce((sum, val) => sum + val, 0)) }}>
            {loadingBalances ? '...' : formatCurrency(getOnBudgetTotal() - Object.values(categoryBalances).reduce((sum, val) => sum + val, 0))}
          </p>
        </StatCard>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {Object.keys(categories).length === 0 && categoryGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>No categories yet. Create a group first, then add categories!</p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupCategories = (categoriesByGroup[group.id] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)
          const isGroupDragging = dragType === 'group' && draggedId === group.id
          const isGroupDragOver = dragType === 'group' && dragOverId === group.id
          const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === group.id
          const draggedCategory = draggedId && dragType === 'category' ? categories[draggedId] : null
          const isMovingToDifferentGroup = draggedCategory && (draggedCategory.category_group_id || 'ungrouped') !== group.id

          // Check if we should show the drop indicator line above this group
          const showDropIndicator = dragType === 'group' && isGroupDragOver && draggedId !== group.id

          // Group reorder state
          const canMoveGroupUp = groupIndex > 0
          const canMoveGroupDown = groupIndex < sortedGroups.length - 1

          return (
            <div key={group.id}>
              {/* Drop indicator line above group */}
              {dragType === 'group' && !isGroupDragging && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(group.id) }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleGroupDrop(e, group.id)}
                  style={{
                    position: 'relative',
                    height: showDropIndicator ? '2.5rem' : '0.5rem',
                    marginBottom: showDropIndicator ? '-0.5rem' : '-0.25rem',
                    transition: 'height 0.15s',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: colors.primary,
                      borderRadius: '2px',
                      opacity: showDropIndicator ? 1 : 0,
                      transition: 'opacity 0.15s',
                      boxShadow: showDropIndicator ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
                    }}
                  />
                  {showDropIndicator && (
                    <span style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: '0.75rem',
                      opacity: 0.7,
                      background: 'var(--background, #1a1a1a)',
                      padding: '0 0.5rem',
                      whiteSpace: 'nowrap',
                    }}>
                      Drop here
                    </span>
                  )}
                </div>
              )}

              <div
                onDragOver={(e) => {
                  handleDragOverGroup(e, group.id)
                }}
                onDragLeave={handleDragLeaveGroup}
                onDrop={(e) => handleDropOnGroup(e, group.id)}
                style={{
                  background: isGroupDragging
                    ? 'color-mix(in srgb, currentColor 3%, transparent)'
                    : (isCategoryMovingHere && isMovingToDifferentGroup)
                      ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
                      : 'color-mix(in srgb, currentColor 5%, transparent)',
                  borderRadius: '12px',
                  padding: '1rem',
                  opacity: isGroupDragging ? 0.5 : 1,
                  border: (isCategoryMovingHere && isMovingToDifferentGroup)
                      ? `2px dashed ${colors.primary}`
                      : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
              {editingGroupId === group.id ? (
                <GroupForm
                  initialData={{ name: group.name }}
                  onSubmit={(data) => handleUpdateGroup(group.id, data)}
                  onCancel={() => setEditingGroupId(null)}
                  submitLabel="Save"
                />
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isMobile ? '0.5rem' : '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
                    gap: '0.5rem',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                  }}>
                    <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      {!isMobile && (
                        <span
                          draggable
                          onDragStart={(e) => handleGroupDragStart(e, group.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            cursor: 'grab',
                            opacity: 0.4,
                            padding: '0.25rem',
                            margin: '-0.25rem',
                            borderRadius: '4px',
                            userSelect: 'none',
                          }}
                          title="Drag to reorder group"
                        >
                          ⋮⋮
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.name}
                      </span>
                      <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem', flexShrink: 0 }}>
                        ({groupCategories.length})
                      </span>
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                      {!isMobile && (
                        <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                          + Category
                        </Button>
                      )}
                      <button
                        onClick={() => setEditingGroupId(group.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          fontSize: '0.9rem',
                          padding: '0.25rem',
                        }}
                        title="Edit group"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.6,
                          fontSize: '0.9rem',
                          padding: '0.25rem',
                        }}
                        title="Delete group"
                      >
                        🗑️
                      </button>
                      {/* Group reorder buttons - on right side after edit/delete */}
                      <div style={reorderButtonGroup}>
                        <button
                          onClick={() => handleMoveGroup(group.id, 'up')}
                          disabled={!canMoveGroupUp}
                          style={{
                            ...reorderButton,
                            opacity: canMoveGroupUp ? 0.6 : 0.2,
                            cursor: canMoveGroupUp ? 'pointer' : 'default',
                          }}
                          title="Move group up"
                          aria-label="Move group up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveGroup(group.id, 'down')}
                          disabled={!canMoveGroupDown}
                          style={{
                            ...reorderButton,
                            opacity: canMoveGroupDown ? 0.6 : 0.2,
                            cursor: canMoveGroupDown ? 'pointer' : 'default',
                          }}
                          title="Move group down"
                          aria-label="Move group down"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Mobile: Add category button on its own row */}
                  {isMobile && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                        + Category
                      </Button>
                    </div>
                  )}

                  <div style={listContainer}>
                    {groupCategories.map(([catId, category]) => (
                      editingCategoryId === catId ? (
                        <CategoryForm
                          key={catId}
                          initialData={{
                            name: category.name,
                            description: category.description,
                            category_group_id: category.category_group_id,
                            default_monthly_amount: category.default_monthly_amount,
                            default_monthly_type: category.default_monthly_type,
                          }}
                          onSubmit={(data) => handleUpdateCategory(catId, data)}
                          onCancel={() => setEditingCategoryId(null)}
                          submitLabel="Save"
                          categoryGroups={categoryGroups}
                          showGroupSelector={true}
                        />
                      ) : (
                        <DraggableCard
                          key={catId}
                          isDragging={dragType === 'category' && draggedId === catId}
                          isDragOver={dragOverId === catId}
                          onDragStart={(e) => { e.stopPropagation(); handleCategoryDragStart(e, catId) }}
                          onDragOver={(e) => handleCategoryDragOver(e, catId, group.id)}
                          onDragLeave={handleDragLeave}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleCategoryDrop(e, catId, group.id)}
                          onEdit={() => setEditingCategoryId(catId)}
                          onDelete={() => handleDeleteCategory(catId)}
                          onMoveUp={() => handleMoveCategory(catId, 'up')}
                          onMoveDown={() => handleMoveCategory(catId, 'down')}
                          canMoveUp={groupCategories.findIndex(([cId]) => cId === catId) > 0}
                          canMoveDown={groupCategories.findIndex(([cId]) => cId === catId) < groupCategories.length - 1}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <span style={itemTitle}>{category.name}</span>
                              {category.default_monthly_amount !== undefined && category.default_monthly_amount > 0 && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  opacity: 0.8,
                                  background: 'color-mix(in srgb, currentColor 10%, transparent)',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                }}>
                                  Default: {category.default_monthly_type === 'percentage'
                                    ? <><span style={{ color: colors.success, fontWeight: 500 }}>{category.default_monthly_amount}%</span> of prev income</>
                                    : <><span style={{ color: colors.success, fontWeight: 500 }}>{formatCurrency(category.default_monthly_amount)}</span>/mo</>}
                                </span>
                              )}
                            </div>
                            {category.description && (
                              <p style={{
                                margin: '0.25rem 0 0 0',
                                fontSize: '0.8rem',
                                opacity: 0.6,
                                lineHeight: 1.3,
                              }}>
                                {category.description}
                              </p>
                            )}
                            <p style={{
                              margin: '0.25rem 0 0 0',
                              fontSize: '1rem',
                              fontWeight: 600,
                              color: getBalanceColor(categoryBalances[catId] || 0),
                            }}>
                              {loadingBalances ? '...' : formatCurrency(categoryBalances[catId] || 0)}
                            </p>
                          </div>
                        </DraggableCard>
                      )
                    ))}

                    {groupCategories.length === 0 && !createForGroupId && (
                      <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0' }}>
                        No categories in this group
                      </p>
                    )}

                    {/* Drop zone at end of category list */}
                    {dragType === 'category' && groupCategories.length > 0 && (
                      <CategoryEndDropZone
                        groupId={group.id}
                        isActive={dragOverId === `__end__${group.id}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragOverId(`__end__${group.id}`)
                          setDragOverGroupId(group.id)
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation()
                          setDragOverId(null)
                        }}
                        onDrop={(e) => {
                          e.stopPropagation()
                          handleCategoryDrop(e, '__group_end__', group.id)
                        }}
                      />
                    )}

                    {createForGroupId === group.id && (
                      <CategoryForm
                        initialData={{ name: '', category_group_id: group.id }}
                        onSubmit={(data) => handleCreateCategory(data, group.id)}
                        onCancel={() => setCreateForGroupId(null)}
                        submitLabel="Create"
                        categoryGroups={categoryGroups}
                      />
                    )}
                  </div>

                  {/* Bottom add category button */}
                  {createForGroupId !== group.id && (
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
                      <Button variant="small" onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                        + Add Category
                      </Button>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>
          )
        })}

        {/* Drop zone for reordering groups to end */}
        {dragType === 'group' && sortedGroups.length > 0 && (
          <DropZone
            isActive={dragOverId === '__end__'}
            onDragOver={(e) => { e.preventDefault(); setDragOverId('__end__') }}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleGroupDrop(e, '__end__')}
            label="Move group to end"
          />
        )}

        {/* Uncategorized section */}
        {(() => {
          const ungroupedCategories = (categoriesByGroup['ungrouped'] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)
          const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === 'ungrouped'
          const draggedCategory = draggedId && dragType === 'category' ? categories[draggedId] : null
          const isMovingToDifferentGroup = draggedCategory && draggedCategory.category_group_id !== null

          if (ungroupedCategories.length === 0 && !createForGroupId && categoryGroups.length > 0 && dragType !== 'category') {
            return null
          }

          return (
            <div
              onDragOver={(e) => handleDragOverGroup(e, 'ungrouped')}
              onDragLeave={handleDragLeaveGroup}
              onDrop={(e) => handleDropOnGroup(e, 'ungrouped')}
              style={{
                background: (isCategoryMovingHere && isMovingToDifferentGroup)
                  ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
                  : 'color-mix(in srgb, currentColor 5%, transparent)',
                borderRadius: '12px',
                padding: '1rem',
                border: (isCategoryMovingHere && isMovingToDifferentGroup)
                  ? `2px dashed ${colors.primary}`
                  : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
              }}>
                <h3 style={{ ...sectionHeader, margin: 0, opacity: 0.7 }}>
                  Uncategorized
                  <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
                    ({ungroupedCategories.length})
                  </span>
                </h3>
                <Button variant="small" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
                  + Category
                </Button>
              </div>

              <div style={listContainer}>
                {ungroupedCategories.map(([catId, category]) => (
                  editingCategoryId === catId ? (
                    <CategoryForm
                      key={catId}
                      initialData={{
                        name: category.name,
                        description: category.description,
                        category_group_id: category.category_group_id,
                        default_monthly_amount: category.default_monthly_amount,
                        default_monthly_type: category.default_monthly_type,
                      }}
                      onSubmit={(data) => handleUpdateCategory(catId, data)}
                      onCancel={() => setEditingCategoryId(null)}
                      submitLabel="Save"
                      categoryGroups={categoryGroups}
                      showGroupSelector={true}
                    />
                  ) : (
                    <DraggableCard
                      key={catId}
                      isDragging={dragType === 'category' && draggedId === catId}
                      isDragOver={dragOverId === catId}
                      onDragStart={(e) => handleCategoryDragStart(e, catId)}
                      onDragOver={(e) => handleCategoryDragOver(e, catId, 'ungrouped')}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleCategoryDrop(e, catId, 'ungrouped')}
                      onEdit={() => setEditingCategoryId(catId)}
                      onDelete={() => handleDeleteCategory(catId)}
                      onMoveUp={() => handleMoveCategory(catId, 'up')}
                      onMoveDown={() => handleMoveCategory(catId, 'down')}
                      canMoveUp={ungroupedCategories.findIndex(([cId]) => cId === catId) > 0}
                      canMoveDown={ungroupedCategories.findIndex(([cId]) => cId === catId) < ungroupedCategories.length - 1}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={itemTitle}>{category.name}</span>
                          {category.default_monthly_amount !== undefined && category.default_monthly_amount > 0 && (
                            <span style={{
                              fontSize: '0.75rem',
                              opacity: 0.8,
                              background: 'color-mix(in srgb, currentColor 10%, transparent)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                            }}>
                              Default: {category.default_monthly_type === 'percentage'
                                ? <><span style={{ color: colors.success, fontWeight: 500 }}>{category.default_monthly_amount}%</span> of prev income</>
                                : <><span style={{ color: colors.success, fontWeight: 500 }}>{formatCurrency(category.default_monthly_amount)}</span>/mo</>}
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p style={{
                            margin: '0.25rem 0 0 0',
                            fontSize: '0.8rem',
                            opacity: 0.6,
                            lineHeight: 1.3,
                          }}>
                            {category.description}
                          </p>
                        )}
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: getBalanceColor(categoryBalances[catId] || 0),
                        }}>
                          {loadingBalances ? '...' : formatCurrency(categoryBalances[catId] || 0)}
                        </p>
                      </div>
                    </DraggableCard>
                  )
                ))}

                {ungroupedCategories.length === 0 && dragType === 'category' && (
                  <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0', textAlign: 'center' }}>
                    Drop here to uncategorize
                  </p>
                )}

                {/* Drop zone at end of ungrouped category list */}
                {dragType === 'category' && ungroupedCategories.length > 0 && (
                  <CategoryEndDropZone
                    groupId="ungrouped"
                    isActive={dragOverId === '__end__ungrouped'}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDragOverId('__end__ungrouped')
                      setDragOverGroupId('ungrouped')
                    }}
                    onDragLeave={(e) => {
                      e.stopPropagation()
                      setDragOverId(null)
                    }}
                    onDrop={(e) => {
                      e.stopPropagation()
                      handleCategoryDrop(e, '__group_end__', 'ungrouped')
                    }}
                  />
                )}

                {createForGroupId === 'ungrouped' && (
                  <CategoryForm
                    initialData={{ name: '', category_group_id: null }}
                    onSubmit={(data) => handleCreateCategory(data, 'ungrouped')}
                    onCancel={() => setCreateForGroupId(null)}
                    submitLabel="Create"
                    categoryGroups={categoryGroups}
                  />
                )}
              </div>

              {/* Bottom add category button for ungrouped */}
              {createForGroupId !== 'ungrouped' && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
                  <Button variant="small" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
                    + Add Category
                  </Button>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Add Group button/form */}
      {showCreateGroupForm ? (
        <GroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowCreateGroupForm(false)}
          submitLabel="Create Group"
        />
      ) : (
        <Button variant="primary-large" onClick={() => setShowCreateGroupForm(true)}>
          + Add Category Group
        </Button>
      )}
    </div>
  )
}

// Category Form
interface CategoryFormProps {
  initialData?: CategoryFormData
  onSubmit: (data: CategoryFormData) => void
  onCancel: () => void
  submitLabel: string
  categoryGroups?: CategoryGroup[]
  showGroupSelector?: boolean
}

function CategoryForm({ initialData, onSubmit, onCancel, submitLabel, categoryGroups = [], showGroupSelector = false }: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>(initialData || { name: '', category_group_id: null })
  const [defaultAmount, setDefaultAmount] = useState(initialData?.default_monthly_amount?.toString() || '')
  const [defaultType, setDefaultType] = useState<DefaultAmountType>(initialData?.default_monthly_type || 'fixed')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsSubmitting(true)
    const parsedAmount = parseFloat(defaultAmount)
    const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0
    onSubmit({
      ...formData,
      description: formData.description?.trim() || undefined,
      default_monthly_amount: hasValidAmount ? parsedAmount : undefined,
      default_monthly_type: hasValidAmount ? defaultType : undefined,
    })
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Category Name" htmlFor="category-name">
        <TextInput
          id="category-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Groceries, Rent, Gas"
          required
          autoFocus
        />
      </FormField>
      <FormField label="Description (optional)" htmlFor="category-description">
        <TextAreaInput
          id="category-description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What is this category used for?"
          minHeight="3rem"
        />
      </FormField>
      {showGroupSelector && (
        <FormField label="Category Group" htmlFor="category-group">
          <SelectInput
            id="category-group"
            value={formData.category_group_id || 'ungrouped'}
            onChange={(e) => setFormData({
              ...formData,
              category_group_id: e.target.value === 'ungrouped' ? null : e.target.value
            })}
          >
            <option value="ungrouped">Uncategorized</option>
            {categoryGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </SelectInput>
        </FormField>
      )}
      <FormField label="Default Monthly Allocation (optional)" htmlFor="default-amount">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <SelectInput
            id="default-type"
            value={defaultType}
            onChange={(e) => setDefaultType(e.target.value as DefaultAmountType)}
            style={{ width: 'auto', flex: '0 0 auto' }}
          >
            <option value="fixed">Fixed $</option>
            <option value="percentage">% of Prev Income</option>
          </SelectInput>
          {defaultType === 'fixed' ? (
            <CurrencyInput
              id="default-amount"
              value={defaultAmount}
              onChange={setDefaultAmount}
              placeholder="$0.00"
            />
          ) : (
            <TextInput
              id="default-amount"
              type="number"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
              style={{ width: '80px' }}
            />
          )}
          {defaultType === 'percentage' && <span style={{ opacity: 0.6 }}>%</span>}
        </div>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
          {defaultType === 'fixed'
            ? 'Suggested fixed amount to allocate each month'
            : 'Percentage of previous month\'s total income'}
        </p>
      </FormField>
      <FormButtonGroup>
        <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Group Form
interface GroupFormProps {
  initialData?: GroupFormData
  onSubmit: (data: GroupFormData) => void
  onCancel: () => void
  submitLabel: string
}

function GroupForm({ initialData, onSubmit, onCancel, submitLabel }: GroupFormProps) {
  const [formData, setFormData] = useState<GroupFormData>(initialData || { name: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsSubmitting(true)
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Group Name" htmlFor="group-name">
        <TextInput
          id="group-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Housing, Transportation, Food"
          required
          autoFocus
        />
      </FormField>
      <FormButtonGroup>
        <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

// Drop zone for adding category to end of group
interface CategoryEndDropZoneProps {
  groupId: string
  isActive: boolean
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

function CategoryEndDropZone({ isActive, onDragOver, onDragLeave, onDrop }: CategoryEndDropZoneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        position: 'relative',
        height: '2rem',
        marginTop: '-0.25rem',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: '3px',
          background: colors.primary,
          borderRadius: '2px',
          opacity: isActive ? 1 : 0.3,
          transition: 'opacity 0.15s',
          boxShadow: isActive ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
        }}
      />
      {isActive && (
        <span style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '0.75rem',
          opacity: 0.7,
          background: 'var(--background, #1a1a1a)',
          padding: '0 0.5rem',
          whiteSpace: 'nowrap',
        }}>
          Move to end
        </span>
      )}
    </div>
  )
}

export default Categories
