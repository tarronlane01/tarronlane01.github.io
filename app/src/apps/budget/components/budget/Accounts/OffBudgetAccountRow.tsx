/**
 * OffBudgetAccountRow - Simplified row for off-budget accounts on settings page.
 * Shows account name, balance, and edit/move actions in a flat flex layout.
 */

import type { AccountWithId, GroupWithId } from '@budget/hooks/useAccountsPage'
import type { AccountFormData } from './AccountForm'
import type { AccountsMap } from '@budget/types'
import type { AccountClearedBalance } from '@calculations'
import { formatStatsCurrency, getBalanceColor } from '@budget/components/ui'
import { AccountForm } from './AccountForm'
import { AccountGroupBadge } from './AccountGroupBadge'
import { logUserAction } from '@utils'

interface OffBudgetAccountRowProps {
  account: AccountWithId
  accountIndex: number
  clearedBalance?: AccountClearedBalance
  editingAccountId: string | null
  setEditingAccountId: (id: string | null) => void
  onUpdateAccount: (id: string, data: AccountFormData) => void
  onDelete: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  allGroups: GroupWithId[]
  allAccounts: AccountsMap
  isMobile: boolean
}

export function OffBudgetAccountRow({
  account, accountIndex, clearedBalance,
  editingAccountId, setEditingAccountId, onUpdateAccount, onDelete,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  allGroups, allAccounts, isMobile,
}: OffBudgetAccountRowProps) {
  if (editingAccountId === account.id) {
    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <AccountForm
          initialData={{
            nickname: account.nickname,
            account_group_id: account.account_group_id,
            is_income_account: account.is_income_account,
            is_income_default: account.is_income_default,
            is_outgo_account: account.is_outgo_account,
            is_outgo_default: account.is_outgo_default,
            on_budget: account.on_budget,
          }}
          onSubmit={(data) => onUpdateAccount(account.id, data)}
          onCancel={() => setEditingAccountId(null)}
          onDelete={() => { logUserAction('CLICK', 'Delete Account', { details: account.nickname }); onDelete(account.id); setEditingAccountId(null) }}
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

  const balance = clearedBalance?.uncleared_balance ?? account.balance ?? 0
  const isEvenRow = accountIndex % 2 === 0
  const rowBg = isEvenRow ? 'transparent' : 'var(--row-alt-bg)'
  const group = allGroups.find(g => g.id === account.account_group_id)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem',
      background: rowBg,
      fontSize: '0.9rem',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.nickname}
        </span>
        {group && <AccountGroupBadge groupName={group.name} colorKey={group.badge_color ?? 'grey'} />}
      </span>
      <span style={{ color: getBalanceColor(balance), fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatStatsCurrency(balance)}
      </span>
      <button
        onClick={() => { logUserAction('CLICK', 'Edit Account', { details: account.nickname }); setEditingAccountId(account.id) }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
        title="Edit"
      >
        ✏️
      </button>
      {!isMobile && (
        <>
          <button onClick={onMoveUp} disabled={!canMoveUp} style={{ background: 'transparent', border: 'none', cursor: canMoveUp ? 'pointer' : 'default', opacity: canMoveUp ? 0.6 : 0.2, fontSize: '0.9rem', padding: '0.25rem' }} title="Move up">▲</button>
          <button onClick={onMoveDown} disabled={!canMoveDown} style={{ background: 'transparent', border: 'none', cursor: canMoveDown ? 'pointer' : 'default', opacity: canMoveDown ? 0.6 : 0.2, fontSize: '0.9rem', padding: '0.25rem' }} title="Move down">▼</button>
        </>
      )}
    </div>
  )
}
