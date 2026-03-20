/**
 * SettingsAccountTableRow - Table row component for account settings
 *
 * Displays an account in a table row format using display: contents
 * to work within CSS Grid layout, similar to month balance pages.
 */

import type { AccountWithId, GroupWithId } from '@hooks/useAccountsPage'
import type { AccountFormData } from './AccountForm'
import type { AccountsMap } from '@types'
import { formatSignedCurrency, getBalanceColor } from '../../ui'
import { AccountFlags } from './AccountFlags'
import { AccountGroupBadge } from './AccountGroupBadge'
import { AccountForm } from './AccountForm'
import { InlineBalanceEdit, MobileEditableBalance } from './InlineBalanceEdit'
import { logUserAction } from '@utils'
import { MONTH_NAMES_SHORT } from '@constants'
import type { AccountClearedBalance } from '@calculations'

interface SettingsAccountTableRowProps {
  account: AccountWithId
  accountIndex: number
  totalAccounts: number
  allGroups: GroupWithId[]
  allAccounts: AccountsMap
  clearedBalance?: AccountClearedBalance
  groupName: string
  groupColor: string
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
  isOffBudget?: boolean
  onSetOffBudgetBalance?: (accountId: string, targetBalance: number) => void
  offBudgetBalanceMonth?: string
}

/** Format YYYYMM string as "Mar 2026" */
function formatLastSet(yyyymm: string): string {
  const year = yyyymm.slice(0, 4)
  const monthIdx = parseInt(yyyymm.slice(4), 10) - 1
  if (monthIdx < 0 || monthIdx > 11) return yyyymm
  return `${MONTH_NAMES_SHORT[monthIdx]} ${year}`
}

export function SettingsAccountTableRow({
  account,
  accountIndex,
  allGroups,
  allAccounts,
  clearedBalance,
  groupName,
  groupColor,
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
  isOffBudget,
  onSetOffBudgetBalance,
  offBudgetBalanceMonth,
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

  const currentBalance = clearedBalance?.uncleared_balance ?? account.balance
  const lastSetLabel = offBudgetBalanceMonth ? `Set: ${formatLastSet(offBudgetBalanceMonth)}` : 'Never set'

  // Mobile: render card-style row
  if (isMobile) {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          padding: '0.75rem',
          marginBottom: '0.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>{account.nickname}</span>
              <AccountGroupBadge groupName={groupName} colorKey={groupColor} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              {clearedBalance ? (
                <>
                  {isOffBudget ? (
                    <MobileEditableBalance
                      value={clearedBalance.uncleared_balance}
                      lastSetLabel={lastSetLabel}
                      onSubmit={onSetOffBudgetBalance ? (v) => onSetOffBudgetBalance(account.id, v) : undefined}
                    />
                  ) : (
                    <>
                      <MobileBalanceColumn label="Total" value={clearedBalance.uncleared_balance} bold />
                      {Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) >= 0.01 ? (
                        <>
                          <MobileBalanceColumn label="Cleared" value={clearedBalance.cleared_balance} />
                          <MobileBalanceColumn label="Uncleared" value={clearedBalance.uncleared_balance - clearedBalance.cleared_balance} />
                        </>
                      ) : (
                        <>
                          <MobileBalanceColumn label="Cleared" />
                          <MobileBalanceColumn label="Uncleared" />
                        </>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ color: getBalanceColor(account.balance), fontWeight: 600 }}>
                    {formatSignedCurrency(account.balance)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <AccountFlags account={account} accountGroups={allGroups} />
          </div>
          <MobileActions
            accountId={account.id}
            nickname={account.nickname}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onEdit={onEdit}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        </div>
      </div>
    )
  }

  // Desktop: Grid row using wrapper div for consistent striping
  const isEvenRow = accountIndex % 2 === 0
  const rowBg = isEvenRow ? 'transparent' : 'var(--row-alt-bg)'
  const cellStyle: React.CSSProperties = {
    padding: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.9rem',
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: rowBg,
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.5fr 1fr',
    }}>
      {/* Account name */}
      <div style={{ ...cellStyle, fontWeight: 500, overflow: 'hidden', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-subtle)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.nickname}</span>
      </div>

      {/* Group badge */}
      <div style={{ ...cellStyle }}>
        <AccountGroupBadge groupName={groupName} colorKey={groupColor} />
      </div>

      {/* Total balance — editable for off-budget */}
      {isOffBudget && onSetOffBudgetBalance ? (
        <InlineBalanceEdit
          currentBalance={currentBalance}
          cellStyle={cellStyle}
          onSubmit={(v) => onSetOffBudgetBalance(account.id, v)}
        />
      ) : clearedBalance ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(clearedBalance.uncleared_balance), fontWeight: 600 }}>
          {formatSignedCurrency(clearedBalance.uncleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(account.balance), fontWeight: 600 }}>
          {formatSignedCurrency(account.balance)}
        </div>
      )}
      {/* Cleared column — "Last set" for off-budget, else cleared balance */}
      {isOffBudget ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.5, fontSize: '0.8rem' }}>
          {lastSetLabel}
        </div>
      ) : clearedBalance ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(clearedBalance.cleared_balance) }}>
          {Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) < 0.01
            ? <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
            : formatSignedCurrency(clearedBalance.cleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(account.balance), fontWeight: 600 }}>
          {formatSignedCurrency(account.balance)}
        </div>
      )}
      {/* Uncleared portion - dash if off-budget or same as cleared */}
      {isOffBudget ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.3, color: 'var(--text-muted)' }}>—</div>
      ) : clearedBalance && Math.abs(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) >= 0.01 ? (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', color: getBalanceColor(clearedBalance.uncleared_balance - clearedBalance.cleared_balance) }}>
          {formatSignedCurrency(clearedBalance.uncleared_balance - clearedBalance.cleared_balance)}
        </div>
      ) : (
        <div style={{ ...cellStyle, justifyContent: 'flex-end', opacity: 0.3, color: 'var(--text-muted)' }}>
          —
        </div>
      )}

      {/* Flags */}
      <div style={{ ...cellStyle, gap: '0.25rem', flexWrap: 'wrap' }}>
        <AccountFlags account={account} accountGroups={allGroups} />
      </div>

      {/* Actions */}
      <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '0.25rem' }}>
        <ActionButton icon="✏️" title="Edit" onClick={() => { logUserAction('CLICK', 'Edit Account', { details: account.nickname }); onEdit(account.id) }} />
        <ActionButton icon="▲" title="Move up" onClick={onMoveUp} disabled={!canMoveUp} />
        <ActionButton icon="▼" title="Move down" onClick={onMoveDown} disabled={!canMoveDown} />
      </div>
    </div>
  )
}

function ActionButton({ icon, title, onClick, disabled }: { icon: string; title: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.2 : 0.6,
        fontSize: '0.9rem',
        padding: '0.25rem',
      }}
      title={title}
    >
      {icon}
    </button>
  )
}

function MobileBalanceColumn({ label, value, bold }: { label: string; value?: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>{label}</span>
      {value !== undefined ? (
        <span style={{ color: getBalanceColor(value), fontWeight: bold ? 600 : 400 }}>
          {formatSignedCurrency(value)}
        </span>
      ) : (
        <span style={{ opacity: 0.3, color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  )
}

function MobileActions({ accountId, nickname, canMoveUp, canMoveDown, onEdit, onMoveUp, onMoveDown }: {
  accountId: string; nickname: string; canMoveUp: boolean; canMoveDown: boolean
  onEdit: (id: string) => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
      <ActionButton icon="✏️" title="Edit" onClick={() => { logUserAction('CLICK', 'Edit Account', { details: nickname }); onEdit(accountId) }} />
      <ActionButton icon="▲" title="Move up" onClick={onMoveUp} disabled={!canMoveUp} />
      <ActionButton icon="▼" title="Move down" onClick={onMoveDown} disabled={!canMoveDown} />
    </div>
  )
}
