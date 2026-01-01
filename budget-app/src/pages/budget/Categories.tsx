import { useState, useEffect } from 'react'
import { useCategoriesPage } from '../../hooks'
import { useApp } from '../../contexts/app_context'
import {
  ErrorAlert,
  Button,
  DropZone,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import { colors } from '../../styles/shared'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  CategoryGroupForm,
  CategoryGroupCard,
  UncategorizedSection,
} from '../../components/budget/Categories'
import { RecalculateAllButton } from '../../components/budget/Month'

function Categories() {
  const {
    // Data
    currentBudget,
    categories,
    categoryGroups,
    categoriesByGroup,
    sortedGroups,
    categoryBalances,
    isLoading,
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
  } = useCategoriesPage()

  const isMobile = useIsMobile()
  const { addLoadingHold, removeLoadingHold } = useApp()

  // Add loading hold while loading
  useEffect(() => {
    if (isLoading) {
      addLoadingHold('categories', 'Loading categories...')
    } else {
      removeLoadingHold('categories')
    }
    return () => removeLoadingHold('categories')
  }, [isLoading, addLoadingHold, removeLoadingHold])

  // UI state for editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  // Calculate stats for header
  const totalCurrentAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.current, 0)
  const totalAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.total, 0)
  const availableNow = getOnBudgetTotal() - totalCurrentAllocated
  const hasFutureAllocations = Math.abs(totalAllocated - totalCurrentAllocated) > 0.01

  if (isLoading) return null

  return (
    <div>
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Sticky header: title + stats + buttons */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#242424',
        marginLeft: 'calc(-1 * var(--page-padding, 2rem))',
        marginRight: 'calc(-1 * var(--page-padding, 2rem))',
        paddingLeft: 'var(--page-padding, 2rem)',
        paddingRight: 'var(--page-padding, 2rem)',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}>
        {/* Title + Stats + Buttons row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem 1rem',
          fontSize: '0.85rem',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', flex: 1, alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Categories:</span>
            <span>
              <span style={{ opacity: 0.6 }}>On-Budget: </span>
              <span style={{ color: getBalanceColor(getOnBudgetTotal()), fontWeight: 600 }}>{formatCurrency(getOnBudgetTotal())}</span>
            </span>
            <span>
              <span style={{ opacity: 0.6 }}>Allocated: </span>
              <span style={{ color: colors.primary, fontWeight: 600 }}>{loadingBalances ? '...' : formatCurrency(totalCurrentAllocated)}</span>
              {hasFutureAllocations && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}> ({formatCurrency(totalAllocated)} total)</span>}
            </span>
            <span>
              <span style={{ opacity: 0.6 }}>Available: </span>
              <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{loadingBalances ? '...' : formatCurrency(availableNow)}</span>
            </span>
            <span style={{ opacity: 0.6 }}>
              {isMobile
                ? 'Drag to move between groups.'
                : 'Drag categories between groups, or use ▲▼ to reorder.'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <RecalculateAllButton />
          </div>
        </div>
      </div>

      {/* Category Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', paddingTop: '1rem' }}>
        {Object.keys(categories).length === 0 && categoryGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>No categories yet. Create a group first, then add categories!</p>
        )}

        {sortedGroups.map((group, groupIndex) => {
          const groupCategories = (categoriesByGroup[group.id] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)

          return (
            <CategoryGroupCard
              key={group.id}
              group={group}
              groupIndex={groupIndex}
              groupCategories={groupCategories}
              sortedGroups={sortedGroups}
              categoryGroups={categoryGroups}
              categoryBalances={categoryBalances}
              loadingBalances={loadingBalances}
              dragType={dragType}
              draggedId={draggedId}
              dragOverId={dragOverId}
              dragOverGroupId={dragOverGroupId}
              editingCategoryId={editingCategoryId}
              setEditingCategoryId={setEditingCategoryId}
              createForGroupId={createForGroupId}
              setCreateForGroupId={setCreateForGroupId}
              editingGroupId={editingGroupId}
              setEditingGroupId={setEditingGroupId}
              handleCreateCategory={handleCreateCategory}
              handleUpdateCategory={handleUpdateCategory}
              handleDeleteCategory={handleDeleteCategory}
              handleMoveCategory={handleMoveCategory}
              handleUpdateGroup={handleUpdateGroup}
              handleDeleteGroup={handleDeleteGroup}
              handleMoveGroup={handleMoveGroup}
              handleCategoryDragStart={handleCategoryDragStart}
              handleCategoryDragOver={handleCategoryDragOver}
              handleDragOverGroup={handleDragOverGroup}
              handleDragLeave={handleDragLeave}
              handleDragLeaveGroup={handleDragLeaveGroup}
              handleDragEnd={handleDragEnd}
              handleCategoryDrop={handleCategoryDrop}
              handleDropOnGroup={handleDropOnGroup}
              handleGroupDragStart={handleGroupDragStart}
              handleGroupDrop={handleGroupDrop}
              setDragOverId={setDragOverId}
              setDragOverGroupId={setDragOverGroupId}
              isMobile={isMobile}
              categories={categories}
            />
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
        <UncategorizedSection
          ungroupedCategories={(categoriesByGroup['ungrouped'] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)}
          categoryGroups={categoryGroups}
          categoryBalances={categoryBalances}
          loadingBalances={loadingBalances}
          dragType={dragType}
          draggedId={draggedId}
          dragOverId={dragOverId}
          dragOverGroupId={dragOverGroupId}
          editingCategoryId={editingCategoryId}
          setEditingCategoryId={setEditingCategoryId}
          createForGroupId={createForGroupId}
          setCreateForGroupId={setCreateForGroupId}
          handleCreateCategory={handleCreateCategory}
          handleUpdateCategory={handleUpdateCategory}
          handleDeleteCategory={handleDeleteCategory}
          handleMoveCategory={handleMoveCategory}
          handleCategoryDragStart={handleCategoryDragStart}
          handleCategoryDragOver={handleCategoryDragOver}
          handleDragOverGroup={handleDragOverGroup}
          handleDragLeaveGroup={handleDragLeaveGroup}
          handleDragLeave={handleDragLeave}
          handleDragEnd={handleDragEnd}
          handleCategoryDrop={handleCategoryDrop}
          handleDropOnGroup={handleDropOnGroup}
          setDragOverId={setDragOverId}
          setDragOverGroupId={setDragOverGroupId}
          categories={categories}
          hasGroups={categoryGroups.length > 0}
        />
      </div>

      {/* Add Group button/form */}
      {showCreateGroupForm ? (
        <CategoryGroupForm
          onSubmit={(data) => {
            handleCreateGroup(data)
            setShowCreateGroupForm(false)
          }}
          onCancel={() => setShowCreateGroupForm(false)}
          submitLabel="Create Group"
        />
      ) : (
        <Button variant="primary-large" actionName="Open Add Category Group Form" onClick={() => setShowCreateGroupForm(true)}>
          + Add Category Group
        </Button>
      )}
    </div>
  )
}

export default Categories
