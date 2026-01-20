import type { DragEvent } from 'react'
import {
  Button,
  DraggableCard,
  formatSignedCurrency,
  getBalanceColor,
} from '../../ui'
import {
  listContainer,
  itemTitle,
  sectionHeader,
  colors,
} from '@styles/shared'
import { AccountForm } from './AccountForm'
import { AccountFlags } from './AccountFlags'
import { AccountEndDropZone } from './AccountEndDropZone'
import type { AccountFormData, GroupWithId, AccountWithId } from '@hooks/useAccountsPage'
import { logUserAction } from '@utils'
import { featureFlags } from '@constants'

interface UngroupedAccountsSectionProps {
  accounts: AccountWithId[]
  allGroups: GroupWithId[]
  allAccounts: Record<string, { is_income_default?: boolean; is_outgo_default?: boolean }>
  hasGroups: boolean

  // Editing state
  editingAccountId: string | null
  createForGroupId: string | null
  setEditingAccountId: (id: string | null) => void
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
  onDragOverGroup: (e: DragEvent, groupId: string) => void
  onDropOnGroup: (e: DragEvent, groupId: string) => void
  onDragLeave: () => void
  onDragLeaveGroup: () => void
  onDragEnd: () => void

  // CRUD handlers
  onCreateAccount: (data: AccountFormData, groupId: string | null) => void
  onUpdateAccount: (accountId: string, data: AccountFormData) => void
  onDeleteAccount: (accountId: string) => void
  onMoveAccount: (accountId: string, direction: 'up' | 'down') => void
}

export function UngroupedAccountsSection({
  accounts,
  allGroups,
  allAccounts,
  hasGroups,
  editingAccountId,
  createForGroupId,
  setEditingAccountId,
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
  onDropOnGroup,
  onDragLeave,
  onDragLeaveGroup,
  onDragEnd,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onMoveAccount,
}: UngroupedAccountsSectionProps) {
  const sortedAccounts = [...accounts].sort((a, b) => a.sort_order - b.sort_order)

  const isAccountMovingHere = dragType === 'account' && dragOverGroupId === 'ungrouped'
  const draggedAccount = draggedId && dragType === 'account' ? allAccounts[draggedId] : null
  const isMovingFromGroup = draggedAccount && Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] &&
    (Object.entries(allAccounts).find(([id]) => id === draggedId)?.[1] as { account_group_id?: string | null })?.account_group_id !== null

  // Don't render if empty, no create form, groups exist, and not dragging an account
  if (sortedAccounts.length === 0 && !createForGroupId && hasGroups && dragType !== 'account') {
    return null
  }

  const ungroupedTotal = sortedAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <div
      onDragOver={(e) => onDragOverGroup(e, 'ungrouped')}
      onDragLeave={onDragLeaveGroup}
      onDrop={(e) => onDropOnGroup(e, 'ungrouped')}
      style={{
        background: (isAccountMovingHere && isMovingFromGroup)
          ? `color-mix(in srgb, ${colors.primary} 10%, transparent)`
          : 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '12px',
        padding: '1rem',
        border: (isAccountMovingHere && isMovingFromGroup)
          ? `2px dashed ${colors.primary}`
          : '2px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
      }}>
        <h3 style={{ ...sectionHeader, margin: 0, opacity: 0.7, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ borderBottom: '2px solid currentColor', paddingBottom: '2px' }}>Ungrouped</span>
          <span style={{ marginLeft: '0.5rem', opacity: 0.5, fontWeight: 400, fontSize: '0.9rem' }}>
            ({sortedAccounts.length})
          </span>
          {featureFlags.showGroupTotals && sortedAccounts.length > 0 && (
            <span style={{
              marginLeft: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: getBalanceColor(ungroupedTotal),
              borderBottom: '2px solid currentColor',
              paddingBottom: '2px',
            }}>
              {formatSignedCurrency(ungroupedTotal)}
            </span>
          )}
        </h3>
        <Button variant="small" actionName="Open Add Account Form (Ungrouped)" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
          + Account
        </Button>
      </div>

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
              currentGroupId={null}
              hasExistingIncomeDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
              hasExistingOutgoDefault={Object.entries(allAccounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
            />
          ) : (
            <DraggableCard
              key={account.id}
              isDragging={dragType === 'account' && draggedId === account.id}
              isDragOver={dragOverId === account.id}
              onDragStart={(e) => onAccountDragStart(e, account.id)}
              onDragOver={(e) => onAccountDragOver(e, account.id, 'ungrouped')}
              onDragLeave={onDragLeave}
              onDragEnd={onDragEnd}
              onDrop={(e) => onAccountDrop(e, account.id, 'ungrouped')}
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
                </p>
              </div>
            </DraggableCard>
          )
        ))}

        {sortedAccounts.length === 0 && dragType === 'account' && (
          <p style={{ opacity: 0.5, fontSize: '0.9rem', margin: '0.5rem 0', textAlign: 'center' }}>
            Drop here to ungroup
          </p>
        )}

        {dragType === 'account' && sortedAccounts.length > 0 && (
          <AccountEndDropZone
            groupId="ungrouped"
            isActive={dragOverId === '__end__ungrouped'}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverId('__end__ungrouped')
              setDragOverGroupId('ungrouped')
            }}
            onDragLeave={(e) => {
              e.stopPropagation()
              setDragOverId(null)
            }}
            onDrop={(e) => {
              e.stopPropagation()
              onAccountDrop(e, '__group_end__', 'ungrouped')
            }}
          />
        )}

        {createForGroupId === 'ungrouped' && (
          <AccountForm
            initialData={{ nickname: '', account_group_id: null }}
            onSubmit={(data) => onCreateAccount(data, 'ungrouped')}
            onCancel={() => setCreateForGroupId(null)}
            submitLabel="Create"
            accountGroups={allGroups}
            showIncomeSettings={true}
            currentGroupId={null}
          />
        )}
      </div>

      {createForGroupId !== 'ungrouped' && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid color-mix(in srgb, currentColor 10%, transparent)' }}>
          <Button variant="small" actionName="Open Add Account Form (Ungrouped)" onClick={() => setCreateForGroupId('ungrouped')} disabled={createForGroupId !== null}>
            + Add Account
          </Button>
        </div>
      )}
    </div>
  )
}

