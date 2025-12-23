import { useMemo, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useBudget, type Category } from '../../../contexts/budget_context'
import { useBudgetData, useBudgetMonth } from '../../../hooks'
import { useIsMobile } from '../../../hooks/useIsMobile'
import type { CategoryMonthBalance } from '../../../types/budget'
import { StatCard, formatCurrency, getBalanceColor } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'

export function BalancesSection() {
  const { selectedBudgetId, currentUserId, currentYear, currentMonthNumber } = useBudget()
  const { categories, categoryGroups } = useBudgetData(selectedBudgetId, currentUserId)
  const { month: currentMonth, isLoading: monthLoading } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()

  // State for recalculating balances
  const [isRecalculatingBalances, setIsRecalculatingBalances] = useState(false)
  const [hasAutoRecalculated, setHasAutoRecalculated] = useState(false)

  // Handle recalculate balances
  const doRecalculateBalances = useCallback(async () => {
    setIsRecalculatingBalances(true)
    try {
      // Note: recalculateCategoryMonthBalances would need to be added to useBudgetMonth if needed
      console.warn('[BalancesSection] recalculateCategoryMonthBalances not yet implemented')
    } finally {
      setIsRecalculatingBalances(false)
    }
  }, [])

  // Auto-recalculate balances when no stored balances exist
  useEffect(() => {
    if (
      currentMonth &&
      !monthLoading &&
      (!currentMonth.category_balances || currentMonth.category_balances.length === 0) &&
      !isRecalculatingBalances &&
      !hasAutoRecalculated
    ) {
      setHasAutoRecalculated(true)
      doRecalculateBalances()
    }
  }, [currentMonth, monthLoading, hasAutoRecalculated, isRecalculatingBalances, doRecalculateBalances])

  // Reset auto-recalculate flag when month changes
  useEffect(() => {
    setHasAutoRecalculated(false)
  }, [currentYear, currentMonthNumber])

  // Calculate category balances for the balances tab
  const categoryBalances = useMemo(() => {
    // Use stored balances from the month document
    if (currentMonth?.category_balances && currentMonth.category_balances.length > 0) {
      return currentMonth.category_balances
    }

    // Fallback: show empty/zero balances while calculating
    const balances: CategoryMonthBalance[] = []
    Object.entries(categories).forEach(([catId]) => {
      let allocated = 0
      if (currentMonth?.allocations_finalized && currentMonth.allocations) {
        const alloc = currentMonth.allocations.find(a => a.category_id === catId)
        if (alloc) allocated = alloc.amount
      }

      let spent = 0
      if (currentMonth?.expenses) {
        spent = currentMonth.expenses
          .filter(e => e.category_id === catId)
          .reduce((sum, e) => sum + e.amount, 0)
      }

      balances.push({
        category_id: catId,
        start_balance: 0,
        allocated,
        spent,
        end_balance: allocated - spent,
      })
    })

    return balances
  }, [currentMonth, categories])

  // Get balance for a category
  const getCategoryBalance = (catId: string): CategoryMonthBalance | undefined => {
    return categoryBalances.find(b => b.category_id === catId)
  }

  // Calculate balance totals
  const balanceTotals = useMemo(() => {
    return categoryBalances.reduce((acc, bal) => ({
      start: acc.start + bal.start_balance,
      allocated: acc.allocated + bal.allocated,
      spent: acc.spent + bal.spent,
      end: acc.end + bal.end_balance,
    }), { start: 0, allocated: 0, spent: 0, end: 0 })
  }, [categoryBalances])

  // Category entry type
  type CategoryEntry = [string, Category]

  // Organize categories by group
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)
  const categoriesByGroup = useMemo(() => {
    const result = Object.entries(categories).reduce((acc, [catId, cat]) => {
      const groupId = cat.category_group_id || 'ungrouped'
      if (!acc[groupId]) acc[groupId] = []
      acc[groupId].push([catId, cat] as CategoryEntry)
      return acc
    }, {} as Record<string, CategoryEntry[]>)

    Object.keys(result).forEach(groupId => {
      result[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
    })

    return result
  }, [categories])

  return (
    <div style={{
      opacity: monthLoading ? 0.5 : 1,
      transition: 'opacity 0.15s ease-out',
      pointerEvents: monthLoading ? 'none' : 'auto',
    }}>
      {/* Balance Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Start of Month</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(balanceTotals.start) }}>
            {formatCurrency(balanceTotals.start)}
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Allocated</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: colors.success }}>
            +{formatCurrency(balanceTotals.allocated)}
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>Spent</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: colors.error }}>
            -{formatCurrency(balanceTotals.spent)}
          </p>
        </StatCard>
        <StatCard>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7 }}>End of Month</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', fontWeight: 600, color: getBalanceColor(balanceTotals.end) }}>
            {formatCurrency(balanceTotals.end)}
          </p>
        </StatCard>
      </div>

      {/* Category Balances by Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.keys(categories).length === 0 && (
          <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No categories yet.{' '}
            <Link to="/budget/admin/categories" style={{ color: colors.primaryLight }}>
              Create categories →
            </Link>
          </p>
        )}

        {sortedCategoryGroups.map(group => {
          const groupCats = categoriesByGroup[group.id] || []
          if (groupCats.length === 0) return null

          const groupTotals = groupCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              allocated: acc.allocated + bal.allocated,
              spent: acc.spent + bal.spent,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, allocated: 0, spent: 0, end: 0 })

          return (
            <BalanceGroupBlock
              key={group.id}
              name={group.name}
              categories={groupCats}
              groupEndBalance={groupTotals.end}
              getCategoryBalance={getCategoryBalance}
              isMobile={isMobile}
            />
          )
        })}

        {/* Ungrouped categories */}
        {categoriesByGroup['ungrouped']?.length > 0 && (() => {
          const ungroupedCats = categoriesByGroup['ungrouped']
          const ungroupedTotals = ungroupedCats.reduce((acc, [catId]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              allocated: acc.allocated + bal.allocated,
              spent: acc.spent + bal.spent,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, allocated: 0, spent: 0, end: 0 })

          return (
            <BalanceGroupBlock
              key="ungrouped"
              name="Uncategorized"
              categories={ungroupedCats}
              groupEndBalance={ungroupedTotals.end}
              getCategoryBalance={getCategoryBalance}
              isMobile={isMobile}
              isUngrouped
            />
          )
        })()}
      </div>
    </div>
  )
}

interface BalanceGroupBlockProps {
  name: string
  categories: [string, Category][]
  groupEndBalance: number
  getCategoryBalance: (catId: string) => CategoryMonthBalance | undefined
  isMobile: boolean
  isUngrouped?: boolean
}

function BalanceGroupBlock({
  name,
  categories,
  groupEndBalance,
  getCategoryBalance,
  isMobile,
  isUngrouped,
}: BalanceGroupBlockProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '12px',
      padding: '1rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      }}>
        <h3 style={{ ...sectionHeader, margin: 0, opacity: isUngrouped ? 0.7 : 1 }}>
          {name}
          <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({categories.length})
          </span>
        </h3>
        <span style={{ fontWeight: 600, color: getBalanceColor(groupEndBalance) }}>
          {formatCurrency(groupEndBalance)}
        </span>
      </div>

      {/* Table Header - desktop only */}
      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          opacity: 0.6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>Category</span>
          <span style={{ textAlign: 'right' }}>Start</span>
          <span style={{ textAlign: 'right' }}>Allocated</span>
          <span style={{ textAlign: 'right' }}>Spent</span>
          <span style={{ textAlign: 'right' }}>End</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {categories.map(([catId, cat]) => {
          const bal = getCategoryBalance(catId)
          if (!bal) return null

          return isMobile ? (
            <MobileBalanceRow key={catId} category={cat} balance={bal} />
          ) : (
            <DesktopBalanceRow key={catId} category={cat} balance={bal} />
          )
        })}
      </div>
    </div>
  )
}

interface BalanceRowProps {
  category: Category
  balance: CategoryMonthBalance
}

function MobileBalanceRow({ category, balance }: BalanceRowProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '0.75rem',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
      }}>
        <span style={{ fontWeight: 500 }}>{category.name}</span>
        <span style={{ fontWeight: 600, color: getBalanceColor(balance.end_balance) }}>
          {formatCurrency(balance.end_balance)}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.5rem',
        fontSize: '0.8rem',
      }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span>{formatCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Alloc</span>
          <span style={{ color: balance.allocated > 0 ? colors.success : 'inherit' }}>
            {balance.allocated > 0 ? '+' : ''}{formatCurrency(balance.allocated)}
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Spent</span>
          <span style={{ color: balance.spent > 0 ? colors.error : 'inherit' }}>
            {balance.spent > 0 ? '-' : ''}{formatCurrency(balance.spent)}
          </span>
        </div>
      </div>
    </div>
  )
}

function DesktopBalanceRow({ category, balance }: BalanceRowProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
      gap: '0.5rem',
      padding: '0.6rem 0.75rem',
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '6px',
      alignItems: 'center',
    }}>
      <span style={{ fontWeight: 500 }}>{category.name}</span>
      <span style={{ textAlign: 'right', fontSize: '0.9rem' }}>
        {formatCurrency(balance.start_balance)}
      </span>
      <span style={{
        textAlign: 'right',
        fontSize: '0.9rem',
        color: balance.allocated > 0 ? colors.success : 'inherit',
      }}>
        {balance.allocated > 0 ? '+' : ''}{formatCurrency(balance.allocated)}
      </span>
      <span style={{
        textAlign: 'right',
        fontSize: '0.9rem',
        color: balance.spent > 0 ? colors.error : 'inherit',
      }}>
        {balance.spent > 0 ? '-' : ''}{formatCurrency(balance.spent)}
      </span>
      <span style={{
        textAlign: 'right',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: getBalanceColor(balance.end_balance),
      }}>
        {formatCurrency(balance.end_balance)}
      </span>
    </div>
  )
}

