/**
 * Account Grid Row Components
 *
 * Desktop and mobile grid row components for displaying account balances.
 * Used by MonthAccounts for the main account listing.
 */

import type { FinancialAccount, AccountMonthBalance } from '@types'
import { formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
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

// =============================================================================
// ACCOUNT GROUP ROWS - renders as grid items using display: contents
// =============================================================================

import type { AccountClearedBalance } from '@calculations'

export interface AccountGroupRowsProps {
  name: string
  accounts: Array<[string, FinancialAccount]>
  groupTotals: { start: number; income: number; expenses: number; transfers: number; adjustments: number; netChange: number; end: number }
  accountBalances: Record<string, AccountMonthBalance>
  accountClearedBalances?: Record<string, AccountClearedBalance>
  isMobile: boolean
  isUngrouped?: boolean
}

export function AccountGroupRows({ name, accounts, groupTotals, accountBalances, accountClearedBalances, isMobile, isUngrouped }: AccountGroupRowsProps) {
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
      {/* Desktop: Group header row with totals in each column */}
      {!isMobile && (
        <>
          <div style={{ ...groupHeaderCellStyle, opacity: isUngrouped ? 0.7 : 1 }}>
            <span>{name}</span>
            <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({accounts.length})</span>
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getBalanceColor(groupTotals.start) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatCurrency(groupTotals.start)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getIncomeColor(groupTotals.income) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>+{formatCurrency(groupTotals.income)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getExpenseColor(groupTotals.expenses) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrency(groupTotals.expenses)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(groupTotals.transfers) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.transfers)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(groupTotals.adjustments) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.adjustments)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(groupTotals.netChange) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatSignedCurrencyAlways(groupTotals.netChange)}</span>}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getBalanceColor(groupTotals.end) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatCurrency(groupTotals.end)}</span>}
          </div>
          {/* Total, Cleared, Uncleared totals for group */}
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end' }}>
            {featureFlags.showGroupTotals && accountClearedBalances && (
              <span style={groupTotalText}>
                {formatCurrency(
                  accounts.reduce((sum, [accountId]) => {
                    const bal = accountClearedBalances[accountId]
                    return sum + (bal?.uncleared_balance ?? 0)
                  }, 0)
                )}
              </span>
            )}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end' }}>
            {featureFlags.showGroupTotals && accountClearedBalances && (
              <span style={groupTotalText}>
                {(() => {
                  const clearedTotal = accounts.reduce((sum, [accountId]) => {
                    const bal = accountClearedBalances[accountId]
                    return sum + (bal?.cleared_balance ?? 0)
                  }, 0)
                  const unclearedTotal = accounts.reduce((sum, [accountId]) => {
                    const bal = accountClearedBalances[accountId]
                    return sum + (bal?.uncleared_balance ?? 0)
                  }, 0)
                  return Math.abs(unclearedTotal - clearedTotal) < 0.01
                    ? <span style={{ opacity: 0.3, color: '#9ca3af' }}>—</span>
                    : formatCurrency(clearedTotal)
                })()}
              </span>
            )}
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end' }}>
            {featureFlags.showGroupTotals && accountClearedBalances && (
              <span style={groupTotalText}>
                {(() => {
                  const clearedTotal = accounts.reduce((sum, [accountId]) => {
                    const bal = accountClearedBalances[accountId]
                    return sum + (bal?.cleared_balance ?? 0)
                  }, 0)
                  const unclearedTotal = accounts.reduce((sum, [accountId]) => {
                    const bal = accountClearedBalances[accountId]
                    return sum + (bal?.uncleared_balance ?? 0)
                  }, 0)
                  const difference = unclearedTotal - clearedTotal
                  return Math.abs(difference) < 0.01 ? <span style={{ opacity: 0.3, color: '#9ca3af' }}>—</span> : formatSignedCurrencyAlways(difference)
                })()}
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
          marginTop: '1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          borderBottom: groupTotalRowBorder,
          background: 'rgba(255,255,255,0.04)',
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
              {formatCurrency(groupTotals.end)}
            </span>
          )}
        </div>
      )}

      {/* Account rows */}
      {accounts.map(([accountId, account], index) => {
        const bal = accountBalances[accountId]
        if (!bal) return null
        const clearedBal = accountClearedBalances?.[accountId]

        if (isMobile) {
          return (
            <div key={accountId} style={{ gridColumn: '1 / -1' }}>
              <MobileAccountRow account={account} balance={bal} clearedBalance={clearedBal} />
            </div>
          )
        }

        return <AccountGridRow key={accountId} account={account} balance={bal} clearedBalance={clearedBal} isEvenRow={index % 2 === 0} />
      })}
    </div>
  )
}

// =============================================================================
// ACCOUNT GRID ROW - renders directly as grid items (display: contents)
// =============================================================================

function AccountGridRow({ account, balance, clearedBalance, isEvenRow }: { account: FinancialAccount; balance: AccountMonthBalance; clearedBalance?: AccountClearedBalance; isEvenRow: boolean }) {
  const rowBg = isEvenRow ? 'transparent' : 'rgba(255,255,255,0.04)'
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr', // Match parent grid columns
    }}>
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.nickname}</span>
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(balance.start_balance) }}>
        {formatCurrency(balance.start_balance)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getIncomeColor(balance.income) }}>
        +{formatCurrency(balance.income)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getExpenseColor(balance.expenses) }}>
        {formatSignedCurrency(balance.expenses)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getNetChangeColor(balance.transfers) }}>
        {formatSignedCurrencyAlways(balance.transfers)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getNetChangeColor(balance.adjustments) }}>
        {formatSignedCurrencyAlways(balance.adjustments)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getNetChangeColor(balance.net_change) }}>
        {formatSignedCurrencyAlways(balance.net_change)}
      </div>
      <div style={{ ...cellStyle, justifyContent: 'flex-end', fontWeight: 600, color: getBalanceColor(balance.end_balance) }}>
        {formatCurrency(balance.end_balance)}
      </div>
      {/* Total balance column (uncleared_balance) */}
      {clearedBalance ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(clearedBalance.uncleared_balance), fontWeight: 600 }}>
          {formatCurrency(clearedBalance.uncleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.3, color: '#9ca3af' }}>
          —
        </div>
      )}
      {/* Cleared balance column - show dash if same as total */}
      {clearedBalance ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(clearedBalance.cleared_balance) }}>
          {Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) < 0.01
            ? <span style={{ opacity: 0.3, color: '#9ca3af' }}>—</span>
            : formatCurrency(clearedBalance.cleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.3, color: '#9ca3af' }}>
          —
        </div>
      )}
      {/* Uncleared portion column (difference) - show dash if same as cleared */}
      {clearedBalance && Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) >= 0.01 ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getNetChangeColor(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) }}>
          {formatSignedCurrencyAlways(clearedBalance.uncleared_balance - clearedBalance.cleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.3, color: '#9ca3af' }}>
          —
        </div>
      )}
    </div>
  )
}

// =============================================================================
// MOBILE ACCOUNT ROW
// =============================================================================

function MobileAccountRow({ account, balance, clearedBalance }: { account: FinancialAccount; balance: AccountMonthBalance; clearedBalance?: AccountClearedBalance }) {
  return (
    <div style={{ background: 'color-mix(in srgb, currentColor 5%, transparent)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.25rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>{account.nickname}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: clearedBalance && Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) >= 0.01 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '0.25rem', fontSize: '0.75rem' }}>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Start</span>
          <span>{formatCurrency(balance.start_balance)}</span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>Net Change</span>
          <span style={{ color: getBalanceColor(balance.net_change) }}>
            {formatSignedCurrencyAlways(balance.net_change)}
          </span>
        </div>
        <div>
          <span style={{ opacity: 0.6, display: 'block' }}>End</span>
          <span style={{ color: getBalanceColor(balance.end_balance) }}>{formatCurrency(balance.end_balance)}</span>
        </div>
        {clearedBalance && (
          <>
            <div>
              <span style={{ opacity: 0.6, display: 'block' }}>Total</span>
              <span style={{ color: getBalanceColor(clearedBalance.uncleared_balance), fontWeight: 600 }}>
                {formatCurrency(clearedBalance.uncleared_balance)}
              </span>
            </div>
            {Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) >= 0.01 ? (
              <>
                <div>
                  <span style={{ opacity: 0.6, display: 'block' }}>Cleared</span>
                  <span style={{ color: getBalanceColor(clearedBalance.cleared_balance) }}>
                    {formatCurrency(clearedBalance.cleared_balance)}
                  </span>
                </div>
                <div>
                  <span style={{ opacity: 0.6, display: 'block' }}>Uncleared</span>
                  <span style={{ color: getNetChangeColor(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) }}>
                    {formatSignedCurrencyAlways(clearedBalance.uncleared_balance - clearedBalance.cleared_balance)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span style={{ opacity: 0.6, display: 'block' }}>Cleared</span>
                  <span style={{ opacity: 0.3, color: '#9ca3af' }}>—</span>
                </div>
                <div>
                  <span style={{ opacity: 0.6, display: 'block' }}>Uncleared</span>
                  <span style={{ opacity: 0.3, color: '#9ca3af' }}>—</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
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

