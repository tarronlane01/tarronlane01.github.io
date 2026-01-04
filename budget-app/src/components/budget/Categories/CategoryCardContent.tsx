/**
 * CategoryCardContent - Reusable category card content component
 *
 * Displays category name, description, default allocation, and balance info.
 */

import type { Category } from '../../../contexts/budget_context'
import { formatCurrency, formatBalanceCurrency, getCategoryBalanceColor } from '../../ui'
import { itemTitle, colors } from '../../../styles/shared'
import type { CategoryBalance } from '../../../hooks/useCategoriesPage'

interface CategoryCardContentProps {
  category: Category
  catId: string
  categoryBalances: Record<string, CategoryBalance>
  loadingBalances: boolean
}

export function CategoryCardContent({
  category,
  catId,
  categoryBalances,
  loadingBalances,
}: CategoryCardContentProps) {
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
          color: getCategoryBalanceColor(balance.current),
        }}>
          {loadingBalances ? '...' : formatBalanceCurrency(balance.current)}
          <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6, marginLeft: '0.35rem' }}>
            available now
          </span>
        </p>
        {/* Total balance (always shown) */}
        <p style={{
          margin: '0.15rem 0 0 0',
          fontSize: '0.85rem',
          fontWeight: 500,
          color: getCategoryBalanceColor(balance.total),
          opacity: 0.75,
        }}>
          {loadingBalances ? '...' : formatBalanceCurrency(balance.total)}
          <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7, marginLeft: '0.35rem' }}>
            total allocated
          </span>
        </p>
      </div>
    </div>
  )
}

