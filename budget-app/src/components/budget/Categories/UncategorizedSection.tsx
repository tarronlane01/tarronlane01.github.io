import type { DragEvent } from 'react'
import type { Category, CategoryGroup } from '../../../contexts/budget_context'
import { Button, DraggableCard } from '../../ui'
import { listContainer, sectionHeader, colors } from '../../../styles/shared'
import { CategoryForm, type CategoryFormData } from './CategoryForm'
import { CategoryEndDropZone } from './CategoryEndDropZone'
import { CategoryCardContent } from './CategoryGroupCard'
import type { CategoryBalance } from '../../../hooks/useCategoriesPage'
import { logUserAction } from '@utils'

type CategoryEntry = [string, Category]
type DragType = 'category' | 'group' | null

interface UncategorizedSectionProps {
  ungroupedCategories: CategoryEntry[]
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
  // Handlers
  handleCreateCategory: (data: CategoryFormData, groupId: string | null) => Promise<void>
  handleUpdateCategory: (id: string, data: CategoryFormData) => Promise<void>
  handleDeleteCategory: (id: string) => Promise<void>
  handleMoveCategory: (id: string, direction: 'up' | 'down') => Promise<void>
  // Drag handlers
  handleCategoryDragStart: (e: DragEvent, categoryId: string) => void
  handleCategoryDragOver: (e: DragEvent, categoryId: string, groupId: string) => void
  handleDragOverGroup: (e: DragEvent, groupId: string) => void
  handleDragLeaveGroup: () => void
  handleDragLeave: () => void
  handleDragEnd: () => void
  handleCategoryDrop: (e: DragEvent, targetId: string, targetGroupId: string) => Promise<void>
  handleDropOnGroup: (e: DragEvent, groupId: string) => Promise<void>
  setDragOverId: (id: string | null) => void
  setDragOverGroupId: (id: string | null) => void
  // Data
  categories: Record<string, Category>
  hasGroups: boolean
}

export function UncategorizedSection({
  ungroupedCategories,
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
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleCategoryDragStart,
  handleCategoryDragOver,
  handleDragOverGroup,
  handleDragLeaveGroup,
  handleDragLeave,
  handleDragEnd,
  handleCategoryDrop,
  handleDropOnGroup,
  setDragOverId,
  setDragOverGroupId,
  categories,
  hasGroups,
}: UncategorizedSectionProps) {
  const isCategoryMovingHere = dragType === 'category' && dragOverGroupId === 'ungrouped'
  const draggedCategory = draggedId && dragType === 'category' ? categories[draggedId] : null
  const isMovingToDifferentGroup = draggedCategory && draggedCategory.category_group_id !== null

  // Hide section if empty, not creating, and there are groups (and not dragging)
  if (ungroupedCategories.length === 0 && !createForGroupId && hasGroups && dragType !== 'category') {
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
        <Button variant="small" actionName="Open Add Category Form (Uncategorized)" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
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
              canMoveUp={ungroupedCategories.findIndex(([cId]) => cId === catId) > 0}
              canMoveDown={ungroupedCategories.findIndex(([cId]) => cId === catId) < ungroupedCategories.length - 1}
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
          <Button variant="small" actionName="Open Add Category Form (Uncategorized)" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
            + Add Category
          </Button>
        </div>
      )}
    </div>
  )
}

