import type { DragEvent } from 'react'
import type { ExpectedBalanceType } from '@types'
import {
  Button,
  DraggableCard,
  formatCurrency,
  getBalanceColor,
} from '../../ui'
import {
  listContainer,
  itemTitle,
  sectionHeader,
  colors,
  reorderButton,
  reorderButtonGroup,
} from '../../../styles/shared'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { AccountForm } from './AccountForm'
import { GroupForm } from './GroupForm'
import { AccountFlags } from './AccountFlags'
import { GroupOverrideFlags } from './GroupOverrideFlags'
import { AccountEndDropZone } from './AccountEndDropZone'
import type { AccountFormData, GroupFormData, GroupWithId, AccountWithId } from '../../../hooks/useAccountsPage'
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
  dragType: 'account' | 'group' | null
  draggedId: string | null
  dragOverId: string | null
  dragOverGroupId: string | null
  setDragOverId: (id: string | null) => void
  setDragOverGroupId: (id: string | null) => void

  // Drag handlers
  onAccountDragStart: (e: DragEvent, accountId: string) => void
  onAccountDragOver: (e: DragEvent, accountId: string, groupId: string) => void
  onAccountDrop: (e: DragEvent, targetId: string, targetGroupId: string) => void
  onGroupDragStart: (e: DragEvent, groupId: string) => void
  onGroupDragOver: (e: DragEvent, groupId: string) => void
  onGroupDrop: (e: DragEvent, targetId: string) => void
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
  onGroupDragStart,
  onGroupDragOver,
  onGroupDrop,
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

  const isGroupDragging = dragType === 'group' && draggedId === group.id
  const isGroupDragOver = dragType === 'group' && dragOverId === group.id
  const isAccountMovingHere = dragType === 'account' && dragOverGroupId === group.id
  const draggedAccount = draggedId && dragType === 'account' ? allAccounts[draggedId] : null
  const isMovingToDifferentGroup = draggedAccount && Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] &&
    (Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] as { account_group_id?: string | null })?.account_group_id !== group.id

  const showDropIndicator = dragType === 'group' && isGroupDragOver && draggedId !== group.id
  const canMoveGroupUp = groupIndex > 0
  const canMoveGroupDown = groupIndex < totalGroups - 1
  const groupTotal = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div>
      {/* Drop indicator line above group */}
      {dragType === 'group' && !isGroupDragging && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverId(group.id) }}
          onDragLeave={onDragLeave}
          onDrop={(e) => onGroupDrop(e, group.id)}
          style={{
            position: 'relative',
            height: showDropIndicator ? '2.5rem' : '0.5rem',
            marginBottom: showDropIndicator ? '-0.5rem' : '-0.25rem',
            transition: 'height 0.15s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '3px',
              background: colors.primary,
              borderRadius: '2px',
              opacity: showDropIndicator ? 1 : 0,
              transition: 'opacity 0.15s',
              boxShadow: showDropIndicator ? `0 0 8px rgba(100, 108, 255, 0.6)` : 'none',
            }}
          />
          {showDropIndicator && (
            <span style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '0.75rem',
              opacity: 0.7,
              background: 'var(--background, #1a1a1a)',
              padding: '0 0.5rem',
              whiteSpace: 'nowrap',
            }}>
              Drop here
            </span>
          )}
        </div>
      )}

      <div
        draggable={editingGroupId !== group.id}
        onDragStart={(e) => onGroupDragStart(e, group.id)}
        onDragOver={(e) => onGroupDragOver(e, group.id)}
        onDragLeave={onDragLeaveGroup}
        onDragEnd={onDragEnd}
        onDrop={(e) => onDropOnGroup(e, group.id)}
        style={{
          background: isGroupDragging
            ? 'color-mix(in srgb, currentColor 3%, transparent)'
            : (isAccountMovingHere && isMovingToDifferentGroup)
              ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
              : 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '12px',
          padding: '1rem',
          opacity: isGroupDragging ? 0.5 : 1,
          border: (isAccountMovingHere && isMovingToDifferentGroup)
            ? `2px dashed ${colors.primary}`
            : '2px solid transparent',
          cursor: editingGroupId === group.id ? 'default' : 'grab',
          transition: 'all 0.15s',
        }}
      >
        {editingGroupId === group.id ? (
          <GroupForm
            initialData={{
              name: group.name,
              expected_balance: group.expected_balance || 'positive',
              on_budget: group.on_budget,
              is_active: group.is_active,
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
                        {formatCurrency(account.balance)}
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

interface GroupHeaderProps {
  group: GroupWithId
  accountCount: number
  groupTotal: number
  canMoveUp: boolean
  canMoveDown: boolean
  isMobile: boolean
  createForGroupId: string | null
  onEdit: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onAddAccount: () => void
}

function GroupHeader({
  group,
  accountCount,
  groupTotal,
  canMoveUp,
  canMoveDown,
  isMobile,
  createForGroupId,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddAccount,
}: GroupHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isMobile ? '0.5rem' : '0.75rem',
      paddingBottom: '0.5rem',
      borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      gap: '0.5rem',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      <h3 style={{ ...sectionHeader, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
        {!isMobile && <span style={{ cursor: 'grab', opacity: 0.4 }}>⋮⋮</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '2px solid currentColor', paddingBottom: '2px' }}>
          {group.name}
        </span>
        <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9rem', flexShrink: 0 }}>
          ({accountCount})
        </span>
        <span style={{
          marginLeft: '0.5rem',
          fontWeight: 600,
          fontSize: '0.9rem',
          color: getBalanceColor(groupTotal),
          flexShrink: 0,
          borderBottom: '2px solid currentColor',
          paddingBottom: '2px',
        }}>
          {formatCurrency(groupTotal)}
        </span>
        <GroupOverrideFlags group={group} />
      </h3>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
        {!isMobile && (
          <Button variant="small" actionName={`Open Add Account Form (${group.name})`} onClick={onAddAccount} disabled={createForGroupId !== null}>
            + Account
          </Button>
        )}
        <button onClick={() => { logUserAction('CLICK', 'Edit Account Type', { details: group.name }); onEdit() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }} title="Edit account type">
          ✏️
        </button>
        <button onClick={() => { logUserAction('CLICK', 'Delete Account Type', { details: group.name }); onDelete() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem', padding: '0.25rem' }} title="Delete account type">
          🗑️
        </button>
        <div style={reorderButtonGroup}>
          <button onClick={onMoveUp} disabled={!canMoveUp} style={{ ...reorderButton, opacity: canMoveUp ? 0.6 : 0.2, cursor: canMoveUp ? 'pointer' : 'default' }} title="Move up" aria-label="Move up">
            ▲
          </button>
          <button onClick={onMoveDown} disabled={!canMoveDown} style={{ ...reorderButton, opacity: canMoveDown ? 0.6 : 0.2, cursor: canMoveDown ? 'pointer' : 'default' }} title="Move down" aria-label="Move down">
            ▼
          </button>
        </div>
      </div>
    </div>
  )
}

