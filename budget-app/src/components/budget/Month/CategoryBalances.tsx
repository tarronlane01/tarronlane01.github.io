/**
 * Category Balances View Components
 *
 * Components for displaying category balances and allocation editing in the Balances tab.
 */

import type { Category, CategoryMonthBalance } from '@types'
import { Button, formatCurrency, formatBalanceCurrency, getBalanceColor, getCategoryBalanceColor } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'
import { MobileBalanceRow, DesktopBalanceRow } from './CategoryBalanceRows'

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
            ? (draftChangeAmount === 0 ? '$0.00' : formatCurrency(draftChangeAmount))
            : formatCurrency(currentDraftTotal)
          }
        </span>
      </span>
      <span style={{ opacity: 0.4 }}>=</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{allocationsFinalized ? 'Available After' : 'If Applied'}</span>
        <span style={{ color: getBalanceColor(availableAfterApply), fontWeight: 600 }}>{formatCurrency(availableAfterApply)}</span>
      </span>
    </div>
  )
}

// =============================================================================
// STICKY BALANCE HEADER
// =============================================================================

interface StickyBalanceHeaderProps {
  isDraftMode: boolean
}

export function StickyBalanceHeader({ isDraftMode }: StickyBalanceHeaderProps) {
  return (
    <div style={{
      position: 'sticky',
      top: '120px',
      zIndex: 10,
      background: 'var(--background, #1a1a1a)',
      padding: '0.5rem 0.75rem',
      marginBottom: '0.5rem',
      borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
    }}>
      <div style={{
        display: 'flex',
        fontSize: '0.75rem',
        fontWeight: 600,
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        <div style={{ flex: 2, minWidth: 0 }}>Category</div>
        {isDraftMode ? (
          <>
            <div style={{ width: '200px', textAlign: 'center' }}>Allocated</div>
            <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
            <div style={{ flex: 1, textAlign: 'right' }}>Allocated</div>
          </>
        )}
        <div style={{ flex: 1, textAlign: 'right' }}>Spent</div>
        <div style={{ flex: 1, textAlign: 'right', paddingRight: '1rem', borderRight: '2px solid rgba(128, 128, 128, 0.4)' }}>End</div>
        <div style={{ width: '120px', textAlign: 'right' }}>{isDraftMode ? 'Proj. All-Time' : 'All-Time'}</div>
      </div>
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
  /** Hide the column header row (used when there's a sticky header above) */
  hideHeader?: boolean
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
  hideHeader,
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
          <span style={{ borderBottom: '2px solid currentColor', paddingBottom: '2px' }}>{name}</span>
          <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({categories.length})
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.8rem',
            opacity: 0.6,
            borderBottom: '2px solid currentColor',
            paddingBottom: '2px',
          }}>
            +{formatCurrency(groupAllocated)}
          </span>
          <span style={{ fontWeight: 600, color: getCategoryBalanceColor(groupEndBalance), borderBottom: '2px solid currentColor', paddingBottom: '2px' }}>
            {formatBalanceCurrency(groupEndBalance)}
          </span>
        </div>
      </div>

      {/* Desktop layout */}
      {!isMobile && (
        <>
          {/* Header - only show if not hidden */}
          {!hideHeader && (
            <div style={{
              display: 'flex',
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              opacity: 0.6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              <div style={{ flex: 2, minWidth: 0 }}>Category</div>
              {isDraftMode ? (
                <>
                  <div style={{ width: '200px', textAlign: 'center' }}>Allocated</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, textAlign: 'right' }}>Start</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>Allocated</div>
                </>
              )}
              <div style={{ flex: 1, textAlign: 'right' }}>Spent</div>
              <div style={{ flex: 1, textAlign: 'right', paddingRight: '1rem', borderRight: '2px solid rgba(128, 128, 128, 0.4)' }}>End</div>
              <div style={{ width: '120px', textAlign: 'right' }}>{isDraftMode ? 'Proj. All-Time' : 'All-Time'}</div>
            </div>
          )}
          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {categories.map(([catId, cat], index) => {
              const bal = getCategoryBalance(catId)
              if (!bal) return null
              const storedBalance = cat.balance ?? 0
              const monthChange = bal.end_balance - bal.start_balance
              const projectedAllTime = storedBalance + monthChange
              return (
                <DesktopBalanceRow
                  key={catId}
                  category={cat}
                  balance={bal}
                  localAllocation={localAllocations[catId] || ''}
                  previousMonthIncome={previousMonthIncome}
                  isDraftMode={isDraftMode}
                  onAllocationChange={(val) => onAllocationChange(catId, val)}
                  allTimeBalance={isDraftMode ? projectedAllTime : storedBalance}
                  isEvenRow={index % 2 === 0}
                />
              )
            })}
          </div>
        </>
      )}

      {/* Mobile layout */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isDraftMode ? '0.5rem' : '0.25rem' }}>
          {categories.map(([catId, cat]) => {
            const bal = getCategoryBalance(catId)
            if (!bal) return null
            const storedBalance = cat.balance ?? 0
            const monthChange = bal.end_balance - bal.start_balance
            const projectedAllTime = storedBalance + monthChange
            return (
              <MobileBalanceRow
                key={catId}
                category={cat}
                balance={bal}
                localAllocation={localAllocations[catId] || ''}
                previousMonthIncome={previousMonthIncome}
                isDraftMode={isDraftMode}
                onAllocationChange={(val) => onAllocationChange(catId, val)}
                projectedAllTime={projectedAllTime}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
