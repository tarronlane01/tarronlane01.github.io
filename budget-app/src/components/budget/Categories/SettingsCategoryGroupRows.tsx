/**
 * SettingsCategoryGroupRows - Group rows for category settings table
 *
 * Displays a group header and its categories in table format.
 */

import type { Category, CategoryGroup } from '@contexts/budget_context'
import type { CategoryFormData } from './CategoryForm'
import { formatBalanceCurrency, getCategoryBalanceColor, Button } from '../../ui'
import { groupTotalText, groupTotalRowBorder, reorderButton, reorderButtonGroup } from '@styles/shared'
import { SettingsCategoryTableRow } from './SettingsCategoryTableRow'
import { CategoryForm } from './CategoryForm'
import { featureFlags } from '@constants'
import { logUserAction } from '@utils'
import type { CategoryBalance } from '@hooks'

type CategoryEntry = [string, Category]

interface SettingsCategoryGroupRowsProps {
  group: CategoryGroup
  categories: CategoryEntry[]
  categoryGroups: CategoryGroup[]
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
  editingCategoryId: string | null
  createForGroupId: string | null
  setEditingCategoryId: (id: string | null) => void
  setCreateForGroupId: (id: string | null) => void
  handleUpdateCategory: (id: string, data: CategoryFormData) => Promise<void>
  handleDeleteCategory: (id: string) => Promise<void>
  handleMoveCategory: (id: string, direction: 'up' | 'down') => Promise<void>
  handleCreateCategory: (data: CategoryFormData, groupId: string | null) => Promise<void>
  isMobile: boolean
  isUngrouped?: boolean
  startRowIndex?: number // Global row index for consistent striping across groups
  // Group editing props
  canMoveGroupUp: boolean
  canMoveGroupDown: boolean
  onEditGroup: () => void
  onDeleteGroup: () => void
  onMoveGroupUp: () => void
  onMoveGroupDown: () => void
}

export function SettingsCategoryGroupRows({
  group,
  categories,
  categoryGroups,
  categoryBalances,
  loadingBalances,
  editingCategoryId,
  createForGroupId,
  setEditingCategoryId,
  setCreateForGroupId,
  handleUpdateCategory,
  handleDeleteCategory,
  handleMoveCategory,
  handleCreateCategory,
  isMobile,
  isUngrouped,
  startRowIndex = 0,
  canMoveGroupUp,
  canMoveGroupDown,
  onEditGroup,
  onDeleteGroup,
  onMoveGroupUp,
  onMoveGroupDown,
}: SettingsCategoryGroupRowsProps) {
  const sortedCategories = [...categories].sort((a, b) => a[1].sort_order - b[1].sort_order)
  const groupTotal = sortedCategories.reduce((sum, [catId]) => {
    const bal = categoryBalances[catId]
    return sum + (bal?.current || 0)
  }, 0)

  const groupHeaderCellStyle: React.CSSProperties = {
    padding: '0.6rem 0.5rem',
    marginTop: '1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.2)',
    borderBottom: groupTotalRowBorder,
    background: 'rgba(255,255,255,0.04)',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    fontWeight: 600,
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Desktop: Group header row */}
      {!isMobile && (
        <>
          <div style={{ ...groupHeaderCellStyle, opacity: isUngrouped ? 0.7 : 1, justifyContent: 'space-between' }}>
            <span>
              <span>{group.name}</span>
              <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({sortedCategories.length})</span>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              {!isUngrouped && (
                <>
                  <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                    + Category
                  </Button>
                  <button
                    onClick={() => { logUserAction('CLICK', 'Edit Category Group', { details: group.name }); onEditGroup() }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                    title="Edit group"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => { logUserAction('CLICK', 'Delete Category Group', { details: group.name }); onDeleteGroup() }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                    title="Delete group"
                  >
                    🗑️
                  </button>
                  <div style={reorderButtonGroup}>
                    <button
                      onClick={onMoveGroupUp}
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
                      onClick={onMoveGroupDown}
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
                </>
              )}
            </div>
          </div>
          {/* Default Allocation column - empty */}
          <div style={groupHeaderCellStyle}></div>
          {/* Available Now total */}
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(groupTotal) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{loadingBalances ? '...' : formatBalanceCurrency(groupTotal)}</span>}
          </div>
          {/* Total Allocated total */}
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(sortedCategories.reduce((sum, [catId]) => {
            const bal = categoryBalances[catId]
            return sum + (bal?.total || 0)
          }, 0)) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{loadingBalances ? '...' : formatBalanceCurrency(sortedCategories.reduce((sum, [catId]) => {
              const bal = categoryBalances[catId]
              return sum + (bal?.total || 0)
            }, 0))}</span>}
          </div>
          {/* Description column - empty */}
          <div style={groupHeaderCellStyle}></div>
          {/* Actions column - empty */}
          <div style={groupHeaderCellStyle}></div>
        </>
      )}

      {/* Mobile: Simplified group header */}
      {isMobile && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '0.6rem 0.5rem',
          marginTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          borderBottom: groupTotalRowBorder,
          background: 'rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, opacity: isUngrouped ? 0.7 : 1 }}>
              {group.name}
              <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({sortedCategories.length})</span>
            </span>
            {featureFlags.showGroupTotals && (
              <span style={{ ...groupTotalText, color: getCategoryBalanceColor(groupTotal) }}>
                {loadingBalances ? '...' : formatBalanceCurrency(groupTotal)}
              </span>
            )}
          </div>
          {!isUngrouped && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="small" actionName={`Open Add Category Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                + Category
              </Button>
              <button
                onClick={() => { logUserAction('CLICK', 'Edit Category Group', { details: group.name }); onEditGroup() }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                title="Edit group"
              >
                ✏️
              </button>
              <button
                onClick={() => { logUserAction('CLICK', 'Delete Category Group', { details: group.name }); onDeleteGroup() }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                title="Delete group"
              >
                🗑️
              </button>
              <div style={reorderButtonGroup}>
                <button
                  onClick={onMoveGroupUp}
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
                  onClick={onMoveGroupDown}
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
          )}
        </div>
      )}

      {/* Category rows */}
      {sortedCategories.map(([catId, category], idx) => {
        // Use global row index for consistent striping across all groups
        const globalRowIndex = startRowIndex + idx
        return (
          <SettingsCategoryTableRow
            key={catId}
            category={category}
            catId={catId}
            categoryIndex={globalRowIndex}
            totalCategories={sortedCategories.length}
            categoryGroups={categoryGroups}
            categoryBalances={categoryBalances}
            loadingBalances={loadingBalances}
            onEdit={setEditingCategoryId}
            onDelete={handleDeleteCategory}
            onMoveUp={() => handleMoveCategory(catId, 'up')}
            onMoveDown={() => handleMoveCategory(catId, 'down')}
            canMoveUp={idx > 0}
            canMoveDown={idx < sortedCategories.length - 1}
            editingCategoryId={editingCategoryId}
            setEditingCategoryId={setEditingCategoryId}
            onUpdateCategory={handleUpdateCategory}
            isMobile={isMobile}
          />
        )
      })}

      {/* Create form */}
      {createForGroupId === group.id && (
        <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
          <CategoryForm
            initialData={{ name: '', category_group_id: group.id }}
            onSubmit={(data) => handleCreateCategory(data, group.id)}
            onCancel={() => setCreateForGroupId(null)}
            submitLabel="Create"
            categoryGroups={categoryGroups}
          />
        </div>
      )}
    </div>
  )
}

