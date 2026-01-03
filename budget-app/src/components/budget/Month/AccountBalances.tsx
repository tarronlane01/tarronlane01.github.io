/**
 * Account Balances View Components
 *
 * Components for displaying account balances by month in the Balances tab.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { AccountsMap, AccountGroupsMap, FinancialAccount, AccountMonthBalance } from '@types'
import { formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { colors, sectionHeader } from '../../../styles/shared'

interface AccountBalancesViewProps {
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  accountBalances: Record<string, AccountMonthBalance>
  isMobile: boolean
}

export function AccountBalancesView({
  accounts,
  accountGroups,
  accountBalances,
  isMobile,
}: AccountBalancesViewProps) {
  // Sort account groups by sort_order
  const sortedGroups = useMemo(() => {
    return Object.entries(accountGroups)
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [accountGroups])

  // Organize accounts by group
  const accountsByGroup = useMemo(() => {
    const result: Record<string, Array<[string, FinancialAccount]>> = {}

    Object.entries(accounts).forEach(([accountId, account]) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {Object.keys(accounts).length === 0 && (
        <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
          No accounts yet.{' '}
          <Link to="/budget/settings/accounts" style={{ color: colors.primaryLight }}>
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
          <AccountGroupBlock
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
          <AccountGroupBlock
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
    </div>
  )
}

interface AccountGroupBlockProps {
  name: string
  accounts: Array<[string, FinancialAccount]>
  groupTotals: {
    start: number
    income: number
    expenses: number
    netChange: number
    end: number
  }
  accountBalances: Record<string, AccountMonthBalance>
  isMobile: boolean
  isUngrouped?: boolean
}

function AccountGroupBlock({
  name,
  accounts,
  groupTotals,
  accountBalances,
  isMobile,
  isUngrouped,
}: AccountGroupBlockProps) {
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
            ({accounts.length})
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.8rem',
            color: getBalanceColor(groupTotals.netChange),
          }}>
            {formatSignedCurrencyAlways(groupTotals.netChange)}
          </span>
          <span style={{ fontWeight: 600, color: getBalanceColor(groupTotals.end) }}>
            {formatCurrency(groupTotals.end)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {accounts.map(([accountId, account]) => {
          const bal = accountBalances[accountId]
          if (!bal) return null

          return isMobile ? (
            <MobileAccountRow
              key={accountId}
              account={account}
              balance={bal}
            />
          ) : (
            <DesktopAccountRow
              key={accountId}
              account={account}
              balance={bal}
            />
          )
        })}
      </div>
    </div>
  )
}

interface AccountRowProps {
  account: FinancialAccount
  balance: AccountMonthBalance
}

function MobileAccountRow({ account, balance }: AccountRowProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '0.75rem',
    }}>
      {/* Account name row */}
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>
          {account.nickname}
        </span>
      </div>

      {/* Values in one row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.25rem',
        fontSize: '0.75rem',
      }}>
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
          <span style={{ color: getBalanceColor(balance.end_balance) }}>
            {formatCurrency(balance.end_balance)}
          </span>
        </div>
      </div>

      {/* Income/Expense breakdown */}
      {(balance.income > 0 || balance.expenses > 0) && (
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)',
          display: 'flex',
          gap: '1rem',
          fontSize: '0.7rem',
          opacity: 0.7,
        }}>
          {balance.income !== 0 && (
            <span>{formatSignedCurrencyAlways(balance.income)} income</span>
          )}
          {balance.expenses !== 0 && (
            <span>{formatSignedCurrency(balance.expenses)} expenses</span>
          )}
        </div>
      )}
    </div>
  )
}

function DesktopAccountRow({ account, balance }: AccountRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '0.6rem 0.75rem',
      background: 'color-mix(in srgb, currentColor 3%, transparent)',
      borderRadius: '6px',
    }}>
      <div style={{ flex: 2, minWidth: 0, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.nickname}
        </span>
        {/* Show income/expense breakdown if any */}
        {(balance.income !== 0 || balance.expenses !== 0) && (
          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            {balance.income !== 0 && formatSignedCurrencyAlways(balance.income)}
            {balance.income !== 0 && balance.expenses !== 0 && ' / '}
            {balance.expenses !== 0 && formatSignedCurrency(balance.expenses)}
          </span>
        )}
      </div>

      <span style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem' }}>
        {formatCurrency(balance.start_balance)}
      </span>

      <span style={{
        flex: 1,
        textAlign: 'right',
        fontSize: '0.9rem',
        color: getBalanceColor(balance.net_change),
      }}>
        {formatSignedCurrencyAlways(balance.net_change)}
      </span>

      <span style={{
        flex: 1,
        textAlign: 'right',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: getBalanceColor(balance.end_balance),
      }}>
        {formatCurrency(balance.end_balance)}
      </span>

      {/* Empty column to match header */}
      <span style={{ flex: 1 }}></span>
    </div>
  )
}

