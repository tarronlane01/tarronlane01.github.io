import { useState, useEffect, useMemo } from 'react'
import { useCategoriesPage, useBudgetData, useCategoryValidation, useEnsureBalancesFresh } from '@hooks'
import { useApp } from '@contexts'
import {
  Button,
  CollapsibleSection,
  bannerQueue,
  formatStatsCurrency,
  getBalanceColor,
} from '@components/ui'
import { useIsMobile } from '@hooks'
import { UNGROUPED_CATEGORY_GROUP_ID } from '@constants'
import {
  CategoryGroupForm,
  CategoryForm,
  SettingsCategoryStatsHeader,
} from '@components/budget/Categories'
import { SettingsCategoryGroupRows } from '@components/budget/Categories/SettingsCategoryGroupRows'

function Categories() {
  const { isLoading: isBudgetLoading, isFetching: isBudgetFetching, totalAvailable } = useBudgetData()

  const {
    // Data
    currentBudget,
    categories,
    categoryGroups,
    categoriesByGroup,
    hiddenCategories,
    sortedGroups: allSortedGroups,
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
  } = useCategoriesPage()

  const isMobile = useIsMobile()
  const { addLoadingHold, removeLoadingHold } = useApp()

  // Check fetching state BEFORE rendering to avoid flashing empty values
  const isDataLoading = isBudgetLoading || isLoading || isBudgetFetching || !currentBudget
  // Ensure months are fresh in cache before calculating balances (refetches if stale)
  useEnsureBalancesFresh(!isDataLoading && !!currentBudget)
  // Add loading hold while loading or fetching - keep it up until budget data is fully loaded
  useEffect(() => {
    if (isDataLoading) {
      addLoadingHold('categories', 'Loading categories...')
    } else {
      removeLoadingHold('categories')
    }
    return () => removeLoadingHold('categories')
  }, [isDataLoading, addLoadingHold, removeLoadingHold])

  // UI state for editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [createForGroupId, setCreateForGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false)

  // Filter out ungrouped group from sortedGroups so it appears last
  const sortedGroups = useMemo(() => {
    return allSortedGroups.filter(g => g.id !== UNGROUPED_CATEGORY_GROUP_ID)
  }, [allSortedGroups])

  // Create ungrouped group object for table display - must be before early returns
  const ungroupedGroup = useMemo(() => ({
    id: UNGROUPED_CATEGORY_GROUP_ID,
    name: 'Uncategorized',
    sort_order: sortedGroups.length,
  }), [sortedGroups.length])

  const ungroupedCategories = (categoriesByGroup[UNGROUPED_CATEGORY_GROUP_ID] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)

  // Show errors via banner system
  useEffect(() => {
    if (error) {
      console.error('[Settings/Categories] Error:', error)
      bannerQueue.add({
        type: 'error',
        message: 'Failed to update categories. See console for details.',
        autoDismissMs: 0,
      })
      // Clear error after showing banner
      setError(null)
    }
  }, [error, setError])

  // Calculate totals for display using pre-calculated values from budget document
  // These must be calculated before any early returns (rules of hooks)
  // Note: getOnBudgetTotal is a callback that depends on accounts, so we need to call it
  // to get the current value, not just depend on the function reference
  const onBudgetTotal = useMemo(() => {
    const total = getOnBudgetTotal()
    return total
  }, [getOnBudgetTotal])

  // Use validation hook to calculate and validate category balances
  const {
    allocated,
    unallocated,
    calculationMismatch,
    relationshipMismatch,
  } = useCategoryValidation({
    categories,
    categoryBalances,
    totalAvailable,
    onBudgetTotal,
    isDataLoading,
    loadingBalances,
    currentBudget,
  })

  // Don't render content if data is loading or fetching (cache invalid) - show loading overlay instead
  if (isDataLoading || !currentBudget) {
    return isDataLoading ? null : <p>No budget found. Please log in.</p>
  }

  // Column header style - matches month pages
  const columnHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    paddingTop: '0.75rem', // More space above to match visual spacing below
    paddingBottom: '0.5rem',
    paddingLeft: '0.5rem',
    paddingRight: '0.5rem',
    borderBottom: '2px solid var(--border-medium)',
  }

  return (
    <div>
      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Category, Default Allocation, Available Now, Total Allocated, Description, Actions
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 2fr 1fr',
        marginBottom: '1.5rem',
      }}>
        {/* Sticky wrapper using subgrid - contains both stats header and column headers as subgrid rows */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0, // Sticky at top, stats header will be first row inside
          zIndex: 50,
          backgroundColor: 'var(--sticky-header-bg)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* First subgrid row: stats header */}
          <SettingsCategoryStatsHeader
            onBudgetTotal={onBudgetTotal}
            allocated={allocated}
            unallocated={unallocated}
            relationshipMismatch={relationshipMismatch}
            calculationMismatch={calculationMismatch}
          />

          {/* Second subgrid row: column headers */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Category</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Default</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Available Now</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Total Allocated</div>
              <div style={columnHeaderStyle}>Description</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Actions</div>
            </>
          )}
        </div>

        {/* Empty state */}
        {Object.keys(categories).length === 0 && categoryGroups.length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.7, textAlign: 'center', padding: '2rem' }}>
            No categories yet. Create a group first, then add categories!
          </p>
        )}

        {/* Calculate start row indices for each group */}
        {(() => {
          const groupStartIndices: Record<string, number> = {}
          let currentIndex = 0
          sortedGroups.forEach(group => {
            const groupCategories = (categoriesByGroup[group.id] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)
            groupStartIndices[group.id] = currentIndex
            currentIndex += groupCategories.length
          })

          return sortedGroups.map((group, groupIndex) => {
            const groupCategories = (categoriesByGroup[group.id] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)
            if (groupCategories.length === 0 && editingGroupId !== group.id && createForGroupId !== group.id) return null

            // If editing group, show form outside grid
            if (editingGroupId === group.id) {
              return (
                <div key={group.id} style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
                  <CategoryGroupForm
                    initialData={{ name: group.name }}
                    onSubmit={(data) => {
                      handleUpdateGroup(group.id, data)
                      setEditingGroupId(null)
                    }}
                    onCancel={() => setEditingGroupId(null)}
                    submitLabel="Save"
                  />
                </div>
              )
            }

            return (
              <SettingsCategoryGroupRows
                key={group.id}
                group={group}
                categories={groupCategories}
                categoryGroups={categoryGroups}
                categoryBalances={categoryBalances}
                loadingBalances={loadingBalances}
                editingCategoryId={editingCategoryId}
                createForGroupId={createForGroupId}
                setEditingCategoryId={setEditingCategoryId}
                setCreateForGroupId={setCreateForGroupId}
                handleUpdateCategory={handleUpdateCategory}
                handleDeleteCategory={handleDeleteCategory}
                handleMoveCategory={handleMoveCategory}
                handleCreateCategory={handleCreateCategory}
                isMobile={isMobile}
                canMoveGroupUp={groupIndex > 0}
                canMoveGroupDown={groupIndex < sortedGroups.length - 1}
                onEditGroup={() => setEditingGroupId(group.id)}
                onDeleteGroup={() => handleDeleteGroup(group.id)}
                onMoveGroupUp={() => handleMoveGroup(group.id, 'up')}
                onMoveGroupDown={() => handleMoveGroup(group.id, 'down')}
                startRowIndex={groupStartIndices[group.id] ?? 0}
              />
            )
          })
        })()}

        {/* Uncategorized section - always rendered last, after all groups */}
        {(ungroupedCategories.length > 0 || createForGroupId === 'ungrouped') && (() => {
          // Calculate startRowIndex for ungrouped by counting all categories in sorted groups
          const startRowIndex = sortedGroups.reduce((sum, group) => {
            const groupCats = (categoriesByGroup[group.id] || []).sort((a, b) => a[1].sort_order - b[1].sort_order)
            return sum + groupCats.length
          }, 0)

          return (
            <SettingsCategoryGroupRows
              group={ungroupedGroup}
              categories={ungroupedCategories}
              categoryGroups={categoryGroups}
              categoryBalances={categoryBalances}
              loadingBalances={loadingBalances}
              editingCategoryId={editingCategoryId}
              createForGroupId={createForGroupId}
              setEditingCategoryId={setEditingCategoryId}
              setCreateForGroupId={setCreateForGroupId}
              handleUpdateCategory={handleUpdateCategory}
              handleDeleteCategory={handleDeleteCategory}
              handleMoveCategory={handleMoveCategory}
              handleCreateCategory={handleCreateCategory}
              isMobile={isMobile}
              isUngrouped
              canMoveGroupUp={false}
              canMoveGroupDown={false}
              onEditGroup={() => {}} // Uncategorized can't be edited
              onDeleteGroup={() => {}} // Uncategorized can't be deleted
              onMoveGroupUp={() => {}}
              onMoveGroupDown={() => {}}
              startRowIndex={startRowIndex}
            />
          )
        })()}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '1rem' }} />
      </div>

      {/* Hidden categories section */}
      {hiddenCategories.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <CollapsibleSection title="Hidden Categories" count={hiddenCategories.length}>
            <div style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              background: 'color-mix(in srgb, currentColor 5%, transparent)',
              borderRadius: '8px',
              fontSize: '0.85rem',
            }}>
              <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8 }}>
                <strong>🙈 Hidden categories</strong> are excluded from dropdowns and balance displays.
                They're useful for historical categories that you want to keep for record-keeping but don't need in everyday use.
              </p>
              <p style={{ margin: 0, opacity: 0.6 }}>
                To unhide a category, click it to edit and uncheck "Hidden category".
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {hiddenCategories.map(([catId, category]) => (
                editingCategoryId === catId ? (
                  <CategoryForm
                    key={catId}
                    initialData={{
                      name: category.name,
                      description: category.description,
                      category_group_id: category.category_group_id,
                      default_monthly_amount: category.default_monthly_amount,
                      default_monthly_type: category.default_monthly_type,
                      is_hidden: category.is_hidden,
                    }}
                    onSubmit={(data) => { handleUpdateCategory(catId, data); setEditingCategoryId(null) }}
                    onCancel={() => setEditingCategoryId(null)}
                    submitLabel="Save"
                    categoryGroups={categoryGroups}
                    showGroupSelector={true}
                  />
                ) : (
                  <div
                    key={catId}
                    onClick={() => setEditingCategoryId(catId)}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'color-mix(in srgb, currentColor 3%, transparent)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: 0.7,
                    }}
                  >
                    <span>{category.name}</span>
                    <span style={{ color: getBalanceColor(category.balance), fontWeight: 500 }}>
                      {formatStatsCurrency(category.balance)}
                    </span>
                  </div>
                )
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

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

