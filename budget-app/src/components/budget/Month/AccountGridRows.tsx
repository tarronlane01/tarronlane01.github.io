/**
 * Account Grid Row Components
 *
 * Desktop and mobile grid row components for displaying account balances.
 * Used by MonthAccounts for the main account listing.
 */

import { useState } from 'react'
import type { FinancialAccount, AccountMonthBalance } from '@types'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors, groupTotalText, groupTotalRowBorder } from '@styles/shared'
import { featureFlags } from '@constants'

// Helper color functions - consistent: positive=green, negative=red, zero=grey
function getIncomeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

// Expenses: negative = money out (red), positive = money in (green), zero = grey
function getExpenseColor(value: number): string {
  if (value === 0) return colors.zero
  return value < 0 ? colors.error : colors.success
}

function getNetChangeColor(value: number): string {
  if (value === 0) return colors.zero
  return value > 0 ? colors.success : colors.error
}

// Shared style for numeric cells: tabular figures + right-align + intra-cell padding only
const numericCellStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
}

// =============================================================================
// ACCOUNT GROUP ROWS - renders as grid items using display: contents
// =============================================================================

import type { AccountClearedBalance } from '@calculations'
import { AccountGridRow } from './AccountGridRow'

export interface AccountGroupRowsProps {
  name: string
  accounts: Array<[string, FinancialAccount]>
  groupTotals: { start: number; income: number; expenses: number; transfers: number; adjustments: number; netChange: number; end: number }
  accountBalances: Record<string, AccountMonthBalance>
  accountClearedBalances?: Record<string, AccountClearedBalance>
  isMobile: boolean
  isUngrouped?: boolean
  isFirstGroup?: boolean // Remove top margin for first group to eliminate gap after Grand Totals
}

export function AccountGroupRows({ name, accounts, groupTotals, accountBalances, accountClearedBalances, isMobile, isUngrouped, isFirstGroup = false }: AccountGroupRowsProps) {
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)

  const groupHeaderCellStyle: React.CSSProperties = {
    padding: '0.6rem 0.5rem',
    marginTop: isFirstGroup ? 0 : '1.25rem', // Remove top margin for first group to eliminate gap after Grand Totals
    borderTop: '1px solid var(--border-medium)',
    borderBottom: groupTotalRowBorder,
    background: 'var(--row-alt-bg)',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
    fontWeight: 600,
  }
  const groupHeaderNumericStyle = { ...numericCellStyle, justifyContent: 'flex-end' as const }

  return (
    <div style={{ display: 'contents' }}>
      {/* Desktop: Group header row with totals in each column */}
      {!isMobile && (
        <>
          <div style={{ ...groupHeaderCellStyle, opacity: isUngrouped ? 0.7 : 1 }}>
            <span>{name}</span>
            <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({accounts.length})</span>
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getBalanceColor(groupTotals.start) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatBalanceCurrency(groupTotals.start)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getIncomeColor(groupTotals.income) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>+{formatCurrency(groupTotals.income)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getExpenseColor(groupTotals.expenses) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrency(groupTotals.expenses)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getNetChangeColor(groupTotals.transfers) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.transfers)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getNetChangeColor(groupTotals.adjustments) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.adjustments)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getNetChangeColor(groupTotals.netChange) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.netChange)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle, color: getBalanceColor(groupTotals.end) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatBalanceCurrency(groupTotals.end)}</span>}
          </div>
          {/* Total for group (uncleared sum) */}
          <div style={{ ...groupHeaderCellStyle, ...groupHeaderNumericStyle }}>
            {featureFlags.showGroupTotals && accountClearedBalances && (
              <span style={{ ...groupTotalText, color: getBalanceColor(accounts.reduce((sum, [accountId]) => sum + (accountClearedBalances[accountId]?.uncleared_balance ?? 0), 0)) }}>
                {formatBalanceCurrency(accounts.reduce((sum, [accountId]) => {
                  const bal = accountClearedBalances[accountId]
                  return sum + (bal?.uncleared_balance ?? 0)
                }, 0))}
              </span>
            )}
          </div>
        </>
      )}

      {/* Mobile: Simplified group header */}
      {isMobile && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '0.6rem 0.5rem',
          marginTop: isFirstGroup ? 0 : '1.25rem', // Remove top margin for first group to eliminate gap after Grand Totals
          borderTop: '1px solid var(--border-medium)',
          borderBottom: groupTotalRowBorder,
          background: 'var(--row-alt-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, opacity: isUngrouped ? 0.7 : 1 }}>
            {name}
            <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({accounts.length})</span>
          </span>
          {featureFlags.showGroupTotals && (
            <span style={{ ...groupTotalText, color: getBalanceColor(groupTotals.end) }}>
              {formatBalanceCurrency(groupTotals.end)}
            </span>
          )}
        </div>
      )}

      {/* Account rows + optional expanded uncleared detail row */}
      {accounts.flatMap(([accountId, account], index) => {
        const bal = accountBalances[accountId]
        if (!bal) return []
        const clearedBal = accountClearedBalances?.[accountId]
        const hasUnclearedEnd = !!clearedBal && Math.abs(clearedBal.uncleared_balance - clearedBal.cleared_balance) >= 0.01
        const hasUnclearedStart = !!clearedBal && clearedBal.cleared_start_balance !== undefined
          && Math.abs(bal.start_balance - clearedBal.cleared_start_balance) >= 0.01
        const hasUnclearedDetail = hasUnclearedStart || hasUnclearedEnd
        const isExpanded = expandedAccountId === accountId

        if (isMobile) {
          return [
            <div key={accountId} style={{ gridColumn: '1 / -1' }}>
              <MobileAccountRow
                account={account}
                balance={bal}
                clearedBalance={clearedBal}
                hasUnclearedDetail={hasUnclearedDetail}
                hasUnclearedStart={hasUnclearedStart}
              />
            </div>,
          ]
        }

        return [
          <AccountGridRow
            key={accountId}
            account={account}
            balance={bal}
            clearedBalance={clearedBal}
            isEvenRow={index % 2 === 0}
            hasUnclearedDetail={hasUnclearedDetail}
            hasUnclearedStart={hasUnclearedStart}
            isExpanded={isExpanded}
            onToggleExpand={() => setExpandedAccountId(isExpanded ? null : accountId)}
          />,
          isExpanded && hasUnclearedDetail && clearedBal && (
            <ExpandedUnclearedRow key={`${accountId}-exp`} clearedBalance={clearedBal} startBalance={bal.start_balance} hasUnclearedStart={hasUnclearedStart} hasUnclearedEnd={hasUnclearedEnd} />
          ),
        ].filter(Boolean)
      })}
    </div>
  )
}

// =============================================================================
// EXPANDED UNCLEARED ROW - sub-table with Total = Cleared + Uncleared
// =============================================================================

function ExpandedUnclearedRow({ clearedBalance, startBalance, hasUnclearedStart, hasUnclearedEnd }: {
  clearedBalance: AccountClearedBalance
  startBalance: number
  hasUnclearedStart: boolean
  hasUnclearedEnd: boolean
}) {
  const endPending = clearedBalance.uncleared_balance - clearedBalance.cleared_balance
  const startPending = startBalance - (clearedBalance.cleared_start_balance ?? startBalance)
  // Grid: Label | Total | = | Cleared | + | Uncleared (6 columns)
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

function MobileAccountRow({
  account,
  balance,
  clearedBalance,
  hasUnclearedDetail,
  hasUnclearedStart,
}: {
  account: FinancialAccount
  balance: AccountMonthBalance
  clearedBalance?: AccountClearedBalance
  hasUnclearedDetail: boolean
  hasUnclearedStart: boolean
}) {
  const pending = clearedBalance ? clearedBalance.uncleared_balance - clearedBalance.cleared_balance : 0
  const startPending = clearedBalance && clearedBalance.cleared_start_balance !== undefined
    ? balance.start_balance - clearedBalance.cleared_start_balance : 0
  return (
    <div style={{ background: 'color-mix(in srgb, currentColor 5%, transparent)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.25rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>{account.nickname}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.25rem', fontSize: '0.75rem' }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span>{formatBalanceCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Net Change</span>
          <span style={{ color: getBalanceColor(balance.net_change) }}>
            {formatSignedCurrencyAlways(balance.net_change)}
          </span>
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
      {(balance.income !== 0 || balance.expenses !== 0 || balance.transfers !== 0 || balance.adjustments !== 0) && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.7rem', opacity: 0.7 }}>
          {balance.income !== 0 && <span>{formatSignedCurrencyAlways(balance.income)} income</span>}
          {balance.expenses !== 0 && <span>{formatSignedCurrency(balance.expenses)} expenses</span>}
          {balance.transfers !== 0 && <span>{formatSignedCurrencyAlways(balance.transfers)} transfers</span>}
          {balance.adjustments !== 0 && <span>{formatSignedCurrencyAlways(balance.adjustments)} adjust</span>}
        </div>
      )}
    </div>
  )
}

