/**
 * MonthAccounts - Account balances view
 *
 * Displays account balances for the current month.
 * Uses CSS Grid with sticky subgrid header for column alignment.
 */

import { useMemo, useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBudget } from '@contexts'
import { useBudgetData, useBudgetMonth } from '@hooks'
import { useIsMobile } from '@hooks'
import type { FinancialAccount } from '@types'
import { formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors } from '@styles/shared'
import { AccountStatsRow } from './MonthBalances'
import { AccountGroupRows } from './AccountGridRows'
import { triggerRecalculation, type RecalculationProgress } from '@data/recalculation'
import { queryClient, queryKeys } from '@data/queryClient'
import { getYearMonthOrdinal } from '@utils'
import { LoadingOverlay, ProgressBar, StatItem, PercentLabel } from '../../app/LoadingOverlay'
import {
  calculateAccountBalances,
  calculateAccountBalanceTotals,
} from '@calculations'

// Column header style for the grid
const columnHeaderStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  opacity: 0.6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0.5rem',
  borderBottom: '2px solid rgba(255,255,255,0.2)',
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
  const { accounts, accountGroups, monthMap } = useBudgetData()
  const { month: currentMonth } = useBudgetMonth(selectedBudgetId, currentYear, currentMonthNumber)
  const isMobile = useIsMobile()

  // Check if current month needs recalculation from budget's month_map
  const currentMonthOrdinal = getYearMonthOrdinal(currentYear, currentMonthNumber)
  const monthNeedsRecalc = monthMap[currentMonthOrdinal]?.needs_recalculation === true

  // Track recalculation in progress and progress state
  const recalcInProgressRef = useRef(false)
  const [recalcProgress, setRecalcProgress] = useState<RecalculationProgress | null>(null)

  // Trigger recalculation when viewing and month needs it
  useEffect(() => {
    if (!selectedBudgetId || !currentMonth) return
    if (!monthNeedsRecalc || recalcInProgressRef.current) return

    recalcInProgressRef.current = true
    const triggeringMonthOrdinal = `${currentYear}${String(currentMonthNumber).padStart(2, '0')}`

    // Start recalculation - onProgress callback will set initial state
    triggerRecalculation(selectedBudgetId, {
      triggeringMonthOrdinal,
      onProgress: (progress) => setRecalcProgress(progress),
    })
      .then(() => {
        // Refresh month data after recalculation
        queryClient.invalidateQueries({ queryKey: queryKeys.month(selectedBudgetId, currentYear, currentMonthNumber) })
      })
      .catch((err) => {
        console.error('[MonthAccounts] Recalculation failed:', err)
      })
      .finally(() => {
        recalcInProgressRef.current = false
        setRecalcProgress(null)
      })
  }, [selectedBudgetId, monthNeedsRecalc, currentMonth, currentYear, currentMonthNumber])

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
        const groupId = account.account_group_id || 'ungrouped'
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
    borderTop: '2px solid rgba(255,255,255,0.3)',
    borderBottom: '2px solid rgba(255,255,255,0.3)',
    fontWeight: 600,
  }

  // Get phase label for progress overlay
  const getRecalcPhaseLabel = () => {
    if (!recalcProgress) return ''
    switch (recalcProgress.phase) {
      case 'reading-budget': return 'Reading budget data...'
      case 'fetching-months': return 'Fetching months...'
      case 'recalculating':
        return recalcProgress.currentMonth ? `Recalculating ${recalcProgress.currentMonth}...` : 'Recalculating...'
      case 'saving': return 'Saving results...'
      case 'complete': return 'Recalculation complete!'
      default: return 'Recalculating balances...'
    }
  }

  return (
    <>
      {/* Recalculation Progress Overlay */}
      {recalcProgress && (
        <LoadingOverlay message={getRecalcPhaseLabel()} spinnerColor="#22c55e">
          <ProgressBar
            percent={recalcProgress.percentComplete}
            gradient="linear-gradient(90deg, #22c55e, #10b981)"
          />
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {(recalcProgress.totalMonthsToFetch ?? 0) > 0 && (
              <StatItem
                value={`${recalcProgress.monthsFetched || 0}/${recalcProgress.totalMonthsToFetch}`}
                label="Months Loaded"
                color={recalcProgress.phase === 'fetching-months' ? '#22c55e' : '#6b7280'}
              />
            )}
            {(recalcProgress.totalMonths ?? 0) > 0 && (
              <StatItem
                value={`${recalcProgress.monthsProcessed}/${recalcProgress.totalMonths}`}
                label="Months Recalculated"
                color={recalcProgress.phase === 'recalculating' ? '#22c55e' : '#6b7280'}
              />
            )}
          </div>
          <PercentLabel percent={recalcProgress.percentComplete} />
        </LoadingOverlay>
      )}

      {/* CSS Grid container - header and content share the same grid */}
      <div style={{
        display: 'grid',
        // Account, Start, Income, Expenses, Net Change, End
        gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1fr 1fr',
      }}>
        {/* Sticky wrapper using subgrid on desktop, block on mobile */}
        <div style={{
          gridColumn: '1 / -1',
          position: 'sticky',
          top: 0,
          zIndex: 49,
          backgroundColor: '#242424',
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
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>Net Change</div>
              <div style={{ ...columnHeaderStyle, textAlign: 'right' }}>End</div>
            </>
          )}

          {/* Grand totals row - uses grid columns */}
          {!isMobile ? (
            <>
              <div style={{ ...grandTotalsCellStyle }}>
                Grand Totals
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getBalanceColor(accountBalanceTotals.start) }}>
                {formatCurrency(accountBalanceTotals.start)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getIncomeColor(accountBalanceTotals.income) }}>
                +{formatCurrency(accountBalanceTotals.income)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getExpenseColor(accountBalanceTotals.expenses) }}>
                {formatSignedCurrency(accountBalanceTotals.expenses)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getNetChangeColor(netChangeTotal) }}>
                {formatSignedCurrencyAlways(netChangeTotal)}
              </div>
              <div style={{ ...grandTotalsCellStyle, justifyContent: 'flex-end', color: getBalanceColor(accountBalanceTotals.end) }}>
                {formatCurrency(accountBalanceTotals.end)}
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
              borderTop: '2px solid rgba(255,255,255,0.3)',
              borderBottom: '2px solid rgba(255,255,255,0.3)',
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
        {sortedGroups.map(group => {
          const groupAccounts = accountsByGroup[group.id] || []
          if (groupAccounts.length === 0) return null

          const groupTotals = groupAccounts.reduce((acc, [accountId]) => {
            const bal = accountBalances[accountId]
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              income: acc.income + bal.income,
              expenses: acc.expenses + bal.expenses,
              netChange: acc.netChange + bal.net_change,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, income: 0, expenses: 0, netChange: 0, end: 0 })

          return (
            <AccountGroupRows
              key={group.id}
              name={group.name}
              accounts={groupAccounts}
              groupTotals={groupTotals}
              accountBalances={accountBalances}
              isMobile={isMobile}
            />
          )
        })}

        {/* Ungrouped Accounts */}
        {accountsByGroup['ungrouped']?.length > 0 && (() => {
          const ungroupedAccounts = accountsByGroup['ungrouped']
          const ungroupedTotals = ungroupedAccounts.reduce((acc, [accountId]) => {
            const bal = accountBalances[accountId]
            if (!bal) return acc
            return {
              start: acc.start + bal.start_balance,
              income: acc.income + bal.income,
              expenses: acc.expenses + bal.expenses,
              netChange: acc.netChange + bal.net_change,
              end: acc.end + bal.end_balance,
            }
          }, { start: 0, income: 0, expenses: 0, netChange: 0, end: 0 })

          return (
            <AccountGroupRows
              key="ungrouped"
              name="Ungrouped"
              accounts={ungroupedAccounts}
              groupTotals={ungroupedTotals}
              accountBalances={accountBalances}
              isMobile={isMobile}
              isUngrouped
            />
          )
        })()}

        {/* Bottom padding */}
        <div style={{ gridColumn: '1 / -1', height: '2rem' }} />
      </div>
    </>
  )
}
