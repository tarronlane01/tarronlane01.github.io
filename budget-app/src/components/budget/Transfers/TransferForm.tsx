/**
 * TransferForm - Form for creating/editing transfer transactions
 *
 * Transfers move money between accounts and categories.
 * Both from and to sides are required.
 */

import { useState, type FormEvent } from 'react'
import type { TransferTransaction, FinancialAccount, AccountGroupsMap, CategoriesMap, CategoryGroup } from '@types'
import { NO_ACCOUNT_ID, NO_ACCOUNT_NAME, NO_CATEGORY_ID, NO_CATEGORY_NAME } from '@data/constants'
import {
  FormWrapper,
  FormField,
  TextInput,
  DateInput,
  FormButtonGroup,
  Button,
  CurrencyInput,
  CategoryAutocomplete,
  AccountAutocomplete,
  Checkbox,
} from '../../ui'
import { useScreenWidth } from '@hooks'
import { colors } from '@styles/shared'
import { logUserAction } from '@utils'

export type TransferAccountEntry = [string, FinancialAccount]

interface TransferFormProps {
  accounts: TransferAccountEntry[]
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
  initialData?: TransferTransaction
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (
    amount: number,
    fromAccountId: string,
    toAccountId: string,
    fromCategoryId: string,
    toCategoryId: string,
    date: string,
    description?: string,
    cleared?: boolean
  ) => void
  onCancel: () => void
  onDelete?: () => void
  submitLabel: string
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

export function TransferForm({
  accounts,
  accountGroups,
  categories,
  categoryGroups,
  initialData,
  defaultDate,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
}: TransferFormProps) {
  const { isWide } = useScreenWidth()

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [fromAccountId, setFromAccountId] = useState(initialData?.from_account_id || NO_ACCOUNT_ID)
  const [toAccountId, setToAccountId] = useState(initialData?.to_account_id || NO_ACCOUNT_ID)
  const [fromCategoryId, setFromCategoryId] = useState(initialData?.from_category_id || NO_CATEGORY_ID)
  const [toCategoryId, setToCategoryId] = useState(initialData?.to_category_id || NO_CATEGORY_ID)
  const [description, setDescription] = useState(initialData?.description || '')
  const [cleared, setCleared] = useState(initialData?.cleared || false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Check transfer validity
  const isFromCategoryNo = fromCategoryId === NO_CATEGORY_ID
  const isToCategoryNo = toCategoryId === NO_CATEGORY_ID
  const isFromAccountNo = fromAccountId === NO_ACCOUNT_ID
  const isToAccountNo = toAccountId === NO_ACCOUNT_ID

  // Validation rules:
  // 1. If one account is "No Account", the other must also be "No Account" (can't transfer from real account to nothing)
  // 2. Same for categories
  // 3. All 4 cannot be "No" picks - something must actually move
  function getValidationError(): string | null {
    const bothCategoriesNo = isFromCategoryNo && isToCategoryNo
    const bothAccountsNo = isFromAccountNo && isToAccountNo

    // Rule 3: All 4 cannot be "No"
    if (bothCategoriesNo && bothAccountsNo) {
      return 'A transfer must move between real categories or real accounts — not all "No" options.'
    }

    // Rule 1: Accounts must match (both real or both "No")
    if (isFromAccountNo !== isToAccountNo) {
      return 'Both accounts must be real accounts, or both must be "No Account". Cannot transfer from a real account to nothing.'
    }

    // Rule 2: Categories must match (both real or both "No")
    if (isFromCategoryNo !== isToCategoryNo) {
      return 'Both categories must be real categories, or both must be "No Category". Cannot transfer from a real category to nothing.'
    }

    return null
  }

  const currentValidationError = getValidationError()

  // Clear warning when user fixes the issue
  if (currentValidationError === null && validationError !== null) {
    setValidationError(null)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!fromAccountId || !toAccountId || !fromCategoryId || !toCategoryId || !date) return

    // Validation check
    const error = getValidationError()
    if (error) {
      setValidationError(error)
      return
    }

    setValidationError(null)
    onSubmit(
      parsedAmount,
      fromAccountId,
      toAccountId,
      fromCategoryId,
      toCategoryId,
      date,
      description.trim() || undefined,
      cleared
    )
  }

  const validationWarning = validationError ? (
    <div style={{
      background: `color-mix(in srgb, ${colors.error} 15%, transparent)`,
      border: `1px solid ${colors.errorBorder}`,
      borderRadius: '6px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.85rem',
      color: colors.error,
      marginTop: '0.5rem',
    }}>
      {validationError}
    </div>
  ) : null

  const renderAccountSelect = (id: string, value: string, onChange: (id: string) => void, label: string) => (
    <FormField label={label} htmlFor={id}>
      <AccountAutocomplete
        id={id}
        value={value}
        onChange={onChange}
        accounts={accounts}
        accountGroups={accountGroups}
        placeholder={NO_ACCOUNT_NAME}
        required
        showNoAccountOption={true}
      />
    </FormField>
  )

  const renderCategorySelect = (id: string, value: string, onChange: (id: string) => void, label: string) => (
    <FormField label={label} htmlFor={id}>
      <CategoryAutocomplete
        id={id}
        value={value}
        onChange={onChange}
        categories={categories}
        categoryGroups={categoryGroups}
        placeholder={NO_CATEGORY_NAME}
        required
        showNoCategoryOption={true}
      />
    </FormField>
  )

  const clearedCheckbox = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingBottom: '0.35rem' }}>
      <label htmlFor="transfer-cleared" style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>Clr</label>
      <Checkbox id="transfer-cleared" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
    </div>
  )

  const inlineActionButtons = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', paddingBottom: '0.1rem' }}>
      <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 500 }}>&nbsp;</span>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button type="submit" title={submitLabel} style={submitBtnStyle}>✓</button>
        <button type="button" onClick={() => { logUserAction('CLICK', 'Cancel Transfer Form'); onCancel() }} title="Cancel" style={cancelBtnStyle}>✕</button>
        {onDelete && <button type="button" onClick={() => { logUserAction('CLICK', 'Delete Transfer'); onDelete() }} title="Delete" style={deleteBtnStyle}>🗑</button>}
      </div>
    </div>
  )

  const stackedButtonGroup = (
    <FormButtonGroup>
      <Button type="submit" actionName={submitLabel}>{submitLabel}</Button>
      <Button type="button" variant="secondary" actionName="Cancel Transfer Form" onClick={onCancel}>Cancel</Button>
      {onDelete && <Button type="button" variant="danger" actionName="Delete Transfer" onClick={onDelete}>🗑️ Delete</Button>}
    </FormButtonGroup>
  )

  const inputStyle = { fontSize: '0.85rem', padding: '0.5rem' }

  // Stacked layout (default) - one field per line, clean and predictable
  if (!isWide) {
    return (
      <FormWrapper actionName={submitLabel} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Date" htmlFor="transfer-date">
              <DateInput id="transfer-date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </FormField>
            <FormField label="Amount" htmlFor="transfer-amount">
              <CurrencyInput id="transfer-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
            </FormField>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'color-mix(in srgb, currentColor 5%, transparent)',
            padding: '1rem',
            borderRadius: '8px',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              {renderCategorySelect('from-category', fromCategoryId, setFromCategoryId, 'From Cat.')}
              {renderAccountSelect('from-account', fromAccountId, setFromAccountId, 'From Acct.')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', fontSize: '1.5rem', opacity: 0.5 }}>
              ↓
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              {renderCategorySelect('to-category', toCategoryId, setToCategoryId, 'To Cat.')}
              {renderAccountSelect('to-account', toAccountId, setToAccountId, 'To Acct.')}
            </div>
          </div>

          <FormField label="Description (optional)" htmlFor="transfer-description">
            <TextInput id="transfer-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Transfer to savings" />
          </FormField>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Checkbox id="transfer-cleared-stacked" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
            <label htmlFor="transfer-cleared-stacked" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Cleared (appeared in bank account)</label>
          </div>
          {validationWarning}
        </div>
        {stackedButtonGroup}
      </FormWrapper>
    )
  }

  // Wide layout (two rows) - From on top, To on bottom
  return (
    <FormWrapper actionName={submitLabel} onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Row 1: Date, Amount, From Category, From Account, Description */}
        <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 5.5rem 1fr 1fr 1.5fr', gap: '0.75rem', alignItems: 'end' }}>
          <FormField label="Date" htmlFor="transfer-date">
            <DateInput id="transfer-date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
          </FormField>
          <FormField label="Amount" htmlFor="transfer-amount">
            <CurrencyInput id="transfer-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
          </FormField>
          {renderCategorySelect('from-category', fromCategoryId, setFromCategoryId, 'From Category')}
          {renderAccountSelect('from-account', fromAccountId, setFromAccountId, 'From Account')}
          <FormField label="Description" htmlFor="transfer-description">
            <TextInput id="transfer-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Transfer" style={inputStyle} />
          </FormField>
        </div>
        {/* Row 2: Arrow indicator, To Category, To Account, Cleared, Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '5.5rem 5.5rem 1fr 1fr 1.5fr', gap: '0.75rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', opacity: 0.5, paddingBottom: '0.5rem' }}>↓</div>
          <div></div>
          {renderCategorySelect('to-category', toCategoryId, setToCategoryId, 'To Category')}
          {renderAccountSelect('to-account', toAccountId, setToAccountId, 'To Account')}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', paddingBottom: '0.25rem' }}>
            {clearedCheckbox}
            {inlineActionButtons}
          </div>
        </div>
        {validationWarning}
      </div>
    </FormWrapper>
  )
}

