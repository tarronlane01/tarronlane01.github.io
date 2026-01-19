/**
 * SettingsAccountTableRow - Table row component for account settings
 *
 * Displays an account in a table row format using display: contents
 * to work within CSS Grid layout, similar to month balance pages.
 */

import type { AccountWithId, GroupWithId } from '@hooks/useAccountsPage'
import type { AccountFormData } from './AccountForm'
import type { AccountsMap } from '@types'
import { formatCurrency, getBalanceColor } from '../../ui'
import { AccountFlags } from './AccountFlags'
import { AccountForm } from './AccountForm'
import { logUserAction } from '@utils'

interface SettingsAccountTableRowProps {
  account: AccountWithId
  accountIndex: number
  totalAccounts: number
  allGroups: GroupWithId[]
  allAccounts: AccountsMap
  onEdit: (accountId: string) => void
  onDelete: (accountId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  editingAccountId: string | null
  setEditingAccountId: (id: string | null) => void
  onUpdateAccount: (id: string, data: AccountFormData) => void
  isMobile: boolean
}

export function SettingsAccountTableRow({
  account,
  accountIndex,
  allGroups,
  allAccounts,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  editingAccountId,
  setEditingAccountId,
  onUpdateAccount,
  isMobile,
}: SettingsAccountTableRowProps) {
  // If editing, render form that spans full width
  if (editingAccountId === account.id) {
    return (
      <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
        <AccountForm
          initialData={{
            nickname: account.nickname,
            account_group_id: account.account_group_id,
            is_income_account: account.is_income_account,
            is_income_default: account.is_income_default,
            is_outgo_account: account.is_outgo_account,
            is_outgo_default: account.is_outgo_default,
            on_budget: account.on_budget,
            is_active: account.is_active,
          }}
          onSubmit={(data) => {
            onUpdateAccount(account.id, data)
            setEditingAccountId(null)
          }}
          onCancel={() => setEditingAccountId(null)}
          onDelete={() => {
            logUserAction('CLICK', 'Delete Account', { details: account.nickname })
            onDelete(account.id)
            setEditingAccountId(null)
          }}
          submitLabel="Save"
          accountGroups={allGroups}
          showGroupSelector={true}
          showIncomeSettings={true}
          currentGroupId={account.account_group_id}
          hasExistingIncomeDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
          hasExistingOutgoDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
        />
      </div>
    )
  }

  // Mobile: render card-style row
  if (isMobile) {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <div
          style={{
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 500 }}>{account.nickname}</span>
            <span style={{ color: getBalanceColor(account.balance), fontWeight: 600 }}>
              {formatCurrency(account.balance)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <AccountFlags account={account} accountGroups={allGroups} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                logUserAction('CLICK', 'Edit Account', { details: account.nickname })
                onEdit(account.id)
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.6,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp()
              }}
              disabled={!canMoveUp}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: canMoveUp ? 'pointer' : 'default',
                opacity: canMoveUp ? 0.6 : 0.2,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Move up"
            >
              ▲
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              disabled={!canMoveDown}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: canMoveDown ? 'pointer' : 'default',
                opacity: canMoveDown ? 0.6 : 0.2,
                fontSize: '0.9rem',
                padding: '0.25rem',
              }}
              title="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Desktop: Grid row using display: contents
  const isEvenRow = accountIndex % 2 === 0
  const rowBg = isEvenRow ? 'transparent' : 'rgba(255,255,255,0.04)'
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem',
    background: rowBg,
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{ display: 'contents' }}>
      {/* Account name */}
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.nickname}</span>
      </div>

      {/* Balance */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(account.balance), fontWeight: 600 }}>
        {formatCurrency(account.balance)}
      </div>

      {/* Flags */}
      <div style={{ ...cellStyle, gap: '0.25rem', flexWrap: 'wrap' }}>
        <AccountFlags account={account} accountGroups={allGroups} />
      </div>

      {/* Actions */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            logUserAction('CLICK', 'Edit Account', { details: account.nickname })
            onEdit(account.id)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.6,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Edit"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          disabled={!canMoveUp}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: canMoveUp ? 'pointer' : 'default',
            opacity: canMoveUp ? 0.6 : 0.2,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          disabled={!canMoveDown}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: canMoveDown ? 'pointer' : 'default',
            opacity: canMoveDown ? 0.6 : 0.2,
            fontSize: '0.9rem',
            padding: '0.25rem',
          }}
          title="Move down"
        >
          ▼
        </button>
      </div>
    </div>
  )
}

