import { useState, type FormEvent } from 'react'
import type { IncomeTransaction, FinancialAccount, AccountGroupsMap } from '../../../types/budget'
import {
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  Button,
  CurrencyInput,
  PayeeAutocomplete,
} from '../../ui'

export type IncomeAccountEntry = [string, FinancialAccount]

interface IncomeFormProps {
  accounts: IncomeAccountEntry[]
  accountGroups: AccountGroupsMap
  payees: string[]
  initialData?: IncomeTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, accountId: string, date: string, payee?: string, description?: string) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
  isMobile?: boolean
}

export function IncomeForm({ accounts, accountGroups, payees, initialData, defaultAccountId, defaultDate, onSubmit, onCancel, onDelete, submitLabel, isMobile }: IncomeFormProps) {
  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [accountId, setAccountId] = useState(initialData?.account_id || defaultAccountId || (accounts[0] ? accounts[0][0] : ''))
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Group accounts by their account group for the dropdown
  const accountsByGroup: Record<string, IncomeAccountEntry[]> = {}
  const ungroupedAccounts: IncomeAccountEntry[] = []

  accounts.forEach(([accId, account]) => {
    if (account.account_group_id) {
      if (!accountsByGroup[account.account_group_id]) {
        accountsByGroup[account.account_group_id] = []
      }
      accountsByGroup[account.account_group_id].push([accId, account])
    } else {
      ungroupedAccounts.push([accId, account])
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!accountId) return
    if (!date) return
    onSubmit(parsedAmount, accountId, date, payee.trim() || undefined, description.trim() || undefined)
  }

  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column' as const, gap: '1rem' }
    : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <div style={gridStyle}>
        <FormField label="Amount" htmlFor="income-amount">
          <CurrencyInput
            id="income-amount"
            value={amount}
            onChange={setAmount}
            placeholder="$0.00"
            required
            autoFocus
          />
        </FormField>
        <FormField label="Date" htmlFor="income-date">
          <TextInput
            id="income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormField>
      </div>
      <div style={gridStyle}>
        <FormField label="Deposit To" htmlFor="income-account">
          <SelectInput
            id="income-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {/* Render grouped accounts with optgroups */}
            {Object.entries(accountGroups).map(([groupId, group]) => {
              const groupAccounts = accountsByGroup[groupId]
              if (!groupAccounts || groupAccounts.length === 0) return null
              return (
                <optgroup key={groupId} label={group.name}>
                  {groupAccounts.map(([accId, account]) => (
                    <option key={accId} value={accId}>
                      {account.nickname}
                    </option>
                  ))}
                </optgroup>
              )
            })}
            {/* Ungrouped accounts */}
            {ungroupedAccounts.length > 0 && (
              <optgroup label="Other">
                {ungroupedAccounts.map(([accId, account]) => (
                  <option key={accId} value={accId}>
                    {account.nickname}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectInput>
        </FormField>
        <FormField label="Payee" htmlFor="income-payee">
          <PayeeAutocomplete
            id="income-payee"
            value={payee}
            onChange={setPayee}
            payees={payees}
            placeholder="e.g., Employer, Client name"
          />
        </FormField>
      </div>
      <FormField label="Description (optional)" htmlFor="income-description">
        <TextInput
          id="income-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., January paycheck, Project bonus"
        />
      </FormField>
      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        {onDelete && (
          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
            style={{ marginLeft: 'auto' }}
          >
            🗑️ Delete
          </Button>
        )}
      </FormButtonGroup>
    </FormWrapper>
  )
}

