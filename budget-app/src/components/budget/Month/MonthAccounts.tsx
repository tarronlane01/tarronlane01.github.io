/**
 * MonthAccounts - Account balances view
 *
 * Displays account balances for the current month in a flat list.
 * Uses CSS Grid with sticky subgrid header for column alignment.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useMonthData } from '@hooks'
import { useIsMobile } from '@hooks'
import { formatCurrency, formatBalanceCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'
import { colors } from '@styles/shared'
import { isAccountOnBudget } from '@utils/calculations/balances/calculateTotalAvailable'
import { AccountSectionDivider } from '@components/budget/Accounts'
import { AccountStatsRow } from './MonthBalances'
import { AccountGridRow, ExpandedUnclearedRow, MobileAccountRow } from './AccountGridRow'
import {
  calculateAccountBalances,
  calculateAccountBalanceTotals,
  calculateAccountClearedBalances,
} from '@calculations'

// Numeric column min width so values align across rows
const NUM_COL_MIN = '5rem'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem 0.5rem',
  borderBottom: '2px solid var(--border-medium)',
}

// Shared style for numeric cells: tabular figures + right-align + intra-cell padding only
const numericCellStyle: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
}

// Helper color functions - consistent: positive=green, negative=red, zero=grey
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

export function MonthAccounts() {
  const { selectedBudgetId, currentYear, currentMonthNumber } = useBudget()
  const { accounts, accountGroups } = useBudgetData()
  const { month: currentMonth } = useMonthData(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)

  const viewingYearMonth = `${currentYear}${String(currentMonthNumber).padStart(2, '0')}`

  // Filter accounts for this month — deleted accounts show through their deletion month only
  const accountsForMonth = useMemo(() => {
    return Object.fromEntries(
      Object.entries(accounts).filter(([, acc]) => {
        if (!acc.is_deleted) return true
        return !!acc.deleted_year_month && viewingYearMonth <= acc.deleted_year_month
      })
    )
  }, [accounts, viewingYearMonth])

  // Flat sorted accounts for this month, sorted by global sort_order
  const sortedAccounts = useMemo(() => {
    return Object.entries(accountsForMonth)
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
  }, [accountsForMonth])

  // Split into on-budget, off-budget, deleted
  const { onBudgetAccounts, offBudgetAccounts, deletedAccounts } = useMemo(() => {
    const on: typeof sortedAccounts = []
    const off: typeof sortedAccounts = []
    const del: typeof sortedAccounts = []
    for (const entry of sortedAccounts) {
      const [, acc] = entry
      if (acc.is_deleted) {
        del.push(entry)
      } else if (isAccountOnBudget(acc, accountGroups)) {
        on.push(entry)
      } else {
        off.push(entry)
      }
    }
    return { onBudgetAccounts: on, offBudgetAccounts: off, deletedAccounts: del }
  }, [sortedAccounts, accountGroups])

  // Calculate account balances for this month
  const rawAccountBalances = useMemo(
    () => calculateAccountBalances(currentMonth, accountsForMonth),
    [currentMonth, accountsForMonth]
  )

  // Override end_balance to 0 for deleted accounts in their deletion month
  const accountBalances = useMemo(() => {
    const result: typeof rawAccountBalances = {}
    for (const [id, bal] of Object.entries(rawAccountBalances)) {
      const acc = accountsForMonth[id]
      if (acc?.is_deleted && acc.deleted_year_month === viewingYearMonth) {
        result[id] = { ...bal, end_balance: 0 }
      } else {
        result[id] = bal
      }
    }
    return result
  }, [rawAccountBalances, accountsForMonth, viewingYearMonth])

  // Calculate cleared/uncleared balances for this month
  const accountClearedBalances = useMemo(
    () => calculateAccountClearedBalances(currentMonth, accountsForMonth),
    [currentMonth, accountsForMonth]
  )

  // Calculate account balance totals
  const accountBalanceTotals = useMemo(
    () => calculateAccountBalanceTotals(accountBalances),
    [accountBalances]
  )

  // Net change = income + expenses (expenses is negative for money out)
  const netChangeTotal = accountBalanceTotals.income + accountBalanceTotals.expenses

  // Total uncleared (sum of all uncleared balances) for Grand Totals row
  const totalUncleared = useMemo(() => {
    if (Object.keys(accountClearedBalances).length === 0) return null
    return Object.values(accountClearedBalances).reduce((sum, bal) => sum + bal.uncleared_balance, 0)
  }, [accountClearedBalances])

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

  // Numeric grand-totals cells: tabular figures so columns line up
  const grandTotalsNumericStyle = { ...numericCellStyle, justifyContent: 'flex-end' as const }

  // Look up group name for an account
  function getGroupName(account: { account_group_id: string }): string | undefined {
    if (account.account_group_id === UNGROUPED_ACCOUNT_GROUP_ID) return 'Ungrouped'
    return accountGroups[account.account_group_id]?.name
  }

  // Render a section of account rows (row striping resets per section)
  function renderAccountSection(section: typeof sortedAccounts, isOffBudget = false) {
    return section.flatMap(([accountId, account], index) => {
      const bal = accountBalances[accountId]
      if (!bal) return []
      const clearedBal = accountClearedBalances?.[accountId]
      const hasUnclearedEnd = !!clearedBal && Math.abs(clearedBal.uncleared_balance - clearedBal.cleared_balance) >= 0.01
      const hasUnclearedStart = !!clearedBal && clearedBal.cleared_start_balance !== undefined
        && Math.abs(bal.start_balance - clearedBal.cleared_start_balance) >= 0.01
      const hasUnclearedDetail = hasUnclearedStart || hasUnclearedEnd
      const isExpanded = expandedAccountId === accountId
      const groupName = getGroupName(account)

      if (isMobile) {
        return [
          <div key={accountId} style={{ gridColumn: '1 / -1' }}>
            <MobileAccountRow
              account={account}
              balance={bal}
              clearedBalance={clearedBal}
              hasUnclearedDetail={hasUnclearedDetail}
              hasUnclearedStart={hasUnclearedStart}
              groupName={groupName}
              isOffBudget={isOffBudget}
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
          groupName={groupName}
          isOffBudget={isOffBudget}
        />,
        isExpanded && hasUnclearedDetail && clearedBal && (
          <ExpandedUnclearedRow key={`${accountId}-exp`} clearedBalance={clearedBal} startBalance={bal.start_balance} hasUnclearedStart={hasUnclearedStart} hasUnclearedEnd={hasUnclearedEnd} />
        ),
      ].filter(Boolean)
    })
  }

  return (
    <>
      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `2fr repeat(8, minmax(${NUM_COL_MIN}, 1fr))`,
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
              <div style={{ ...columnHeaderStyle, paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>Account</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Start</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Income</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Expenses</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Transfers</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Adjust</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Net Change</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>End</div>
              <div style={{ ...columnHeaderStyle, ...numericCellStyle, textAlign: 'right' }}>Total</div>
            </>
          )}

          {/* Grand totals row - uses grid columns */}
          {!isMobile ? (
            <>
              <div style={{ ...grandTotalsCellStyle }}>
                Grand Totals
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getBalanceColor(accountBalanceTotals.start) }}>
                {formatBalanceCurrency(accountBalanceTotals.start)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getIncomeColor(accountBalanceTotals.income) }}>
                +{formatCurrency(accountBalanceTotals.income)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getExpenseColor(accountBalanceTotals.expenses) }}>
                {formatSignedCurrency(accountBalanceTotals.expenses)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getNetChangeColor(accountBalanceTotals.transfers) }}>
                {formatSignedCurrencyAlways(accountBalanceTotals.transfers)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getNetChangeColor(accountBalanceTotals.adjustments) }}>
                {formatSignedCurrencyAlways(accountBalanceTotals.adjustments)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getNetChangeColor(netChangeTotal) }}>
                {formatSignedCurrencyAlways(netChangeTotal)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: getBalanceColor(accountBalanceTotals.end) }}>
                {formatBalanceCurrency(accountBalanceTotals.end)}
              </div>
              <div style={{ ...grandTotalsCellStyle, ...grandTotalsNumericStyle, color: totalUncleared !== null ? getBalanceColor(totalUncleared) : undefined }}>
                {totalUncleared !== null ? formatBalanceCurrency(totalUncleared) : <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>}
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

        {/* On-budget account rows */}
        {renderAccountSection(onBudgetAccounts)}

        {/* Off-budget section */}
        {offBudgetAccounts.length > 0 && (
          <>
            <AccountSectionDivider label="Off-Budget" />
            {renderAccountSection(offBudgetAccounts, true)}
          </>
        )}

        {/* Deleted section */}
        {deletedAccounts.length > 0 && (
          <>
            <AccountSectionDivider label="Deleted" />
            {renderAccountSection(deletedAccounts)}
          </>
        )}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </>
  )
}
