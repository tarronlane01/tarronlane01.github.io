/**
 * SettingsAccountGroupRows - Group rows for account settings table
 *
 * Displays a group header and its accounts in table format.
 */

import type { AccountWithId, GroupWithId } from '@hooks/useAccountsPage'
import type { AccountFormData } from './AccountForm'
import type { AccountsMap } from '@types'
import { formatCurrency, getBalanceColor, Button } from '../../ui'
import { groupTotalText, groupTotalRowBorder, reorderButton, reorderButtonGroup } from '@styles/shared'
import { SettingsAccountTableRow } from './SettingsAccountTableRow'
import { AccountForm } from './AccountForm'
import { featureFlags } from '@constants'
import { logUserAction } from '@utils'

interface SettingsAccountGroupRowsProps {
  group: GroupWithId
  accounts: AccountWithId[]
  allGroups: GroupWithId[]
  allAccounts: AccountsMap
  editingAccountId: string | null
  createForGroupId: string | null
  setEditingAccountId: (id: string | null) => void
  setCreateForGroupId: (id: string | null) => void
  onUpdateAccount: (id: string, data: AccountFormData) => void
  onDeleteAccount: (id: string) => void
  onMoveAccount: (id: string, direction: 'up' | 'down') => void
  onCreateAccount: (data: AccountFormData, groupId: string | null) => void
  isMobile: boolean
  isUngrouped?: boolean
  // Group editing props
  canMoveGroupUp: boolean
  canMoveGroupDown: boolean
  onEditGroup: () => void
  onDeleteGroup: () => void
  onMoveGroupUp: () => void
  onMoveGroupDown: () => void
}

export function SettingsAccountGroupRows({
  group,
  accounts,
  allGroups,
  allAccounts,
  editingAccountId,
  createForGroupId,
  setEditingAccountId,
  setCreateForGroupId,
  onUpdateAccount,
  onDeleteAccount,
  onMoveAccount,
  onCreateAccount,
  isMobile,
  isUngrouped,
  canMoveGroupUp,
  canMoveGroupDown,
  onEditGroup,
  onDeleteGroup,
  onMoveGroupUp,
  onMoveGroupDown,
}: SettingsAccountGroupRowsProps) {
  const sortedAccounts = [...accounts].sort((a, b) => a.sort_order - b.sort_order)
  const groupTotal = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

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
      {/* Desktop: Group header row */}
      {!isMobile && (
        <>
          <div style={{ ...groupHeaderCellStyle, opacity: isUngrouped ? 0.7 : 1, justifyContent: 'space-between' }}>
            <span>
              <span>{group.name}</span>
              <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({sortedAccounts.length})</span>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              {!isUngrouped && (
                <>
                  <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                    + Account
                  </Button>
                  <button
                    onClick={() => { logUserAction('CLICK', 'Edit Account Type', { details: group.name }); onEditGroup() }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                    title="Edit account type"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => { logUserAction('CLICK', 'Delete Account Type', { details: group.name }); onDeleteGroup() }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                    title="Delete account type"
                  >
                    🗑️
                  </button>
                  <div style={reorderButtonGroup}>
                    <button onClick={onMoveGroupUp} disabled={!canMoveGroupUp} style={{ ...reorderButton, opacity: canMoveGroupUp ? 0.6 : 0.2, cursor: canMoveGroupUp ? 'pointer' : 'default' }} title="Move up" aria-label="Move up">
                      ▲
                    </button>
                    <button onClick={onMoveGroupDown} disabled={!canMoveGroupDown} style={{ ...reorderButton, opacity: canMoveGroupDown ? 0.6 : 0.2, cursor: canMoveGroupDown ? 'pointer' : 'default' }} title="Move down" aria-label="Move down">
                      ▼
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={{ ...groupHeaderCellStyle, justifyContent: 'flex-end', color: getBalanceColor(groupTotal) }}>
            {featureFlags.showGroupTotals && <span style={groupTotalText}>{formatCurrency(groupTotal)}</span>}
          </div>
          <div style={groupHeaderCellStyle}></div>
          <div style={groupHeaderCellStyle}></div>
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
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, opacity: isUngrouped ? 0.7 : 1 }}>
              {group.name}
              <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400 }}>({sortedAccounts.length})</span>
            </span>
            {featureFlags.showGroupTotals && (
              <span style={{ ...groupTotalText, color: getBalanceColor(groupTotal) }}>
                {formatCurrency(groupTotal)}
              </span>
            )}
          </div>
          {!isUngrouped && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                + Account
              </Button>
              <button
                onClick={() => { logUserAction('CLICK', 'Edit Account Type', { details: group.name }); onEditGroup() }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                title="Edit account type"
              >
                ✏️
              </button>
              <button
                onClick={() => { logUserAction('CLICK', 'Delete Account Type', { details: group.name }); onDeleteGroup() }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }}
                title="Delete account type"
              >
                🗑️
              </button>
              <div style={reorderButtonGroup}>
                <button onClick={onMoveGroupUp} disabled={!canMoveGroupUp} style={{ ...reorderButton, opacity: canMoveGroupUp ? 0.6 : 0.2, cursor: canMoveGroupUp ? 'pointer' : 'default' }} title="Move up" aria-label="Move up">
                  ▲
                </button>
                <button onClick={onMoveGroupDown} disabled={!canMoveGroupDown} style={{ ...reorderButton, opacity: canMoveGroupDown ? 0.6 : 0.2, cursor: canMoveGroupDown ? 'pointer' : 'default' }} title="Move down" aria-label="Move down">
                  ▼
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Account rows */}
      {sortedAccounts.map((account, idx) => (
        <SettingsAccountTableRow
          key={account.id}
          account={account}
          accountIndex={idx}
          totalAccounts={sortedAccounts.length}
          allGroups={allGroups}
          allAccounts={allAccounts}
          onEdit={setEditingAccountId}
          onDelete={onDeleteAccount}
          onMoveUp={() => onMoveAccount(account.id, 'up')}
          onMoveDown={() => onMoveAccount(account.id, 'down')}
          canMoveUp={idx > 0}
          canMoveDown={idx < sortedAccounts.length - 1}
          editingAccountId={editingAccountId}
          setEditingAccountId={setEditingAccountId}
          onUpdateAccount={onUpdateAccount}
          isMobile={isMobile}
        />
      ))}

      {/* Create form */}
      {createForGroupId === group.id && (
        <div style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
          <AccountForm
            initialData={{ nickname: '', account_group_id: group.id }}
            onSubmit={(data) => onCreateAccount(data, group.id)}
            onCancel={() => setCreateForGroupId(null)}
            submitLabel="Create"
            accountGroups={allGroups}
            showIncomeSettings={true}
            currentGroupId={group.id}
          />
        </div>
      )}
    </div>
  )
}

