/**
 * Settings Hidden Accounts Component
 *
 * Displays hidden accounts in a collapsible section on the Accounts settings page.
 */

import { CollapsibleSection, formatSignedCurrency, getBalanceColor } from '@components/ui'
import { AccountForm, type AccountFormData } from './AccountForm'
import type { AccountWithId, GroupWithId } from '@hooks/useAccountsPage'
import type { AccountsMap } from '@types'

interface SettingsHiddenAccountsProps {
  hiddenAccounts: AccountWithId[]
  accounts: AccountsMap
  sortedGroups: GroupWithId[]
  editingAccountId: string | null
  setEditingAccountId: (id: string | null) => void
  onUpdateAccount: (id: string, data: AccountFormData) => void
}

export function SettingsHiddenAccounts({
  hiddenAccounts,
  accounts,
  sortedGroups,
  editingAccountId,
  setEditingAccountId,
  onUpdateAccount,
}: SettingsHiddenAccountsProps) {
  if (hiddenAccounts.length === 0) return null

  return (
    <div style={{ marginBottom: '2rem' }}>
      <CollapsibleSection title="Hidden Accounts" count={hiddenAccounts.length}>
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          fontSize: '0.85rem',
        }}>
          <p style={{ margin: '0 0 0.5rem 0', opacity: 0.8 }}>
            <strong>🙈 Hidden accounts</strong> are excluded from dropdowns and balance displays.
            They're useful for historical accounts (like closed bank accounts or old 401Ks) that you want to keep for record-keeping but don't need in everyday use.
          </p>
          <p style={{ margin: 0, opacity: 0.6 }}>
            To unhide an account, click it to edit and uncheck "Hidden account".
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {hiddenAccounts.map(account => (
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
                  is_hidden: account.is_hidden,
                }}
                onSubmit={(data) => { onUpdateAccount(account.id, data); setEditingAccountId(null) }}
                onCancel={() => setEditingAccountId(null)}
                submitLabel="Save"
                accountGroups={sortedGroups}
                showGroupSelector={true}
                showIncomeSettings={true}
                currentGroupId={account.account_group_id}
                hasExistingIncomeDefault={Object.entries(accounts).some(([accId, a]) => a.is_income_default && accId !== account.id)}
                hasExistingOutgoDefault={Object.entries(accounts).some(([accId, a]) => a.is_outgo_default && accId !== account.id)}
              />
            ) : (
              <div
                key={account.id}
                onClick={() => setEditingAccountId(account.id)}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'color-mix(in srgb, currentColor 3%, transparent)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: 0.7,
                }}
              >
                <span>{account.nickname}</span>
                <span style={{ color: getBalanceColor(account.balance), fontWeight: 500 }}>
                  {formatSignedCurrency(account.balance)}
                </span>
              </div>
            )
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}
