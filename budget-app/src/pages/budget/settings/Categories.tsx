import { useState, useEffect, useMemo } from 'react'
import { useCategoriesPage, useBudgetData, useAutoRecalculation } from '@hooks'
import { useApp, useBudget } from '@contexts'
import {
  Button,
  formatCurrency,
  getBalanceColor,
  getAllocatedColor,
  CollapsibleSection,
  bannerQueue,
} from '@components/ui'
import { useIsMobile } from '@hooks'
import { UNGROUPED_CATEGORY_GROUP_ID } from '@constants'
import {
  CategoryGroupForm,
  CategoryForm,
} from '@components/budget/Categories'
import { SettingsCategoryGroupRows } from '@components/budget/Categories/SettingsCategoryGroupRows'
import { RecalculateAllButton } from '@components/budget/Month'

function Categories() {
  const { selectedBudgetId } = useBudget()
  const { monthMap, isLoading: isBudgetLoading } = useBudgetData()

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

  // Auto-trigger recalculation when navigating to Categories settings if ANY month needs recalc
  useAutoRecalculation({ budgetId: selectedBudgetId, monthMap, checkAnyMonth: true, additionalCondition: !isBudgetLoading && !isLoading && !!currentBudget, logPrefix: '[Settings/Categories]' })

  const isMobile = useIsMobile()
  const { addLoadingHold, removeLoadingHold } = useApp()

  // Add loading hold while loading - keep it up until budget data is fully loaded
  useEffect(() => {
    if (isBudgetLoading || isLoading || !currentBudget) {
      addLoadingHold('categories', 'Loading categories...')
    } else {
      removeLoadingHold('categories')
    }
    return () => removeLoadingHold('categories')
  }, [isBudgetLoading, isLoading, currentBudget, addLoadingHold, removeLoadingHold])

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

  // Don't show "No budget found" while still loading
  if (isBudgetLoading || isLoading) {
    return null
  }

  if (!currentBudget) {
    return <p>No budget found. Please log in.</p>
  }

  // Calculate stats for header
  const totalCurrentAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.current, 0)
  const totalAllocated = Object.values(categoryBalances).reduce((sum, bal) => sum + bal.total, 0)
  const availableNow = getOnBudgetTotal() - totalCurrentAllocated
  const hasFutureAllocations = Math.abs(totalAllocated - totalCurrentAllocated) > 0.01

  // Column header style - matches month pages
  const columnHeaderStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.5rem',
    borderBottom: '2px solid rgba(255,255,255,0.2)',
  }

  return (
    <div>

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
              <span style={{ color: getAllocatedColor(totalCurrentAllocated), fontWeight: 600 }}>{loadingBalances ? '...' : formatCurrency(totalCurrentAllocated)}</span>
              {hasFutureAllocations && <span style={{ opacity: 0.5, fontSize: '0.8rem' }}> ({formatCurrency(totalAllocated)} total)</span>}
            </span>
            <span>
              <span style={{ opacity: 0.6 }}>Available: </span>
              <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{loadingBalances ? '...' : formatCurrency(availableNow)}</span>
            </span>
            <span style={{ opacity: 0.6 }}>
              Use ▲▼ buttons to reorder categories.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <RecalculateAllButton />
          </div>
        </div>
      </div>

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Category, Balance, Description, Actions
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 2fr 1fr',
        marginTop: '1rem',
        marginBottom: '1.5rem',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: '3.5rem', // Below the stats header
          zIndex: 49,
          backgroundColor: '#242424',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Column headers row - desktop only */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Category</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Balance</div>
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

        {/* Render groups */}
        {sortedGroups.map((group, groupIndex) => {
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
            />
          )
        })}

        {/* Uncategorized section - always rendered last, after all groups */}
        {(ungroupedCategories.length > 0 || createForGroupId === 'ungrouped') && (
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
          />
        )}

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
                      {formatCurrency(category.balance)}
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

