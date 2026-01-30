/**
 * MonthAccounts - Account balances view
 *
 * Displays account balances for the current month.
 * Uses CSS Grid with sticky subgrid header for column alignment.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useMonthData } from '@hooks'
import { useIsMobile } from '@hooks'
import type { FinancialAccount } from '@types'
import { formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import { colors } from '@styles/shared'
import { AccountStatsRow } from './MonthBalances'
import { AccountGroupRows } from './AccountGridRows'
import {
  calculateAccountBalances,
  calculateAccountBalanceTotals,
  calculateAccountClearedBalances,
} from '@calculations'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem',
  borderBottom: '2px solid var(--border-medium)',
}

// Helper color functions
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

export function MonthAccounts() {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { accounts, accountGroups } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()


  // Sort account groups by sort_order
  const sortedGroups = useMemo(() => {
    return Object.entries(accountGroups)
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [accountGroups])

  // Organize accounts by group (excluding hidden accounts)
  const accountsByGroup = useMemo(() => {
    const result: Record<string, Array<[string, FinancialAccount]>> = {}

    Object.entries(accounts)
      .filter(([, account]) => !account.is_hidden) // Exclude hidden accounts
      .forEach(([accountId, account]) => {
        const groupId = account.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID
        if (!result[groupId]) result[groupId] = []
        result[groupId].push([accountId, account])
      })

    // Sort accounts within each group by sort_order
    Object.keys(result).forEach(groupId => {
      result[groupId].sort((a, b) => a[1].sort_order - b[1].sort_order)
    })

    return result
  }, [accounts])

  // Calculate account balances for this month
  const accountBalances = useMemo(
    () => calculateAccountBalances(currentMonth, accounts),
    [currentMonth, accounts]
  )

  // Calculate cleared/uncleared balances for this month
  const accountClearedBalances = useMemo(
    () => calculateAccountClearedBalances(currentMonth, accounts),
    [currentMonth, accounts]
  )

  // Calculate account balance totals
  const accountBalanceTotals = useMemo(
    () => calculateAccountBalanceTotals(accountBalances),
    [accountBalances]
  )

  // Calculate net change total
  // Net change = income + expenses (expenses is negative for money out)
  const netChangeTotal = accountBalanceTotals.income + accountBalanceTotals.expenses

  // Shared cell style for data rows
  const cellStyle: React.CSSProperties = {
    padding: '0.6rem 0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  // Grand totals row style - distinct outline
  const grandTotalsCellStyle: React.CSSProperties = {
    ...cellStyle,
    borderTop: '2px solid var(--border-strong)',
    borderBottom: '2px solid var(--border-strong)',
    fontWeight: 600,
  }

  return (
    <>
      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Account, Start, Income, Expenses, Transfers, Adjustments, Net Change, End, Total, Cleared, Uncleared
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: 'var(--sticky-header-bg)',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'subgrid',
        }}>
          {/* Column headers row - uses grid columns (above stats) */}
          {!isMobile && (
            <>
              <div style={columnHeaderStyle}>Account</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Start</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Income</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Expenses</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Transfers</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Adjust</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Net Change</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>End</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Total</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Cleared</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Uncleared</div>
            </>
          )}

          {/* Grand totals row - uses grid columns */}
          {!isMobile ? (
            <>
              <div style={{ ...grandTotalsCellStyle }}>
                Grand Totals
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getBalanceColor(accountBalanceTotals.start) }}>
                {formatSignedCurrency(accountBalanceTotals.start)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getIncomeColor(accountBalanceTotals.income) }}>
                +{formatCurrency(accountBalanceTotals.income)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getExpenseColor(accountBalanceTotals.expenses) }}>
                {formatSignedCurrency(accountBalanceTotals.expenses)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(accountBalanceTotals.transfers) }}>
                {formatSignedCurrencyAlways(accountBalanceTotals.transfers)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(accountBalanceTotals.adjustments) }}>
                {formatSignedCurrencyAlways(accountBalanceTotals.adjustments)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(netChangeTotal) }}>
                {formatSignedCurrencyAlways(netChangeTotal)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getBalanceColor(accountBalanceTotals.end) }}>
                {formatSignedCurrency(accountBalanceTotals.end)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end' }}>
                {/* Total - sum of all uncleared balances */}
                {Object.keys(accountClearedBalances).length > 0
                  ? formatSignedCurrency(Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.uncleared_balance, 0))
                  : <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end' }}>
                {/* Cleared total - show dash if same as total */}
                {(() => {
                  if (Object.keys(accountClearedBalances).length === 0) return <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
                  const clearedTotal = Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.cleared_balance, 0)
                  const unclearedTotal = Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.uncleared_balance, 0)
                  return Math.abs(unclearedTotal - clearedTotal) < 0.01
                    ? <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
                    : formatSignedCurrency(clearedTotal)
                })()}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end' }}>
                {/* Uncleared total (difference) - show dash if same as cleared */}
                {(() => {
                  if (Object.keys(accountClearedBalances).length === 0) return <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
                  const clearedTotal = Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.cleared_balance, 0)
                  const unclearedTotal = Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.uncleared_balance, 0)
                  const difference = unclearedTotal - clearedTotal
                  return Math.abs(difference) < 0.01 ? <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span> : formatSignedCurrencyAlways(difference)
                })()}
              </div>
            </>
          ) : (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem 1rem',
              fontSize: '0.85rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              borderTop: '2px solid var(--border-strong)',
              borderBottom: '2px solid var(--border-strong)',
            }}>
              <span style={{ fontWeight: 600 }}>Grand Totals:</span>
              <AccountStatsRow totals={accountBalanceTotals} />
            </div>
          )}
        </div>

        {/* Account Balances - rendered directly in grid */}
        {Object.keys(accounts).length === 0 && (
          <p style={{ gridColumn: '1 / -1', opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
            No accounts yet.{' '}
            <Link to="/budget/settings/accounts" style={{ opacity: 1 }}>
              Add accounts →
            </Link>
          </p>
        )}

        {/* Account Groups */}
        {sortedGroups.map((group, groupIndex) => {
          const groupAccounts = accountsByGroup[group.id] || []
          if (groupAccounts.length === 0) return null

          const groupTotals = groupAccounts.reduce((acc, [accountId]) => {
            const bal = accountBalances[accountId]
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              income: acc.income + bal.income,
              expenses: acc.expenses + bal.expenses,
              transfers: acc.transfers + bal.transfers,
              adjustments: acc.adjustments + bal.adjustments,
              netChange: acc.netChange + bal.net_change,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, income: 0, expenses: 0, transfers: 0, adjustments: 0, netChange: 0, end: 0 })

          return (
            <AccountGroupRows
              key={group.id}
              name={group.name}
              accounts={groupAccounts}
              groupTotals={groupTotals}
              accountBalances={accountBalances}
              accountClearedBalances={accountClearedBalances}
              isMobile={isMobile}
              isFirstGroup={groupIndex === 0}
            />
          )
        })}

        {/* Ungrouped Accounts */}
        {accountsByGroup[UNGROUPED_ACCOUNT_GROUP_ID]?.length > 0 && (() => {
          const ungroupedAccounts = accountsByGroup[UNGROUPED_ACCOUNT_GROUP_ID]
          const ungroupedTotals = ungroupedAccounts.reduce((acc, [accountId]) => {
            const bal = accountBalances[accountId]
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              income: acc.income + bal.income,
              expenses: acc.expenses + bal.expenses,
              transfers: acc.transfers + bal.transfers,
              adjustments: acc.adjustments + bal.adjustments,
              netChange: acc.netChange + bal.net_change,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, income: 0, expenses: 0, transfers: 0, adjustments: 0, netChange: 0, end: 0 })

          // Ungrouped accounts are first only if there are no groups before them
          const isFirstGroup = sortedGroups.length === 0

          return (
            <AccountGroupRows
              key={UNGROUPED_ACCOUNT_GROUP_ID}
              name="Ungrouped"
              accounts={ungroupedAccounts}
              groupTotals={ungroupedTotals}
              accountBalances={accountBalances}
              accountClearedBalances={accountClearedBalances}
              isMobile={isMobile}
              isUngrouped
              isFirstGroup={isFirstGroup}
            />
          )
        })()}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </>
  )
}
