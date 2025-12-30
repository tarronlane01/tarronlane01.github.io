import type { DragEvent } from 'react'
import type { Category, CategoryGroup } from '../../../contexts/budget_context'
import { Button, DraggableCard } from '../../ui'
import { formatCurrency, getBalanceColor } from '../../ui'
import {
  listContainer,
  itemTitle,
  sectionHeader,
  colors,
  reorderButton,
  reorderButtonGroup,
} from '../../../styles/shared'
import { CategoryForm, type CategoryFormData } from './CategoryForm'
import { CategoryGroupForm, type CategoryGroupFormData } from './CategoryGroupForm'
import { CategoryEndDropZone } from './CategoryEndDropZone'
import type { CategoryBalance } from '../../../hooks/useCategoriesPage'
import { logUserAction } from '@utils'

type CategoryEntry = [string, Category]
type DragType = 'category' | 'group' | null

interface CategoryGroupCardProps {
  group: CategoryGroup
  groupIndex: number
  groupCategories: CategoryEntry[]
  sortedGroups: CategoryGroup[]
  categoryGroups: CategoryGroup[]
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
  // Drag state
  dragType: DragType
  draggedId: string | null
  dragOverId: string | null
  dragOverGroupId: string | null
  // Edit state
  editingCategoryId: string | null
  setEditingCategoryId: (id: string | null) => void
  createForGroupId: string | null
  setCreateForGroupId: (id: string | null) => void
  editingGroupId: string | null
  setEditingGroupId: (id: string | null) => void
  // Category handlers
  handleCreateCategory: (data: CategoryFormData, groupId: string | null) => Promise<void>
  handleUpdateCategory: (id: string, data: CategoryFormData) => Promise<void>
  handleDeleteCategory: (id: string) => Promise<void>
  handleMoveCategory: (id: string, direction: 'up' | 'down') => Promise<void>
  // Group handlers
  handleUpdateGroup: (id: string, data: CategoryGroupFormData) => Promise<void>
  handleDeleteGroup: (id: string) => Promise<void>
  handleMoveGroup: (id: string, direction: 'up' | 'down') => Promise<void>
  // Drag handlers
  handleCategoryDragStart: (e: DragEvent, categoryId: string) => void
  handleCategoryDragOver: (e: DragEvent, categoryId: string, groupId: string) => void
  handleDragOverGroup: (e: DragEvent, groupId: string) => void
  handleDragLeave: () => void
  handleDragLeaveGroup: () => void
  handleDragEnd: () => void
  handleCategoryDrop: (e: DragEvent, targetId: string, targetGroupId: string) => Promise<void>
  handleDropOnGroup: (e: DragEvent, groupId: string) => Promise<void>
  handleGroupDragStart: (e: DragEvent, groupId: string) => void
  handleGroupDrop: (e: DragEvent, targetId: string) => Promise<void>
  setDragOverId: (id: string | null) => void
  setDragOverGroupId: (id: string | null) => void
  // UI state
  isMobile: boolean
  categories: Record<string, Category>
}

export function CategoryGroupCard({
  group,
  groupIndex,
  groupCategories,
  sortedGroups,
  categoryGroups,
  categoryBalances,
  loadingBalances,
  dragType,
  draggedId,
  dragOverId,
  dragOverGroupId,
  editingCategoryId,
  setEditingCategoryId,
  createForGroupId,
  setCreateForGroupId,
  editingGroupId,
  setEditingGroupId,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleUpdateGroup,
  handleDeleteGroup,
  handleMoveGroup,
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
  setDragOverId,
  setDragOverGroupId,
  isMobile,
  categories,
}: CategoryGroupCardProps) {
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
    <div>
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
        onDragOver={(e) => handleDragOverGroup(e, group.id)}
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
          <CategoryGroupForm
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
                  <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                    + Category
                  </Button>
                )}
                <button
                  onClick={() => { logUserAction('CLICK', 'Edit Category Group', { details: group.name }); setEditingGroupId(group.id) }}
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
                  onClick={() => { logUserAction('CLICK', 'Delete Category Group', { details: group.name }); handleDeleteGroup(group.id) }}
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
                {/* Group reorder buttons */}
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
                <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
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
                    onEdit={() => {
                      logUserAction('CLICK', 'Edit Category', { details: category.name })
                      setEditingCategoryId(catId)
                    }}
                    onDelete={() => {
                      logUserAction('CLICK', 'Delete Category', { details: category.name })
                      handleDeleteCategory(catId)
                    }}
                    onMoveUp={() => handleMoveCategory(catId, 'up')}
                    onMoveDown={() => handleMoveCategory(catId, 'down')}
                    canMoveUp={groupCategories.findIndex(([cId]) => cId === catId) > 0}
                    canMoveDown={groupCategories.findIndex(([cId]) => cId === catId) < groupCategories.length - 1}
                  >
                    <CategoryCardContent
                      category={category}
                      catId={catId}
                      categoryBalances={categoryBalances}
                      loadingBalances={loadingBalances}
                    />
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
                <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                  + Add Category
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Reusable category card content component
export function CategoryCardContent({
  category,
  catId,
  categoryBalances,
  loadingBalances,
}: {
  category: Category
  catId: string
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
}) {
  const balance = categoryBalances[catId] || { current: 0, total: 0 }

  return (
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
      {/* Balances display */}
      <div style={{ marginTop: '0.25rem' }}>
        {/* Current balance (available now) */}
        <p style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 600,
          color: getBalanceColor(balance.current),
        }}>
          {loadingBalances ? '...' : formatCurrency(balance.current)}
          <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6, marginLeft: '0.35rem' }}>
            available now
          </span>
        </p>
        {/* Total balance (always shown) */}
        <p style={{
          margin: '0.15rem 0 0 0',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: getBalanceColor(balance.total),
          opacity: 0.75,
        }}>
          {loadingBalances ? '...' : formatCurrency(balance.total)}
          <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7, marginLeft: '0.35rem' }}>
            total allocated
          </span>
        </p>
      </div>
    </div>
  )
}

