/**
 * Account Balances View Components
 *
 * Components for displaying account balances by month in the Balances tab.
 * Renders a flat list sorted by global sort_order with inline group labels.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { AccountsMap, AccountGroupsMap, FinancialAccount, AccountMonthBalance } from '@types'
import { formatCurrency, formatSignedCurrency, formatSignedCurrencyAlways, getBalanceColor } from '../../ui'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'

// Muted inline group label style
const groupLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  opacity: 0.5,
  fontWeight: 400,
  marginLeft: '0.35rem',
}

interface AccountBalancesViewProps {
  accounts: AccountsMap
  accountGroups: AccountGroupsMap
  accountBalances: Record<string, AccountMonthBalance>
  isMobile: boolean
  /** YYYYMM string for the month being viewed — used to filter deleted accounts */
  viewingYearMonth?: string
}

export function AccountBalancesView({
  accounts,
  accountGroups,
  accountBalances,
  isMobile,
  viewingYearMonth,
}: AccountBalancesViewProps) {
  // Filter and sort accounts — deleted accounts show through their deletion month only
  const sortedAccounts = useMemo(() => {
    return Object.entries(accounts)
      .filter(([, acc]) => {
        if (!acc.is_deleted) return true
        if (!viewingYearMonth) return false
        return !!acc.deleted_year_month && viewingYearMonth <= acc.deleted_year_month
      })
      .sort((a, b) => a[1].sort_order - b[1].sort_order)
  }, [accounts, viewingYearMonth])

  function getGroupName(account: FinancialAccount): string | undefined {
    if (account.account_group_id === UNGROUPED_ACCOUNT_GROUP_ID) return 'Ungrouped'
    return accountGroups[account.account_group_id]?.name
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {Object.keys(accounts).length === 0 && (
        <p style={{ opacity: 0.6, textAlign: 'center', padding: '2rem' }}>
          No accounts yet.{' '}
          <Link to="/budget/settings/accounts" style={{ opacity: 1 }}>
            Add accounts →
          </Link>
        </p>
      )}

      {sortedAccounts.map(([accountId, account]) => {
        let bal = accountBalances[accountId]
        if (!bal) return null
        // Override end_balance to 0 for deleted accounts in their deletion month
        if (account.is_deleted && viewingYearMonth && account.deleted_year_month === viewingYearMonth) {
          bal = { ...bal, end_balance: 0 }
        }
        const groupName = getGroupName(account)

        return isMobile ? (
          <MobileAccountRow
            key={accountId}
            account={account}
            balance={bal}
            groupName={groupName}
          />
        ) : (
          <DesktopAccountRow
            key={accountId}
            account={account}
            balance={bal}
            groupName={groupName}
          />
        )
      })}
    </div>
  )
}

interface AccountRowProps {
  account: FinancialAccount
  balance: AccountMonthBalance
  groupName?: string
}

function MobileAccountRow({ account, balance, groupName }: AccountRowProps) {
  return (
    <div style={{
      background: 'color-mix(in srgb, currentColor 5%, transparent)',
      borderRadius: '8px',
      padding: '0.75rem',
    }}>
      {/* Account name row */}
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500 }}>
          {account.nickname}{account.is_deleted && ' (deleted)'}
        </span>
        {groupName && <span style={groupLabelStyle}>({groupName})</span>}
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

function DesktopAccountRow({ account, balance, groupName }: AccountRowProps) {
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
          {account.nickname}{account.is_deleted && ' (deleted)'}
          {groupName && <span style={groupLabelStyle}>({groupName})</span>}
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
