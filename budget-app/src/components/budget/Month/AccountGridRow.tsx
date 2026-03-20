/**
 * AccountGridRow - Desktop and mobile row components for account balances.
 * Renders desktop rows as grid items (display: contents) within MonthAccounts grid.
 */

import type { FinancialAccount, AccountMonthBalance } from '@types'
import type { AccountClearedBalance } from '@calculations'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '@styles/shared'

function getIncomeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}
function getExpenseColor(value: number): string {
  if (value === 0) return colors.zero
  return value < 0 ? colors.error : colors.success
}
function getNetChangeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

const NUM_COL_MIN = '5rem'
const ACCOUNTS_GRID_COLUMNS = `2fr repeat(8, minmax(${NUM_COL_MIN}, 1fr))`
const numericCellStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
}

// Muted inline group label style
const groupLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  opacity: 0.5,
  fontWeight: 400,
  marginLeft: '0.35rem',
}

export interface AccountGridRowProps {
  account: FinancialAccount
  balance: AccountMonthBalance
  clearedBalance?: AccountClearedBalance
  isEvenRow: boolean
  hasUnclearedDetail: boolean
  hasUnclearedStart: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  groupName?: string
  isOffBudget?: boolean
}

const offBudgetDash = <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>——</span>

export function AccountGridRow({
  account,
  balance,
  clearedBalance,
  isEvenRow,
  hasUnclearedDetail,
  hasUnclearedStart,
  isExpanded,
  onToggleExpand,
  groupName,
  isOffBudget,
}: AccountGridRowProps) {
  const rowBg = isEvenRow ? 'transparent' : 'var(--row-alt-bg)'
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }
  const numericStyle = { ...cellStyle, ...numericCellStyle, justifyContent: 'flex-end' as const }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: ACCOUNTS_GRID_COLUMNS,
    }}>
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '0.5rem' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.nickname}{account.is_deleted && ' (deleted)'}
          {groupName && <span style={groupLabelStyle}>({groupName})</span>}
        </span>
      </div>
      <div style={{ ...numericStyle, gap: '0.25rem', color: getBalanceColor(balance.start_balance) }}>
        <span>{formatBalanceCurrency(balance.start_balance)}</span>
        {hasUnclearedStart && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            title={isExpanded ? 'Hide cleared/uncleared breakdown' : 'Show cleared/uncleared breakdown'}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.5rem', opacity: 0.5,
              padding: '0.1rem', borderRadius: '2px', transition: 'transform 0.15s',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </button>
        )}
      </div>
      <div style={{ ...numericStyle, color: isOffBudget ? undefined : getIncomeColor(balance.income) }}>
        {isOffBudget ? offBudgetDash : <>+{formatCurrency(balance.income)}</>}
      </div>
      <div style={{ ...numericStyle, color: isOffBudget ? undefined : getExpenseColor(balance.expenses) }}>
        {isOffBudget ? offBudgetDash : formatSignedCurrency(balance.expenses)}
      </div>
      <div style={{ ...numericStyle, color: isOffBudget ? undefined : getNetChangeColor(balance.transfers) }}>
        {isOffBudget ? offBudgetDash : formatSignedCurrencyAlways(balance.transfers)}
      </div>
      <div style={{ ...numericStyle, color: getNetChangeColor(balance.adjustments) }}>
        {formatSignedCurrencyAlways(balance.adjustments)}
      </div>
      <div style={{ ...numericStyle, color: isOffBudget ? undefined : getNetChangeColor(balance.net_change) }}>
        {isOffBudget ? offBudgetDash : formatSignedCurrencyAlways(balance.net_change)}
      </div>
      <div style={{ ...numericStyle, fontWeight: 600, color: getBalanceColor(balance.end_balance) }}>
        {formatBalanceCurrency(balance.end_balance)}
      </div>
      <div style={{ ...numericStyle, gap: '0.25rem', color: clearedBalance ? getBalanceColor(clearedBalance.uncleared_balance) : undefined, fontWeight: 600 }}>
        {clearedBalance ? (
          <>
            <span>{formatBalanceCurrency(clearedBalance.uncleared_balance)}</span>
            {hasUnclearedDetail && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
                title={isExpanded ? 'Hide cleared/uncleared breakdown' : 'Show cleared/uncleared breakdown'}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.5rem', opacity: 0.5,
                  padding: '0.1rem', borderRadius: '2px', transition: 'transform 0.15s',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▼
              </button>
            )}
          </>
        ) : (
          <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// EXPANDED UNCLEARED ROW - sub-table with Total = Cleared + Uncleared
// =============================================================================

export function ExpandedUnclearedRow({ clearedBalance, startBalance, hasUnclearedStart, hasUnclearedEnd }: {
  clearedBalance: AccountClearedBalance
  startBalance: number
  hasUnclearedStart: boolean
  hasUnclearedEnd: boolean
}) {
  const endPending = clearedBalance.uncleared_balance - clearedBalance.cleared_balance
  const startPending = startBalance - (clearedBalance.cleared_start_balance ?? startBalance)
  const showBothRows = hasUnclearedStart && hasUnclearedEnd
  const gridCols = showBothRows ? 'auto auto auto auto auto auto' : 'auto auto auto auto auto'
  const headerStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 600,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    padding: '0.25rem 0.5rem',
    textAlign: 'right',
  }
  const labelStyle: React.CSSProperties = {
    ...headerStyle,
    textAlign: 'left',
  }
  const opStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    opacity: 0.5,
    padding: '0.25rem 0.35rem',
    textAlign: 'center',
  }
  const valueStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    fontVariantNumeric: 'tabular-nums',
    padding: '0.35rem 0.5rem',
    textAlign: 'right',
  }
  return (
    <div style={{ gridColumn: '1 / -1', padding: '0.5rem 1rem 0.75rem 2.5rem', background: 'color-mix(in srgb, currentColor 4%, transparent)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: 0,
        alignContent: 'start',
        width: 'fit-content',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        {showBothRows && <div style={{ ...labelStyle, borderBottom: '1px solid var(--border-subtle)' }} />}
        <div style={{ ...headerStyle, borderBottom: '1px solid var(--border-subtle)' }}>Total</div>
        <div style={{ ...opStyle, borderBottom: '1px solid var(--border-subtle)' }}>=</div>
        <div style={{ ...headerStyle, borderBottom: '1px solid var(--border-subtle)' }}>Cleared</div>
        <div style={{ ...opStyle, borderBottom: '1px solid var(--border-subtle)' }}>+</div>
        <div style={{ ...headerStyle, borderBottom: '1px solid var(--border-subtle)' }}>Pending</div>

        {/* Start row (when both rows shown) */}
        {hasUnclearedStart && showBothRows && (
          <>
            <div style={{ ...labelStyle, borderTop: '1px solid var(--border-subtle)' }}>Start</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(startBalance) }}>{formatBalanceCurrency(startBalance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>=</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.cleared_start_balance ?? startBalance) }}>{formatBalanceCurrency(clearedBalance.cleared_start_balance ?? startBalance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>+</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getNetChangeColor(startPending) }}>{formatBalanceCurrency(startPending)}</div>
          </>
        )}

        {/* End/Total row */}
        {hasUnclearedEnd && showBothRows && (
          <>
            <div style={{ ...labelStyle, borderTop: '1px solid var(--border-subtle)' }}>End</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.uncleared_balance) }}>{formatBalanceCurrency(clearedBalance.uncleared_balance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>=</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.cleared_balance) }}>{formatBalanceCurrency(clearedBalance.cleared_balance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>+</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getNetChangeColor(endPending) }}>{formatBalanceCurrency(endPending)}</div>
          </>
        )}

        {/* Single row (start-only or end-only) */}
        {!showBothRows && hasUnclearedStart && (
          <>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(startBalance) }}>{formatBalanceCurrency(startBalance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>=</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.cleared_start_balance ?? startBalance) }}>{formatBalanceCurrency(clearedBalance.cleared_start_balance ?? startBalance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>+</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getNetChangeColor(startPending) }}>{formatBalanceCurrency(startPending)}</div>
          </>
        )}
        {!showBothRows && hasUnclearedEnd && (
          <>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.uncleared_balance) }}>{formatBalanceCurrency(clearedBalance.uncleared_balance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>=</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getBalanceColor(clearedBalance.cleared_balance) }}>{formatBalanceCurrency(clearedBalance.cleared_balance)}</div>
            <div style={{ ...opStyle, borderTop: '1px solid var(--border-subtle)' }}>+</div>
            <div style={{ ...valueStyle, borderTop: '1px solid var(--border-subtle)', color: getNetChangeColor(endPending) }}>{formatBalanceCurrency(endPending)}</div>
          </>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MOBILE ACCOUNT ROW
// =============================================================================

export function MobileAccountRow({
  account,
  balance,
  clearedBalance,
  hasUnclearedDetail,
  hasUnclearedStart,
  groupName,
  isOffBudget,
}: {
  account: FinancialAccount
  balance: AccountMonthBalance
  clearedBalance?: AccountClearedBalance
  hasUnclearedDetail: boolean
  hasUnclearedStart: boolean
  groupName?: string
  isOffBudget?: boolean
}) {
  const pending = clearedBalance ? clearedBalance.uncleared_balance - clearedBalance.cleared_balance : 0
  const startPending = clearedBalance && clearedBalance.cleared_start_balance !== undefined
    ? balance.start_balance - clearedBalance.cleared_start_balance : 0
  return (
    <div style={{ background: 'color-mix(in srgb, currentColor 5%, transparent)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.25rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>{account.nickname}{account.is_deleted && ' (deleted)'}</span>
        {groupName && <span style={groupLabelStyle}>({groupName})</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.25rem', fontSize: '0.75rem' }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span>{formatBalanceCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Net Change</span>
          {isOffBudget ? offBudgetDash : (
            <span style={{ color: getBalanceColor(balance.net_change) }}>
              {formatSignedCurrencyAlways(balance.net_change)}
            </span>
          )}
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>End</span>
          <span style={{ color: getBalanceColor(balance.end_balance) }}>{formatBalanceCurrency(balance.end_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Total</span>
          {clearedBalance ? (
            <span style={{ color: getBalanceColor(clearedBalance.uncleared_balance), fontWeight: 600 }}>
              {formatBalanceCurrency(clearedBalance.uncleared_balance)}
            </span>
          ) : (
            <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
          )}
        </div>
      </div>
      {/* Start cleared / uncleared – when prior months have uncleared carry-forward */}
      {hasUnclearedStart && clearedBalance && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          fontSize: '0.7rem',
          opacity: 0.85,
        }}>
          <span style={{ fontWeight: 600, opacity: 0.7 }}>Start:</span>
          <span>Cleared: <span style={{ color: getBalanceColor(clearedBalance.cleared_start_balance ?? balance.start_balance) }}>{formatBalanceCurrency(clearedBalance.cleared_start_balance ?? balance.start_balance)}</span></span>
          <span>Pending: <span style={{ color: getNetChangeColor(startPending) }}>{formatBalanceCurrency(startPending)}</span></span>
        </div>
      )}
      {/* End cleared / uncleared – when current month has uncleared transactions */}
      {hasUnclearedDetail && clearedBalance && Math.abs(pending) >= 0.01 && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          fontSize: '0.7rem',
          opacity: 0.85,
        }}>
          <span style={{ fontWeight: 600, opacity: 0.7 }}>End:</span>
          <span>Cleared: <span style={{ color: getBalanceColor(clearedBalance.cleared_balance) }}>{formatBalanceCurrency(clearedBalance.cleared_balance)}</span></span>
          <span>Pending: <span style={{ color: getNetChangeColor(pending) }}>{formatBalanceCurrency(pending)}</span></span>
        </div>
      )}
      {((!isOffBudget && (balance.income !== 0 || balance.expenses !== 0 || balance.transfers !== 0)) || balance.adjustments !== 0) && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.7rem', opacity: 0.7 }}>
          {!isOffBudget && balance.income !== 0 && <span>{formatSignedCurrencyAlways(balance.income)} income</span>}
          {!isOffBudget && balance.expenses !== 0 && <span>{formatSignedCurrency(balance.expenses)} expenses</span>}
          {!isOffBudget && balance.transfers !== 0 && <span>{formatSignedCurrencyAlways(balance.transfers)} transfers</span>}
          {balance.adjustments !== 0 && <span>{formatSignedCurrencyAlways(balance.adjustments)} adjust</span>}
        </div>
      )}
    </div>
  )
}
