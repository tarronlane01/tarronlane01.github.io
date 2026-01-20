import { useState, type FormEvent } from 'react'
import {
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  Button,
  Checkbox,
} from '../../ui'
import { colors } from '@styles/shared'
import type { AccountGroup } from '@types'
import { UNGROUPED_ACCOUNT_GROUP_ID } from '@constants'

// Type for account group with its ID (for passing to child components)
export type GroupWithId = AccountGroup & { id: string }

export interface AccountFormData {
  nickname: string
  account_group_id: string | null
  is_income_account?: boolean
  is_income_default?: boolean
  is_outgo_account?: boolean
  is_outgo_default?: boolean
  on_budget?: boolean
  is_active?: boolean
  is_hidden?: boolean
}

interface AccountFormProps {
  initialData?: AccountFormData
  onSubmit: (data: AccountFormData) => void
  onCancel: () => void
  submitLabel: string
  accountGroups: GroupWithId[]
  showGroupSelector?: boolean
  showIncomeSettings?: boolean
  hasExistingIncomeDefault?: boolean
  hasExistingOutgoDefault?: boolean
  currentGroupId?: string | null // For checking group-level overrides
  onDelete?: () => void // Optional delete handler
}

export function AccountForm({ initialData, onSubmit, onCancel, submitLabel, accountGroups, showGroupSelector = false, showIncomeSettings = false, hasExistingIncomeDefault = false, hasExistingOutgoDefault = false, currentGroupId, onDelete }: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>(initialData || {
    nickname: '',
    account_group_id: null,
    is_income_account: false,
    is_income_default: false,
    is_outgo_account: false,
    is_outgo_default: false,
    on_budget: true,
    is_active: true,
    is_hidden: false,
  })

  // Find the current group to check for overrides
  const effectiveGroupId = formData.account_group_id || currentGroupId
  const currentGroup = effectiveGroupId ? accountGroups.find(g => g.id === effectiveGroupId) : null
  const groupOverridesActive = Boolean(currentGroup && currentGroup.is_active !== null)
  const groupOverridesBudget = Boolean(currentGroup && currentGroup.on_budget !== null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.nickname.trim()) return
    onSubmit(formData)
  }

  // If unchecking income account, also uncheck income default
  function handleIncomeAccountChange(checked: boolean) {
    setFormData({
      ...formData,
      is_income_account: checked,
      is_income_default: checked ? formData.is_income_default : false,
    })
  }

  function handleOutgoAccountChange(checked: boolean) {
    setFormData({
      ...formData,
      is_outgo_account: checked,
      is_outgo_default: checked ? formData.is_outgo_default : false,
    })
  }

  return (
    <FormWrapper actionName={submitLabel === 'Create Account' ? 'Create Account' : 'Update Account'} onSubmit={handleSubmit}>
      <FormField label="Account Nickname" htmlFor="account-nickname">
        <TextInput
          id="account-nickname"
          type="text"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          placeholder="e.g., Main Checking, Savings"
          required
          autoFocus
        />
      </FormField>
      {showGroupSelector && (
        <FormField label="Account Type" htmlFor="account-group">
          <SelectInput
            id="account-group"
            value={formData.account_group_id || UNGROUPED_ACCOUNT_GROUP_ID}
            onChange={(e) => setFormData({
              ...formData,
              account_group_id: e.target.value === UNGROUPED_ACCOUNT_GROUP_ID ? null : e.target.value
            })}
          >
            <option value={UNGROUPED_ACCOUNT_GROUP_ID}>Ungrouped</option>
            {accountGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </SelectInput>
        </FormField>
      )}
      {showIncomeSettings && (
        <div style={{
          padding: '0.75rem',
          background: 'color-mix(in srgb, currentColor 5%, transparent)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {/* Account Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Account Status</p>

            {/* Active checkbox - disabled if group overrides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Checkbox
                id="is-active"
                checked={(() => {
                  if (groupOverridesActive && currentGroup) {
                    const value = currentGroup.is_active
                    return value === null ? false : (value === undefined ? false : value)
                  }
                  return formData.is_active ?? true
                })()}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                disabled={groupOverridesActive}
              >
                <span style={{ opacity: groupOverridesActive ? 0.5 : 1 }}>Active account</span>
              </Checkbox>
              {groupOverridesActive && currentGroup && (
                <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.6, marginLeft: '2rem', color: colors.warning }}>
                  Set by account type "{currentGroup.name}"
                </p>
              )}
            </div>

            {/* On-budget checkbox - disabled if group overrides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Checkbox
                id="on-budget"
                checked={(() => {
                  if (groupOverridesBudget && currentGroup) {
                    const value = currentGroup.on_budget
                    return value === null ? false : (value === undefined ? false : value)
                  }
                  return formData.on_budget ?? true
                })()}
                onChange={(e) => setFormData({ ...formData, on_budget: e.target.checked })}
                disabled={groupOverridesBudget}
              >
                <span style={{ opacity: groupOverridesBudget ? 0.5 : 1 }}>On budget (affects budget totals)</span>
              </Checkbox>
              {groupOverridesBudget && currentGroup && (
                <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.6, marginLeft: '2rem', color: colors.warning }}>
                  Set by account type "{currentGroup.name}"
                </p>
              )}
            </div>

            {/* Hidden checkbox */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Checkbox
                id="is-hidden"
                checked={formData.is_hidden || false}
                onChange={(e) => setFormData({ ...formData, is_hidden: e.target.checked })}
              >
                Hidden account
              </Checkbox>
              <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.6, marginLeft: '2rem' }}>
                Hidden accounts don't appear in dropdowns or balance displays. Use for historical accounts that aren't actively used.
              </p>
            </div>
          </div>

          {/* Income Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Income Settings</p>
            <Checkbox
              id="is-income-account"
              checked={formData.is_income_account || false}
              onChange={(e) => handleIncomeAccountChange(e.target.checked)}
            >
              Show in income deposit list
            </Checkbox>
            {formData.is_income_account && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: '2rem' }}>
                <Checkbox
                  id="is-income-default"
                  checked={formData.is_income_default || false}
                  onChange={(e) => setFormData({ ...formData, is_income_default: e.target.checked })}
                  disabled={hasExistingIncomeDefault && !initialData?.is_income_default}
                >
                  Default account for new income
                </Checkbox>
                {hasExistingIncomeDefault && !initialData?.is_income_default && (
                  <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>
                    Another account is already set as default
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Expense Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>Expense Settings</p>
            <Checkbox
              id="is-outgo-account"
              checked={formData.is_outgo_account || false}
              onChange={(e) => handleOutgoAccountChange(e.target.checked)}
            >
              Show in expense account list
            </Checkbox>
            {formData.is_outgo_account && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: '2rem' }}>
                <Checkbox
                  id="is-outgo-default"
                  checked={formData.is_outgo_default || false}
                  onChange={(e) => setFormData({ ...formData, is_outgo_default: e.target.checked })}
                  disabled={hasExistingOutgoDefault && !initialData?.is_outgo_default}
                >
                  Default account for new expenses
                </Checkbox>
                {hasExistingOutgoDefault && !initialData?.is_outgo_default && (
                  <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>
                    Another account is already set as default
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <FormButtonGroup>
        <Button type="submit" actionName={submitLabel}>{submitLabel}</Button>
        <Button type="button" variant="secondary" actionName="Cancel Account Form" onClick={onCancel}>Cancel</Button>
        {onDelete && (
          <Button
            type="button"
            variant="secondary"
            actionName="Delete Account"
            onClick={(e) => {
              e.preventDefault()
              onDelete()
            }}
            style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }}
          >
            🗑️ Delete
          </Button>
        )}
      </FormButtonGroup>
    </FormWrapper>
  )
}

