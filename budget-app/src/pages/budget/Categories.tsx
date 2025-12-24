import { useState } from 'react'
import { useCategoriesPage } from '../../hooks'
import {
  ErrorAlert,
  Button,
  DropZone,
  StatCard,
  formatCurrency,
  getBalanceColor,
} from '../../components/ui'
import { pageSubtitle, colors } from '../../styles/shared'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  CategoryGroupForm,
  CategoryGroupCard,
  UncategorizedSection,
} from '../../components/budget/Categories'

function Categories() {
  const {
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

  // UI state for editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  // Reconciliation state
  const [isCheckingMismatch, setIsCheckingMismatch] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)

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

      {/* Category Balance Reconciliation Warning */}
      {categoryBalanceMismatch && Object.keys(categoryBalanceMismatch).length > 0 && (
        <div style={{
          background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '1rem',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#f59e0b' }}>
              ⚠️ Category Balance Mismatch Detected
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {Object.keys(categoryBalanceMismatch).length} categor{Object.keys(categoryBalanceMismatch).length !== 1 ? 'ies have' : 'y has'} balances that don't match the sum of allocations minus expenses.
            </p>
          </div>
          <button
            onClick={async () => {
              setIsReconciling(true)
              try {
                await recalculateAndSaveCategoryBalances()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to reconcile')
              } finally {
                setIsReconciling(false)
              }
            }}
            disabled={isReconciling}
            style={{
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontWeight: 600,
              cursor: isReconciling ? 'not-allowed' : 'pointer',
              opacity: isReconciling ? 0.7 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isReconciling ? '⏳ Reconciling...' : '🔄 Reconcile Now'}
          </button>
        </div>
      )}

      {/* Manual Reconcile Button (when no mismatch) */}
      {!categoryBalanceMismatch && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '1rem',
          gap: '0.5rem',
        }}>
          <button
            onClick={async () => {
              setIsCheckingMismatch(true)
              try {
                await checkCategoryBalanceMismatch()
              } finally {
                setIsCheckingMismatch(false)
              }
            }}
            disabled={isCheckingMismatch}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              cursor: isCheckingMismatch ? 'not-allowed' : 'pointer',
              opacity: isCheckingMismatch ? 0.6 : 1,
            }}
            title="Check if category balances match allocation/expense history"
          >
            {isCheckingMismatch ? '⏳ Checking...' : '🔍 Check Balances'}
          </button>
          <button
            onClick={async () => {
              setIsReconciling(true)
              try {
                await recalculateAndSaveCategoryBalances()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to reconcile')
              } finally {
                setIsReconciling(false)
              }
            }}
            disabled={isReconciling}
            style={{
              background: 'color-mix(in srgb, currentColor 10%, transparent)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              cursor: isReconciling ? 'not-allowed' : 'pointer',
              opacity: isReconciling ? 0.6 : 1,
            }}
            title="Recalculate all category balances from allocation/expense history"
          >
            {isReconciling ? '⏳ Reconciling...' : '🔄 Reconcile All'}
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {(() => {
        const totalCurrentAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.current, 0)
        const totalAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.total, 0)
        const availableNow = getOnBudgetTotal() - totalCurrentAllocated
        const availableTotal = getOnBudgetTotal() - totalAllocated
        const hasFutureAllocations = Math.abs(totalAllocated - totalCurrentAllocated) > 0.01

        return (
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
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Allocated Now</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600, color: colors.primary }}>
                {loadingBalances ? '...' : formatCurrency(totalCurrentAllocated)}
              </p>
              {hasFutureAllocations && (
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
                  {loadingBalances ? '' : `${formatCurrency(totalAllocated)} total`}
                </p>
              )}
            </StatCard>
            <StatCard style={{ flex: 1, minWidth: '120px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Available Now</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.4rem', fontWeight: 600, color: getBalanceColor(availableNow) }}>
                {loadingBalances ? '...' : formatCurrency(availableNow)}
              </p>
              {hasFutureAllocations && (
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
                  {loadingBalances ? '' : `${formatCurrency(availableTotal)} after future`}
                </p>
              )}
            </StatCard>
          </div>
        )
      })()}

      {/* Category Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
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
        <Button variant="primary-large" onClick={() => setShowCreateGroupForm(true)}>
          + Add Category Group
        </Button>
      )}
    </div>
  )
}

export default Categories
