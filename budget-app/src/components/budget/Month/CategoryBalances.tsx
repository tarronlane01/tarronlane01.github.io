/**
 * Category Balances View Components
 *
 * Components for displaying category balances and allocation editing in the Balances tab.
 */

import type { Category, CategoryMonthBalance } from '@types'
import { Button, formatCurrency, getBalanceColor } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'

// =============================================================================
// ALLOCATION STATUS
// =============================================================================

interface AllocationStatusProps {
  isFinalizingAllocations: boolean
  monthLoading: boolean
  onFinalize: () => void
}

export function AllocationStatus({
  isFinalizingAllocations,
  monthLoading,
  onFinalize,
}: AllocationStatusProps) {
  return (
    <div style={{
      background: `color-mix(in srgb, ${colors.warning} 12%, transparent)`,
      border: `1px solid ${colors.warning}`,
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      marginBottom: '1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '0.75rem',
    }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, color: colors.warning }}>
          ⏳ Allocations Not Applied
        </p>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
          Apply to update category balances.
        </p>
      </div>
      <Button onClick={onFinalize} disabled={isFinalizingAllocations || monthLoading}>
        {isFinalizingAllocations ? '⏳ Applying...' : '✓ Apply Allocations'}
      </Button>
    </div>
  )
}

// =============================================================================
// DRAFT EQUATION
// =============================================================================

interface DraftEquationProps {
  availableNow: number
  currentDraftTotal: number
  draftChangeAmount: number
  availableAfterApply: number
  allocationsFinalized: boolean
}

export function DraftEquation({
  availableNow,
  currentDraftTotal,
  draftChangeAmount,
  availableAfterApply,
  allocationsFinalized,
}: DraftEquationProps) {
  return (
    <div style={{
      background: `color-mix(in srgb, ${colors.primary} 8%, transparent)`,
      borderRadius: '8px',
      padding: '0.6rem 1rem',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontSize: '0.9rem',
      flexWrap: 'wrap',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>Available</span>
        <span style={{ color: getBalanceColor(availableNow), fontWeight: 600 }}>{formatCurrency(availableNow)}</span>
      </span>
      <span style={{ opacity: 0.4 }}>{allocationsFinalized ? (draftChangeAmount >= 0 ? '−' : '+') : '−'}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{allocationsFinalized ? 'Change' : 'Draft'}</span>
        <span style={{
          color: allocationsFinalized
            ? (draftChangeAmount === 0 ? 'inherit' : draftChangeAmount > 0 ? colors.warning : colors.success)
            : colors.primary,
          fontWeight: 600
        }}>
          {allocationsFinalized
            ? (draftChangeAmount === 0 ? '$0.00' : formatCurrency(Math.abs(draftChangeAmount)))
            : formatCurrency(currentDraftTotal)
          }
        </span>
      </span>
      <span style={{ opacity: 0.4 }}>=</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>Available After</span>
        <span style={{ color: getBalanceColor(availableAfterApply), fontWeight: 600 }}>{formatCurrency(availableAfterApply)}</span>
      </span>
    </div>
  )
}

// =============================================================================
// BALANCE GROUP BLOCK
// =============================================================================

interface BalanceGroupBlockProps {
  name: string
  categories: [string, Category][]
  groupEndBalance: number
  groupAllocated: number
  getCategoryBalance: (catId: string) => CategoryMonthBalance | undefined
  localAllocations: Record<string, string>
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (categoryId: string, value: string) => void
  isMobile: boolean
  isUngrouped?: boolean
}

export function BalanceGroupBlock({
  name,
  categories,
  groupEndBalance,
  groupAllocated,
  getCategoryBalance,
  localAllocations,
  previousMonthIncome,
  isDraftMode,
  onAllocationChange,
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.8rem',
            opacity: 0.6,
          }}>
            +{formatCurrency(groupAllocated)}
          </span>
          <span style={{ fontWeight: 600, color: getBalanceColor(groupEndBalance) }}>
            {formatCurrency(groupEndBalance)}
          </span>
        </div>
      </div>

      {/* Table Header - desktop only */}
      {!isMobile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isDraftMode ? '2fr 120px 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: 600,
          opacity: 0.6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>Category</span>
          <span style={{ textAlign: isDraftMode ? 'center' : 'right' }}>Allocated</span>
          <span style={{ textAlign: 'right' }}>Start</span>
          <span style={{ textAlign: 'right' }}>Spent</span>
          <span style={{ textAlign: 'right' }}>End</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: isDraftMode ? '0.5rem' : '0.25rem' }}>
        {categories.map(([catId, cat]) => {
          const bal = getCategoryBalance(catId)
          if (!bal) return null

          return isMobile ? (
            <MobileBalanceRow
              key={catId}
              category={cat}
              balance={bal}
              localAllocation={localAllocations[catId] || ''}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={(val) => onAllocationChange(catId, val)}
            />
          ) : (
            <DesktopBalanceRow
              key={catId}
              category={cat}
              balance={bal}
              localAllocation={localAllocations[catId] || ''}
              previousMonthIncome={previousMonthIncome}
              isDraftMode={isDraftMode}
              onAllocationChange={(val) => onAllocationChange(catId, val)}
            />
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// BALANCE ROWS
// =============================================================================

interface BalanceRowProps {
  category: Category
  balance: CategoryMonthBalance
  localAllocation: string
  previousMonthIncome: number
  isDraftMode: boolean
  onAllocationChange: (value: string) => void
}

function MobileBalanceRow({ category, balance, localAllocation, previousMonthIncome, isDraftMode, onAllocationChange }: BalanceRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0
  const calculatedAmount = isPercentageBased ? (category.default_monthly_amount! / 100) * previousMonthIncome : 0
  const displayValue = isPercentageBased ? calculatedAmount.toFixed(2) : localAllocation

  // Show inline input in draft mode for non-percentage categories
  const showInlineInput = isDraftMode && !isPercentageBased

  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '0.75rem',
    }}>
      {/* Category name row */}
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>
          {category.name}
        </span>
      </div>

      {/* Four values in one row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '0.25rem',
        fontSize: '0.75rem',
      }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span>{formatCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Alloc</span>
          {showInlineInput ? (
            <input
              type="text"
              inputMode="decimal"
              value={displayValue ? `$${displayValue}` : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, '')
                onAllocationChange(raw)
              }}
              placeholder="$0"
              style={{
                width: '100%',
                maxWidth: '80px',
                padding: '0.25rem 0.35rem',
                borderRadius: '4px',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                background: 'color-mix(in srgb, currentColor 8%, transparent)',
                fontSize: '0.8rem',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <span style={{ color: balance.allocated > 0 ? colors.success : 'inherit' }}>
              {balance.allocated > 0 ? '+' : ''}{formatCurrency(balance.allocated)}
            </span>
          )}
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Spent</span>
          <span style={{ color: balance.spent > 0 ? colors.error : 'inherit' }}>
            {balance.spent > 0 ? '-' : ''}{formatCurrency(balance.spent)}
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>End</span>
          <span style={{ color: getBalanceColor(balance.end_balance) }}>
            {formatCurrency(balance.end_balance)}
          </span>
        </div>
      </div>

      {/* Percentage equation - only in draft mode for percentage-based categories */}
      {isDraftMode && isPercentageBased && (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem' }}>
            <span style={{ opacity: 0.6 }}>{formatCurrency(previousMonthIncome)} × </span>
            <span style={{ color: colors.primary }}>{category.default_monthly_amount}%</span>
            <span style={{ opacity: 0.6 }}> = </span>
            <span style={{ color: colors.primary }}>{formatCurrency(calculatedAmount)}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function DesktopBalanceRow({ category, balance, localAllocation, previousMonthIncome, isDraftMode, onAllocationChange }: BalanceRowProps) {
  const isPercentageBased = category.default_monthly_type === 'percentage' && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0
  const calculatedAmount = isPercentageBased ? (category.default_monthly_amount! / 100) * previousMonthIncome : 0
  const displayValue = isPercentageBased ? calculatedAmount.toFixed(2) : localAllocation

  // Suggested amount display (only for fixed-amount categories in draft mode)
  let suggestedDisplay: string | null = null
  if (isDraftMode && !isPercentageBased && category.default_monthly_amount !== undefined && category.default_monthly_amount > 0) {
    suggestedDisplay = formatCurrency(category.default_monthly_amount)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isDraftMode ? '2fr 120px 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr',
      gap: '0.5rem',
      padding: '0.6rem 0.75rem',
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '6px',
      alignItems: 'center',
    }}>
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
        {suggestedDisplay && (
          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            Suggested: {suggestedDisplay}
          </span>
        )}
      </div>

      {/* Allocation column */}
      {isDraftMode ? (
        <div>
          {isPercentageBased ? (
            <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>
              <span style={{ opacity: 0.5 }}>{formatCurrency(previousMonthIncome)} × </span>
              <span style={{ color: colors.primary }}>{category.default_monthly_amount}%</span>
              <span style={{ display: 'block', marginTop: '0.15rem' }}>
                <span style={{ opacity: 0.5 }}>= </span>
                <span style={{ color: colors.primary }}>{formatCurrency(calculatedAmount)}</span>
              </span>
            </div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={displayValue ? `$${displayValue}` : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.]/g, '')
                onAllocationChange(raw)
              }}
              placeholder="$0.00"
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid color-mix(in srgb, currentColor 20%, transparent)',
                background: 'color-mix(in srgb, currentColor 5%, transparent)',
                fontSize: '0.9rem',
                color: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      ) : (
        <span style={{
          textAlign: 'right',
          fontSize: '0.9rem',
          color: balance.allocated > 0 ? colors.success : 'inherit',
        }}>
          {balance.allocated > 0 ? '+' : ''}{formatCurrency(balance.allocated)}
        </span>
      )}

      <span style={{ textAlign: 'right', fontSize: '0.9rem' }}>
        {formatCurrency(balance.start_balance)}
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

