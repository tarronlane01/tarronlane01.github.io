/**
 * SettingsCategoryTableRow - Table row component for category settings
 *
 * Displays a category in a table row format using display: contents
 * to work within CSS Grid layout, similar to month balance pages.
 */

import type { Category, CategoryGroup } from '@contexts/budget_context'
import type { CategoryFormData } from './CategoryForm'
import { formatBalanceCurrency, formatCurrency, getCategoryBalanceColor } from '../../ui'
import { CategoryForm } from './CategoryForm'
import { logUserAction } from '@utils'
import { colors } from '@styles/shared'
import type { CategoryBalance } from '@hooks'

interface SettingsCategoryTableRowProps {
  category: Category
  catId: string
  categoryIndex: number
  totalCategories: number
  categoryGroups: CategoryGroup[]
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
  onEdit: (categoryId: string) => void
  onDelete: (categoryId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  editingCategoryId: string | null
  setEditingCategoryId: (id: string | null) => void
  onUpdateCategory: (id: string, data: CategoryFormData) => void
  isMobile: boolean
}

export function SettingsCategoryTableRow({
  category,
  catId,
  categoryIndex,
  categoryGroups,
  categoryBalances,
  loadingBalances,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  editingCategoryId,
  setEditingCategoryId,
  onUpdateCategory,
  isMobile,
}: SettingsCategoryTableRowProps) {
  const balance = categoryBalances[catId] || { current: 0, total: 0 }

  // If editing, render form that spans full width
  if (editingCategoryId === catId) {
    return (
      <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
        <CategoryForm
          initialData={{
            name: category.name,
            description: category.description,
            category_group_id: category.category_group_id,
            default_monthly_amount: category.default_monthly_amount,
            default_monthly_type: category.default_monthly_type,
            is_hidden: category.is_hidden,
          }}
          onSubmit={(data) => {
            onUpdateCategory(catId, data)
            setEditingCategoryId(null)
          }}
          onCancel={() => setEditingCategoryId(null)}
          onDelete={() => {
            logUserAction('CLICK', 'Delete Category', { details: category.name })
            onDelete(catId)
            setEditingCategoryId(null)
          }}
          submitLabel="Save"
          categoryGroups={categoryGroups}
          showGroupSelector={true}
        />
      </div>
    )
  }

  // Mobile: render card-style row
  if (isMobile) {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          style={{
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 500 }}>{category.name}</span>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              {category.default_monthly_amount !== undefined && category.default_monthly_amount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>Default</span>
                  <span style={{ opacity: 0.7 }}>
                    {category.default_monthly_type === 'percentage'
                      ? `${category.default_monthly_amount}%`
                      : `${formatCurrency(category.default_monthly_amount)}/mo`}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>Available Now</span>
                <span style={{ color: getCategoryBalanceColor(balance.current), fontWeight: 600 }}>
                  {loadingBalances ? '...' : formatBalanceCurrency(balance.current)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>Total Allocated</span>
                <span style={{ color: getCategoryBalanceColor(balance.total) }}>
                  {loadingBalances ? '...' : formatBalanceCurrency(balance.total)}
                </span>
              </div>
            </div>
          </div>
          {category.description && (
            <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.5rem 0' }}>
              {category.description}
            </p>
          )}
          {category.default_monthly_amount !== undefined && category.default_monthly_amount > 0 && (
            <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.5rem' }}>
              Default: {category.default_monthly_type === 'percentage'
                ? <><span style={{ color: colors.success, fontWeight: 500 }}>{category.default_monthly_amount}%</span> of prev income</>
                : <><span style={{ color: colors.success, fontWeight: 500 }}>{category.default_monthly_amount}</span>/mo</>}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                logUserAction('CLICK', 'Edit Category', { details: category.name })
                onEdit(catId)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.6,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp()
              }}
              disabled={!canMoveUp}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: canMoveUp ? 'pointer' : 'default',
                opacity: canMoveUp ? 0.6 : 0.2,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              disabled={!canMoveDown}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: canMoveDown ? 'pointer' : 'default',
                opacity: canMoveDown ? 0.6 : 0.2,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Desktop: Grid row using display: contents
  const isEvenRow = categoryIndex % 2 === 0
  const rowBg = isEvenRow ? 'transparent' : 'rgba(255,255,255,0.04)'

  // Base cell style - no background, it will come from the row wrapper
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr 1fr', // Match parent grid columns
    }}>
        {/* Category name */}
        <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.name}</span>
        </div>

        {/* Default Allocation */}
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.7, fontSize: '0.85rem' }}>
          {category.default_monthly_amount !== undefined && category.default_monthly_amount > 0 ? (
            <span>
              {category.default_monthly_type === 'percentage'
                ? `${category.default_monthly_amount}%`
                : `${formatBalanceCurrency(category.default_monthly_amount)}/mo`}
            </span>
          ) : (
            <span style={{ opacity: 0.3, fontStyle: 'italic', color: '#9ca3af' }}>—</span>
          )}
        </div>

        {/* Available Now */}
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(balance.current), fontWeight: 600 }}>
          {loadingBalances ? '...' : formatBalanceCurrency(balance.current)}
        </div>

        {/* Total Allocated */}
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getCategoryBalanceColor(balance.total) }}>
          {loadingBalances ? '...' : formatBalanceCurrency(balance.total)}
        </div>

        {/* Description */}
        <div style={{ ...cellStyle, opacity: 0.7, fontSize: '0.85rem' }}>
          {category.description ? (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {category.description}
            </span>
          ) : (
            <span style={{ opacity: 0.3, fontStyle: 'italic', color: '#9ca3af' }}>—</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            logUserAction('CLICK', 'Edit Category', { details: category.name })
            onEdit(catId)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={!canMoveUp}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: canMoveUp ? 'pointer' : 'default',
            opacity: canMoveUp ? 0.6 : 0.2,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={!canMoveDown}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: canMoveDown ? 'pointer' : 'default',
            opacity: canMoveDown ? 0.6 : 0.2,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Move down"
        >
          ▼
        </button>
      </div>
    </div>
  )
}

