import type { DragEvent } from 'react'
import type { Category, CategoryGroup } from '@contexts/budget_context'
import { Button, DraggableCard } from '../../ui'
import { listContainer, colors } from '@styles/shared'
import { CategoryForm, type CategoryFormData } from './CategoryForm'
import { CategoryGroupForm, type CategoryGroupFormData } from './CategoryGroupForm'
import { CategoryEndDropZone } from './CategoryEndDropZone'
import { CategoryCardContent } from './CategoryCardContent'
import { CategoryGroupHeader } from './CategoryGroupHeader'
import type { CategoryBalance } from '@hooks'
import { logUserAction } from '@utils'

type CategoryEntry = [string, Category]
type DragType = 'category' | null

interface CategoryGroupCardProps {
  group: CategoryGroup
  groupIndex: number
  groupCategories: CategoryEntry[]
  sortedGroups: CategoryGroup[]
  categoryGroups: CategoryGroup[]
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
  dragType: DragType
  draggedId: string | null
  dragOverId: string | null
  dragOverGroupId: string | null
  editingCategoryId: string | null
  setEditingCategoryId: (id: string | null) => void
  createForGroupId: string | null
  setCreateForGroupId: (id: string | null) => void
  editingGroupId: string | null
  setEditingGroupId: (id: string | null) => void
  handleCreateCategory: (data: CategoryFormData, groupId: string | null) => Promise<void>
  handleUpdateCategory: (id: string, data: CategoryFormData) => Promise<void>
  handleDeleteCategory: (id: string) => Promise<void>
  handleMoveCategory: (id: string, direction: 'up' | 'down') => Promise<void>
  handleUpdateGroup: (id: string, data: CategoryGroupFormData) => Promise<void>
  handleDeleteGroup: (id: string) => Promise<void>
  handleMoveGroup: (id: string, direction: 'up' | 'down') => Promise<void>
  handleCategoryDragStart: (e: DragEvent, categoryId: string) => void
  handleCategoryDragOver: (e: DragEvent, categoryId: string, groupId: string) => void
  handleDragOverGroup: (e: DragEvent, groupId: string) => void
  handleDragLeave: () => void
  handleDragLeaveGroup: () => void
  handleDragEnd: () => void
  handleCategoryDrop: (e: DragEvent, targetId: string, targetGroupId: string) => Promise<void>
  handleDropOnGroup: (e: DragEvent, groupId: string) => Promise<void>
  setDragOverId: (id: string | null) => void
  setDragOverGroupId: (id: string | null) => void
  isMobile: boolean
  categories: Record<string, Category>
}

export function CategoryGroupCard({
  group, groupIndex, groupCategories, sortedGroups, categoryGroups, categoryBalances, loadingBalances,
  dragType, draggedId, dragOverId, dragOverGroupId,
  editingCategoryId, setEditingCategoryId, createForGroupId, setCreateForGroupId, editingGroupId, setEditingGroupId,
  handleCreateCategory, handleUpdateCategory, handleDeleteCategory, handleMoveCategory,
  handleUpdateGroup, handleDeleteGroup, handleMoveGroup,
  handleCategoryDragStart, handleCategoryDragOver, handleDragOverGroup, handleDragLeave, handleDragLeaveGroup, handleDragEnd,
  handleCategoryDrop, handleDropOnGroup,
  setDragOverId, setDragOverGroupId, isMobile, categories,
}: CategoryGroupCardProps) {
  const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === group.id
  const draggedCategory = draggedId && dragType === 'category' ? categories[draggedId] : null
  const isMovingToDifferentGroup = draggedCategory && (draggedCategory.category_group_id || 'ungrouped') !== group.id
  const canMoveGroupUp = groupIndex > 0
  const canMoveGroupDown = groupIndex < sortedGroups.length - 1

  return (
    <div>
      <div
        onDragOver={(e) => handleDragOverGroup(e, group.id)}
        onDragLeave={handleDragLeaveGroup}
        onDrop={(e) => handleDropOnGroup(e, group.id)}
        style={{
          background: (isCategoryMovingHere && isMovingToDifferentGroup) ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
            : 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '12px', padding: '1rem',
          border: (isCategoryMovingHere && isMovingToDifferentGroup) ? `2px dashed ${colors.primary}` : '2px solid transparent',
          transition: 'all 0.15s',
        }}
      >
        {editingGroupId === group.id ? (
          <CategoryGroupForm initialData={{ name: group.name }} onSubmit={(data) => handleUpdateGroup(group.id, data)} onCancel={() => setEditingGroupId(null)} submitLabel="Save" />
        ) : (
          <>
            <CategoryGroupHeader
              group={group} categoryCount={groupCategories.length}
              canMoveUp={canMoveGroupUp} canMoveDown={canMoveGroupDown} isMobile={isMobile} createForGroupId={createForGroupId}
              onEdit={() => setEditingGroupId(group.id)} onDelete={() => handleDeleteGroup(group.id)}
              onMoveUp={() => handleMoveGroup(group.id, 'up')} onMoveDown={() => handleMoveGroup(group.id, 'down')}
              onAddCategory={() => setCreateForGroupId(group.id)}
            />

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
                  <CategoryForm key={catId}
                    initialData={{ name: category.name, description: category.description, category_group_id: category.category_group_id, default_monthly_amount: category.default_monthly_amount, default_monthly_type: category.default_monthly_type, is_hidden: category.is_hidden }}
                    onSubmit={(data) => { handleUpdateCategory(catId, data); setEditingCategoryId(null) }} onCancel={() => setEditingCategoryId(null)} submitLabel="Save" categoryGroups={categoryGroups} showGroupSelector={true}
                  />
                ) : (
                  <DraggableCard key={catId}
                    isDragging={dragType === 'category' && draggedId === catId} isDragOver={dragOverId === catId}
                    onDragStart={(e) => { e.stopPropagation(); handleCategoryDragStart(e, catId) }}
                    onDragOver={(e) => handleCategoryDragOver(e, catId, group.id)} onDragLeave={handleDragLeave} onDragEnd={handleDragEnd}
                    onDrop={(e) => handleCategoryDrop(e, catId, group.id)}
                    onEdit={() => { logUserAction('CLICK', 'Edit Category', { details: category.name }); setEditingCategoryId(catId) }}
                    onDelete={() => { logUserAction('CLICK', 'Delete Category', { details: category.name }); handleDeleteCategory(catId) }}
                    onMoveUp={() => handleMoveCategory(catId, 'up')} onMoveDown={() => handleMoveCategory(catId, 'down')}
                    canMoveUp={groupCategories.findIndex(([cId]) => cId === catId) > 0}
                    canMoveDown={groupCategories.findIndex(([cId]) => cId === catId) < groupCategories.length - 1}
                  >
                    <CategoryCardContent category={category} catId={catId} categoryBalances={categoryBalances} loadingBalances={loadingBalances} />
                  </DraggableCard>
                )
              ))}

              {groupCategories.length === 0 && !createForGroupId && <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0' }}>No categories in this group</p>}

              {dragType === 'category' && groupCategories.length > 0 && (
                <CategoryEndDropZone groupId={group.id} isActive={dragOverId === `__end__${group.id}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverId(`__end__${group.id}`); setDragOverGroupId(group.id) }}
                  onDragLeave={(e) => { e.stopPropagation(); setDragOverId(null) }}
                  onDrop={(e) => { e.stopPropagation(); handleCategoryDrop(e, '__group_end__', group.id) }}
                />
              )}

              {createForGroupId === group.id && (
                <CategoryForm initialData={{ name: '', category_group_id: group.id }} onSubmit={(data) => handleCreateCategory(data, group.id)} onCancel={() => setCreateForGroupId(null)} submitLabel="Create" categoryGroups={categoryGroups} />
              )}
            </div>

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

export { CategoryCardContent } from './CategoryCardContent'
