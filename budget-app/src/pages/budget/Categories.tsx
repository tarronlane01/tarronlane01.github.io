import { useState, type FormEvent, type DragEvent } from 'react'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import app from '../../firebase'
import { useBudget, type Category, type CategoryGroup } from '../../contexts/budget_context'
import {
  ErrorAlert,
  Button,
  DraggableCard,
  DropZone,
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  StatCard,
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
  category_group_id: string | null
}

interface GroupFormData {
  name: string
}

type DragType = 'category' | 'group' | null

function Categories() {
  const { currentBudget, categories, setCategories, categoryGroups, setCategoryGroups } = useBudget()
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

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

  // Save functions
  async function saveCategories(newCategories: Category[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, categories: newCategories })
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

  async function saveBoth(newCategories: Category[], newGroups: CategoryGroup[]) {
    if (!currentBudget) return
    try {
      const budgetDocRef = doc(db, 'budgets', currentBudget.id)
      const budgetDoc = await getDoc(budgetDocRef)
      if (budgetDoc.exists()) {
        const data = budgetDoc.data()
        await setDoc(budgetDocRef, { ...data, categories: newCategories, category_groups: newGroups })
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

    const groupCategories = categories.filter(c =>
      (forGroupId === 'ungrouped' ? !c.category_group_id : c.category_group_id === forGroupId)
    )
    const maxSortOrder = groupCategories.length > 0
      ? Math.max(...groupCategories.map(c => c.sort_order))
      : -1

    const newCategory: Category = {
      id: `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name,
      category_group_id: effectiveGroupId,
      sort_order: maxSortOrder + 1,
    }

    const newCategories = [...categories, newCategory].sort((a, b) => a.sort_order - b.sort_order)
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
      const category = categories.find(c => c.id === categoryId)
      if (!category) return

      const oldGroupId = category.category_group_id || 'ungrouped'
      const newGroupId = formData.category_group_id

      // If group changed, update sort_order for the new group
      let newSortOrder = category.sort_order
      if (oldGroupId !== (newGroupId || 'ungrouped')) {
        const targetGroupCategories = categories.filter(c => {
          const catGroupId = c.category_group_id || 'ungrouped'
          return catGroupId === (newGroupId || 'ungrouped') && c.id !== categoryId
        })
        newSortOrder = targetGroupCategories.length > 0
          ? Math.max(...targetGroupCategories.map(c => c.sort_order)) + 1
          : 0
      }

      const newCategories = categories.map(cat =>
        cat.id === categoryId
          ? {
              ...cat,
              name: formData.name,
              category_group_id: newGroupId,
              sort_order: newSortOrder,
            }
          : cat
      )
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
      const newCategories = categories.filter(category => category.id !== categoryId)
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
      const newCategories = categories.map(category =>
        category.category_group_id === groupId
          ? { ...category, category_group_id: null }
          : category
      )
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

    const draggedCategory = categories.find(c => c.id === draggedId)
    if (!draggedCategory) return

    const newGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId
    const targetGroupCategories = categories.filter(c => {
      const catGroupId = c.category_group_id || 'ungrouped'
      return catGroupId === targetGroupId
    })

    let newCategories = categories.filter(c => c.id !== draggedId)
    let newSortOrder: number

    if (targetId === '__group_end__' || targetGroupCategories.length === 0 || !targetGroupCategories.find(c => c.id === targetId)) {
      const maxInGroup = targetGroupCategories.length > 0
        ? Math.max(...targetGroupCategories.filter(c => c.id !== draggedId).map(c => c.sort_order))
        : -1
      newSortOrder = maxInGroup + 1
    } else {
      const targetCategory = targetGroupCategories.find(c => c.id === targetId)
      if (targetCategory) {
        newSortOrder = targetCategory.sort_order
        newCategories = newCategories.map(c => {
          const catGroupId = c.category_group_id || 'ungrouped'
          if (catGroupId === targetGroupId && c.sort_order >= newSortOrder) {
            return { ...c, sort_order: c.sort_order + 1 }
          }
          return c
        })
      } else {
        newSortOrder = 0
      }
    }

    const updatedDraggedCategory: Category = {
      ...draggedCategory,
      category_group_id: newGroupId,
      sort_order: newSortOrder,
    }

    newCategories.push(updatedDraggedCategory)
    newCategories.sort((a, b) => a.sort_order - b.sort_order)

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
    const category = categories.find(c => c.id === categoryId)
    if (!category) return

    const groupId = category.category_group_id || 'ungrouped'
    const groupCategories = categories
      .filter(c => (c.category_group_id || 'ungrouped') === groupId)
      .sort((a, b) => a.sort_order - b.sort_order)

    const currentIndex = groupCategories.findIndex(c => c.id === categoryId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= groupCategories.length) return

    // Swap sort orders
    const targetCategory = groupCategories[targetIndex]
    const newCategories = categories.map(c => {
      if (c.id === categoryId) {
        return { ...c, sort_order: targetCategory.sort_order }
      }
      if (c.id === targetCategory.id) {
        return { ...c, sort_order: category.sort_order }
      }
      return c
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

  // Organize categories by group
  const categoriesByGroup = categories.reduce((acc, category) => {
    const groupId = category.category_group_id || 'ungrouped'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push(category)
    return acc
  }, {} as Record<string, Category[]>)

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

      <StatCard style={{ display: 'flex', gap: '2rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Categories</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {categories.length}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Groups</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.5rem', fontWeight: 600 }}>
            {categoryGroups.length}
          </p>
        </div>
      </StatCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {categories.length === 0 && categoryGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>No categories yet. Create a group first, then add categories!</p>
        )}

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupCategories = (categoriesByGroup[group.id] || []).sort((a, b) => a.sort_order - b.sort_order)
          const isGroupDragging = dragType === 'group' && draggedId === group.id
          const isGroupDragOver = dragType === 'group' && dragOverId === group.id
          const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === group.id
          const draggedCategory = draggedId && dragType === 'category' ? categories.find(c => c.id === draggedId) : null
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
                draggable={editingGroupId !== group.id}
                onDragStart={(e) => handleGroupDragStart(e, group.id)}
                onDragOver={(e) => {
                  handleDragOverGroup(e, group.id)
                }}
                onDragLeave={handleDragLeaveGroup}
                onDragEnd={handleDragEnd}
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
                  cursor: editingGroupId === group.id ? 'default' : 'grab',
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
                      {!isMobile && <span style={{ cursor: 'grab', opacity: 0.4 }}>⋮⋮</span>}
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
                    {groupCategories.map((category) => (
                      editingCategoryId === category.id ? (
                        <CategoryForm
                          key={category.id}
                          initialData={{ name: category.name, category_group_id: category.category_group_id }}
                          onSubmit={(data) => handleUpdateCategory(category.id, data)}
                          onCancel={() => setEditingCategoryId(null)}
                          submitLabel="Save"
                          categoryGroups={categoryGroups}
                          showGroupSelector={true}
                        />
                      ) : (
                        <DraggableCard
                          key={category.id}
                          isDragging={dragType === 'category' && draggedId === category.id}
                          isDragOver={dragOverId === category.id}
                          onDragStart={(e) => { e.stopPropagation(); handleCategoryDragStart(e, category.id) }}
                          onDragOver={(e) => handleCategoryDragOver(e, category.id, group.id)}
                          onDragLeave={handleDragLeave}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleCategoryDrop(e, category.id, group.id)}
                          onEdit={() => setEditingCategoryId(category.id)}
                          onDelete={() => handleDeleteCategory(category.id)}
                          onMoveUp={() => handleMoveCategory(category.id, 'up')}
                          onMoveDown={() => handleMoveCategory(category.id, 'down')}
                          canMoveUp={groupCategories.findIndex(c => c.id === category.id) > 0}
                          canMoveDown={groupCategories.findIndex(c => c.id === category.id) < groupCategories.length - 1}
                        >
                          <span style={itemTitle}>{category.name}</span>
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
          const ungroupedCategories = (categoriesByGroup['ungrouped'] || []).sort((a, b) => a.sort_order - b.sort_order)
          const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === 'ungrouped'
          const draggedCategory = draggedId && dragType === 'category' ? categories.find(c => c.id === draggedId) : null
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
                {ungroupedCategories.map((category) => (
                  editingCategoryId === category.id ? (
                    <CategoryForm
                      key={category.id}
                      initialData={{ name: category.name, category_group_id: category.category_group_id }}
                      onSubmit={(data) => handleUpdateCategory(category.id, data)}
                      onCancel={() => setEditingCategoryId(null)}
                      submitLabel="Save"
                      categoryGroups={categoryGroups}
                      showGroupSelector={true}
                    />
                  ) : (
                    <DraggableCard
                      key={category.id}
                      isDragging={dragType === 'category' && draggedId === category.id}
                      isDragOver={dragOverId === category.id}
                      onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                      onDragOver={(e) => handleCategoryDragOver(e, category.id, 'ungrouped')}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleCategoryDrop(e, category.id, 'ungrouped')}
                      onEdit={() => setEditingCategoryId(category.id)}
                      onDelete={() => handleDeleteCategory(category.id)}
                      onMoveUp={() => handleMoveCategory(category.id, 'up')}
                      onMoveDown={() => handleMoveCategory(category.id, 'down')}
                      canMoveUp={ungroupedCategories.findIndex(c => c.id === category.id) > 0}
                      canMoveDown={ungroupedCategories.findIndex(c => c.id === category.id) < ungroupedCategories.length - 1}
                    >
                      <span style={itemTitle}>{category.name}</span>
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsSubmitting(true)
    onSubmit(formData)
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
