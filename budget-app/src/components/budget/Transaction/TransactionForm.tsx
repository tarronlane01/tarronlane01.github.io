import { useState, type FormEvent, type ReactNode } from 'react'
import type { FinancialAccount, AccountGroupsMap, CategoriesMap, CategoryGroup } from '@types'
import {
  FormWrapper,
  FormField,
  TextInput,
  DateInput,
  SelectInput,
  FormButtonGroup,
  Button,
  CurrencyInput,
  PayeeAutocomplete,
  CategoryAutocomplete,
  Checkbox,
} from '../../ui'
import { useScreenWidth } from '../../../hooks'
import { colors } from '../../../styles/shared'

export type AccountEntry = [string, FinancialAccount]

export interface TransactionFieldConfig {
  showCategory?: boolean
  showCleared?: boolean
  accountLabel?: string
  payeePlaceholder?: string
  descriptionPlaceholder?: string
  submitLabel: string
}

export interface TransactionInitialData {
  date?: string
  payee?: string
  categoryId?: string
  accountId?: string
  amount?: number
  description?: string
  cleared?: boolean
}

export interface TransactionFormData {
  date: string
  payee?: string
  categoryId?: string
  accountId: string
  amount: number
  description?: string
  cleared?: boolean
}

interface TransactionFormProps {
  accounts: AccountEntry[]
  accountGroups: AccountGroupsMap
  categories?: CategoriesMap
  categoryGroups?: CategoryGroup[]
  payees: string[]
  initialData?: TransactionInitialData
  defaultAccountId?: string
  defaultDate?: string
  config: TransactionFieldConfig
  onSubmit: (data: TransactionFormData) => void
  onCancel: () => void
  onDelete?: () => void
  extraContent?: ReactNode
}

// Inline button styles
const submitBtnStyle = {
  background: colors.primary,
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '4px',
  color: 'white',
}
const cancelBtnStyle = {
  background: 'transparent',
  border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '4px',
}
const deleteBtnStyle = {
  background: 'transparent',
  border: `1px solid ${colors.errorBorder}`,
  color: colors.error,
  cursor: 'pointer',
  fontSize: '0.9rem',
  padding: '0.35rem 0.5rem',
  borderRadius: '4px',
}

export function TransactionForm({
  accounts, accountGroups, categories, categoryGroups, payees,
  initialData, defaultAccountId, defaultDate, config,
  onSubmit, onCancel, onDelete, extraContent,
}: TransactionFormProps) {
  const { isMedium, isMobile } = useScreenWidth()
  const {
    showCategory = false, showCleared = false,
    accountLabel = 'Account', payeePlaceholder = 'Payee name',
    descriptionPlaceholder = 'Optional note', submitLabel,
  } = config

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || '')
  const [accountId, setAccountId] = useState(initialData?.accountId || defaultAccountId || (accounts[0] ? accounts[0][0] : ''))
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [cleared, setCleared] = useState(initialData?.cleared || false)

  // Group accounts
  const accountsByGroup: Record<string, AccountEntry[]> = {}
  const ungroupedAccounts: AccountEntry[] = []
  accounts.forEach(([accId, account]) => {
    if (account.account_group_id) {
      if (!accountsByGroup[account.account_group_id]) accountsByGroup[account.account_group_id] = []
      accountsByGroup[account.account_group_id].push([accId, account])
    } else {
      ungroupedAccounts.push([accId, account])
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (showCategory && !categoryId) return
    if (!accountId || !date) return
    onSubmit({
      date, payee: payee.trim() || undefined,
      categoryId: showCategory ? categoryId : undefined,
      accountId, amount: parsedAmount,
      description: description.trim() || undefined,
      cleared: showCleared ? cleared : undefined,
    })
  }

  const accountSelect = (
    <SelectInput id="txn-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
      {Object.entries(accountGroups).map(([groupId, group]) => {
        const grpAccounts = accountsByGroup[groupId]
        if (!grpAccounts?.length) return null
        return (
          <optgroup key={groupId} label={group.name}>
            {grpAccounts.map(([accId, acc]) => <option key={accId} value={accId}>{acc.nickname}</option>)}
          </optgroup>
        )
      })}
      {ungroupedAccounts.length > 0 && (
        <optgroup label="Other">
          {ungroupedAccounts.map(([accId, acc]) => <option key={accId} value={accId}>{acc.nickname}</option>)}
        </optgroup>
      )}
    </SelectInput>
  )

  const categoryField = showCategory && categories && categoryGroups ? (
    <FormField label="Category" htmlFor="txn-category">
      <CategoryAutocomplete id="txn-category" value={categoryId} onChange={setCategoryId} categories={categories} categoryGroups={categoryGroups} placeholder="Search..." required />
    </FormField>
  ) : null

  const clearedCheckbox = showCleared ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingBottom: '0.35rem' }}>
      <label htmlFor="txn-cleared" style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>Clr</label>
      <Checkbox id="txn-cleared" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
    </div>
  ) : null

  const inlineActionButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingBottom: '0.1rem' }}>
      <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>&nbsp;</span>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button type="submit" title={submitLabel} style={submitBtnStyle}>✓</button>
        <button type="button" onClick={onCancel} title="Cancel" style={cancelBtnStyle}>✕</button>
        {onDelete && <button type="button" onClick={onDelete} title="Delete" style={deleteBtnStyle}>🗑</button>}
      </div>
    </div>
  )

  const mobileButtonGroup = (
    <FormButtonGroup>
      <Button type="submit">{submitLabel}</Button>
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      {onDelete && <Button type="button" variant="danger" onClick={onDelete}>🗑️ Delete</Button>}
    </FormButtonGroup>
  )

  // Mobile layout
  if (isMobile) {
    return (
      <FormWrapper onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Date" htmlFor="txn-date">
              <DateInput id="txn-date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </FormField>
            <FormField label="Amount" htmlFor="txn-amount">
              <CurrencyInput id="txn-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
            </FormField>
          </div>
          <FormField label="Payee" htmlFor="txn-payee">
            <PayeeAutocomplete id="txn-payee" value={payee} onChange={setPayee} payees={payees} placeholder={payeePlaceholder} />
          </FormField>
          {categoryField}
          <FormField label={accountLabel} htmlFor="txn-account">{accountSelect}</FormField>
          <FormField label="Description (optional)" htmlFor="txn-description">
            <TextInput id="txn-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={descriptionPlaceholder} />
          </FormField>
          {showCleared && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox id="txn-cleared-mobile" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
              <label htmlFor="txn-cleared-mobile" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Cleared (appeared in bank account)</label>
            </div>
          )}
          {extraContent}
        </div>
        {mobileButtonGroup}
      </FormWrapper>
    )
  }

  const hasCategory = showCategory && categories && categoryGroups
  const inputStyle = { fontSize: '0.85rem', padding: '0.5rem' }

  // Medium layout (two rows) - use same grid for both rows to align columns
  if (isMedium) {
    // With category: 4 columns (Date | Payee | Category | Account)
    // Without category: 3 columns (Date | Payee | Account)
    const mediumCols = hasCategory ? '6rem 1fr 1fr 1fr' : '6rem 1fr 1fr'
    const descriptionSpan = hasCategory ? 2 : 1 // Description spans Category + Account columns (minus Clr/buttons)

    return (
      <FormWrapper onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: mediumCols, gap: '0.75rem', alignItems: 'end' }}>
          <FormField label="Date" htmlFor="txn-date">
            <DateInput id="txn-date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
          </FormField>
          <FormField label="Payee" htmlFor="txn-payee">
            <PayeeAutocomplete id="txn-payee" value={payee} onChange={setPayee} payees={payees} placeholder={payeePlaceholder} />
          </FormField>
          {categoryField}
          <FormField label={accountLabel} htmlFor="txn-account">{accountSelect}</FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mediumCols, gap: '0.75rem', alignItems: 'end', marginTop: '0.75rem' }}>
          <FormField label="Amount" htmlFor="txn-amount">
            <CurrencyInput id="txn-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
          </FormField>
          <FormField label="Description" htmlFor="txn-description" style={{ gridColumn: `span ${descriptionSpan}` }}>
            <TextInput id="txn-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={descriptionPlaceholder} style={inputStyle} />
          </FormField>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', justifyContent: 'flex-end' }}>
            {clearedCheckbox}
            {inlineActionButtons}
          </div>
        </div>
        {extraContent}
      </FormWrapper>
    )
  }

  // Wide layout (single row)
  const wideGridCols = hasCategory
    ? (showCleared ? '6rem 1fr 1fr 1fr 6rem 1fr auto auto' : '6rem 1fr 1fr 1fr 6rem 1fr auto')
    : (showCleared ? '6rem 1fr 1fr 6rem 1fr auto auto' : '6rem 1fr 1fr 6rem 1fr auto')

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: wideGridCols, gap: '0.75rem', alignItems: 'end' }}>
        <FormField label="Date" htmlFor="txn-date">
          <DateInput id="txn-date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
        </FormField>
        <FormField label="Payee" htmlFor="txn-payee">
          <PayeeAutocomplete id="txn-payee" value={payee} onChange={setPayee} payees={payees} placeholder={payeePlaceholder} />
        </FormField>
        {categoryField}
        <FormField label={accountLabel} htmlFor="txn-account">{accountSelect}</FormField>
        <FormField label="Amount" htmlFor="txn-amount">
          <CurrencyInput id="txn-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
        </FormField>
        <FormField label="Description" htmlFor="txn-description">
          <TextInput id="txn-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={descriptionPlaceholder} style={inputStyle} />
        </FormField>
        {clearedCheckbox}
        {inlineActionButtons}
      </div>
      {extraContent}
    </FormWrapper>
  )
}
