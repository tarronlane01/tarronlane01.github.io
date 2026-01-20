import type { DragEvent } from 'react'
import type { ExpectedBalanceType } from '@types'
import {
  Button,
  DraggableCard,
  formatSignedCurrency,
  getBalanceColor,
} from '../../ui'
import {
  listContainer,
  itemTitle,
  colors,
} from '@styles/shared'
import { useIsMobile } from '@hooks'
import { AccountForm } from './AccountForm'
import { GroupForm } from './GroupForm'
import { AccountFlags } from './AccountFlags'
import { AccountEndDropZone } from './AccountEndDropZone'
import { GroupHeader } from './AccountGroupHeader'
import type { AccountFormData, GroupFormData, GroupWithId, AccountWithId } from '@hooks/useAccountsPage'
import { logUserAction } from '@utils'

// Helper to check if a balance is unexpected
function hasUnexpectedBalance(balance: number, expectedBalance?: ExpectedBalanceType): boolean {
  if (!expectedBalance || expectedBalance === 'any' || balance === 0) return false
  if (expectedBalance === 'positive' && balance < 0) return true
  if (expectedBalance === 'negative' && balance > 0) return true
  return false
}

function getBalanceWarning(balance: number, expectedBalance?: ExpectedBalanceType): string | null {
  if (!expectedBalance || expectedBalance === 'any' || balance === 0) return null
  if (expectedBalance === 'positive' && balance < 0) return 'Unexpected negative balance'
  if (expectedBalance === 'negative' && balance > 0) return 'Unexpected positive balance (credit owed to you?)'
  return null
}

interface AccountGroupCardProps {
  group: GroupWithId
  groupIndex: number
  totalGroups: number
  accounts: AccountWithId[]
  allGroups: GroupWithId[]
  allAccounts: Record<string, { is_income_default?: boolean; is_outgo_default?: boolean }>

  // Editing state
  editingAccountId: string | null
  editingGroupId: string | null
  createForGroupId: string | null
  setEditingAccountId: (id: string | null) => void
  setEditingGroupId: (id: string | null) => void
  setCreateForGroupId: (id: string | null) => void

  // Drag state
  dragType: 'account' | null
  draggedId: string | null
  dragOverId: string | null
  dragOverGroupId: string | null
  setDragOverId: (id: string | null) => void
  setDragOverGroupId: (id: string | null) => void

  // Drag handlers
  onAccountDragStart: (e: DragEvent, accountId: string) => void
  onAccountDragOver: (e: DragEvent, accountId: string, groupId: string) => void
  onAccountDrop: (e: DragEvent, targetId: string, targetGroupId: string) => void
  onDragOverGroup: (e: DragEvent, groupId: string) => void
  onDragLeave: () => void
  onDragLeaveGroup: () => void
  onDragEnd: () => void
  onDropOnGroup: (e: DragEvent, groupId: string) => void

  // CRUD handlers
  onCreateAccount: (data: AccountFormData, groupId: string | null) => void
  onUpdateAccount: (accountId: string, data: AccountFormData) => void
  onDeleteAccount: (accountId: string) => void
  onMoveAccount: (accountId: string, direction: 'up' | 'down') => void
  onUpdateGroup: (groupId: string, data: GroupFormData) => void
  onDeleteGroup: (groupId: string) => void
  onMoveGroup: (groupId: string, direction: 'up' | 'down') => void
}

export function AccountGroupCard({
  group,
  groupIndex,
  totalGroups,
  accounts,
  allGroups,
  allAccounts,
  editingAccountId,
  editingGroupId,
  createForGroupId,
  setEditingAccountId,
  setEditingGroupId,
  setCreateForGroupId,
  dragType,
  draggedId,
  dragOverId,
  dragOverGroupId,
  setDragOverId,
  setDragOverGroupId,
  onAccountDragStart,
  onAccountDragOver,
  onAccountDrop,
  onDragOverGroup,
  onDragLeave,
  onDragLeaveGroup,
  onDragEnd,
  onDropOnGroup,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onMoveAccount,
  onUpdateGroup,
  onDeleteGroup,
  onMoveGroup,
}: AccountGroupCardProps) {
  const isMobile = useIsMobile()
  const sortedAccounts = [...accounts].sort((a, b) => a.sort_order - b.sort_order)

  const isAccountMovingHere = dragType === 'account' && dragOverGroupId === group.id
  const draggedAccount = draggedId && dragType === 'account' ? allAccounts[draggedId] : null
  const isMovingToDifferentGroup = draggedAccount && Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] &&
    (Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] as { account_group_id?: string | null })?.account_group_id !== group.id
  const canMoveGroupUp = groupIndex > 0
  const canMoveGroupDown = groupIndex < totalGroups - 1
  const groupTotal = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div>
      <div
        onDragOver={(e) => onDragOverGroup(e, group.id)}
        onDragLeave={onDragLeaveGroup}
        onDrop={(e) => onDropOnGroup(e, group.id)}
        style={{
          background: (isAccountMovingHere && isMovingToDifferentGroup)
            ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
            : 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '12px',
          padding: '1rem',
          border: (isAccountMovingHere && isMovingToDifferentGroup)
            ? `2px dashed ${colors.primary}`
            : '2px solid transparent',
          transition: 'all 0.15s',
        }}
      >
        {editingGroupId === group.id ? (
          <GroupForm
            initialData={{
              name: group.name,
              expected_balance: group.expected_balance || 'positive',
              on_budget: group.on_budget ?? undefined,
              is_active: group.is_active ?? undefined,
            }}
            onSubmit={(data) => onUpdateGroup(group.id, data)}
            onCancel={() => setEditingGroupId(null)}
            submitLabel="Save"
          />
        ) : (
          <>
            <GroupHeader
              group={group}
              accountCount={sortedAccounts.length}
              groupTotal={groupTotal}
              canMoveUp={canMoveGroupUp}
              canMoveDown={canMoveGroupDown}
              isMobile={isMobile}
              createForGroupId={createForGroupId}
              onEdit={() => setEditingGroupId(group.id)}
              onDelete={() => onDeleteGroup(group.id)}
              onMoveUp={() => onMoveGroup(group.id, 'up')}
              onMoveDown={() => onMoveGroup(group.id, 'down')}
              onAddAccount={() => setCreateForGroupId(group.id)}
            />

            {isMobile && (
              <div style={{ marginBottom: '0.5rem' }}>
                <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                  + Account
                </Button>
              </div>
            )}

            <div style={listContainer}>
              {sortedAccounts.map((account, idx) => (
                editingAccountId === account.id ? (
                  <AccountForm
                    key={account.id}
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
                    onSubmit={(data) => onUpdateAccount(account.id, data)}
                    onCancel={() => setEditingAccountId(null)}
                    submitLabel="Save"
                    accountGroups={allGroups}
                    showGroupSelector={true}
                    showIncomeSettings={true}
                    currentGroupId={account.account_group_id}
                    hasExistingIncomeDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
                    hasExistingOutgoDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
                  />
                ) : (
                  <DraggableCard
                    key={account.id}
                    isDragging={dragType === 'account' && draggedId === account.id}
                    isDragOver={dragOverId === account.id}
                    onDragStart={(e) => { e.stopPropagation(); onAccountDragStart(e, account.id) }}
                    onDragOver={(e) => onAccountDragOver(e, account.id, group.id)}
                    onDragLeave={onDragLeave}
                    onDragEnd={onDragEnd}
                    onDrop={(e) => onAccountDrop(e, account.id, group.id)}
                    onEdit={() => {
                      logUserAction('CLICK', 'Edit Account', { details: account.nickname })
                      setEditingAccountId(account.id)
                    }}
                    onDelete={() => {
                      logUserAction('CLICK', 'Delete Account', { details: account.nickname })
                      onDeleteAccount(account.id)
                    }}
                    onMoveUp={() => onMoveAccount(account.id, 'up')}
                    onMoveDown={() => onMoveAccount(account.id, 'down')}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < sortedAccounts.length - 1}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={itemTitle}>{account.nickname}</span>
                        <AccountFlags account={account} accountGroups={allGroups} />
                      </div>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: getBalanceColor(account.balance),
                      }}>
                        {formatSignedCurrency(account.balance)}
                        {hasUnexpectedBalance(account.balance, group.expected_balance) && (
                          <span title={getBalanceWarning(account.balance, group.expected_balance) || ''} style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>⚠️</span>
                        )}
                      </p>
                    </div>
                  </DraggableCard>
                )
              ))}

              {sortedAccounts.length === 0 && !createForGroupId && (
                <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  No accounts in this type
                </p>
              )}

              {dragType === 'account' && sortedAccounts.length > 0 && (
                <AccountEndDropZone
                  groupId={group.id}
                  isActive={dragOverId === `__end__${group.id}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDragOverId(`__end__${group.id}`)
                    setDragOverGroupId(group.id)
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation()
                    setDragOverId(null)
                  }}
                  onDrop={(e) => {
                    e.stopPropagation()
                    onAccountDrop(e, '__group_end__', group.id)
                  }}
                />
              )}

              {createForGroupId === group.id && (
                <AccountForm
                  initialData={{ nickname: '', account_group_id: group.id }}
                  onSubmit={(data) => onCreateAccount(data, group.id)}
                  onCancel={() => setCreateForGroupId(null)}
                  submitLabel="Create"
                  accountGroups={allGroups}
                  showIncomeSettings={true}
                  currentGroupId={group.id}
                />
              )}
            </div>

            {createForGroupId !== group.id && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
                <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={() => setCreateForGroupId(group.id)} disabled={createForGroupId !== null}>
                  + Add Account
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
