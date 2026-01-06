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
  AccountAutocomplete,
  Checkbox,
} from '../../ui'
import { useScreenWidth } from '@hooks'
import { colors } from '@styles/shared'
import { logUserAction } from '@utils'
import { NO_ACCOUNT_ID, NO_ACCOUNT_NAME, NO_CATEGORY_ID, NO_CATEGORY_NAME } from '@data/constants'

export type AccountEntry = [string, FinancialAccount]

export interface TransactionFieldConfig {
  showCategory?: boolean
  showCleared?: boolean
  /** Show the special "No Category" option (for spend entries) */
  showNoCategoryOption?: boolean
  /** Show the special "No Account" option (for spend entries) */
  showNoAccountOption?: boolean
  /** Show toggle for switching between expense (negative) and refund (positive) */
  showSignToggle?: boolean
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
const btnBase = { cursor: 'pointer', fontSize: '0.9rem', padding: '0.35rem 0.5rem', borderRadius: '4px' }
const submitBtnStyle = { ...btnBase, background: colors.primary, border: 'none', color: 'white' }
const cancelBtnStyle = { ...btnBase, background: 'transparent', border: '1px solid color-mix(in srgb, currentColor 30%, transparent)' }
const deleteBtnStyle = { ...btnBase, background: 'transparent', border: `1px solid ${colors.errorBorder}`, color: colors.error }

// Sign toggle button styles
const signToggleStyle = (isNegative: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '100%', minHeight: '2.25rem', background: isNegative ? `color-mix(in srgb, ${colors.error} 15%, transparent)` : `color-mix(in srgb, ${colors.success} 15%, transparent)`, border: `1px solid ${isNegative ? colors.errorBorder : 'rgba(74, 222, 128, 0.4)'}`, borderRadius: '4px 0 0 4px', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, color: isNegative ? colors.error : colors.success, transition: 'all 0.15s ease', flexShrink: 0 })

export function TransactionForm({
  accounts, accountGroups, categories, categoryGroups, payees,
  initialData, defaultAccountId, defaultDate, config,
  onSubmit, onCancel, onDelete, extraContent,
}: TransactionFormProps) {
  const { isWide } = useScreenWidth()
  const {
    showCategory = false, showCleared = false, showSignToggle = false,
    accountLabel = 'Account', payeePlaceholder = 'Payee name',
    descriptionPlaceholder = 'Optional note', submitLabel,
  } = config

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  // Default to NO_CATEGORY_ID when showNoCategoryOption is enabled
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || (config.showNoCategoryOption ? NO_CATEGORY_ID : ''))
  // Default to NO_ACCOUNT_ID when showNoAccountOption is enabled, otherwise use defaultAccountId or first account
  const [accountId, setAccountId] = useState(initialData?.accountId || defaultAccountId || (config.showNoAccountOption ? NO_ACCOUNT_ID : (accounts[0] ? accounts[0][0] : '')))
  // For amount, store absolute value; sign is tracked separately when showSignToggle is enabled
  const initialAmount = initialData?.amount !== undefined ? Math.abs(initialData.amount) : undefined
  const [amount, setAmount] = useState(initialAmount?.toString() || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [cleared, setCleared] = useState(initialData?.cleared || false)
  // Sign state: true = negative (expense), false = positive (refund/credit)
  // Default to positive (adjustment adds to balance) unless editing an existing negative amount
  const [isNegative, setIsNegative] = useState(() => {
    if (!showSignToggle) return true
    if (initialData?.amount !== undefined) return initialData.amount < 0
    return false // Default to positive (adjustment)
  })
  // Track if user tried to submit with invalid "both no options" selection
  const [showBothNoWarning, setShowBothNoWarning] = useState(false)

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
    // Validation: Cannot have both No Category AND No Account selected
    const isNoCategorySelected = categoryId === NO_CATEGORY_ID
    const isNoAccount = accountId === NO_ACCOUNT_ID
    if (isNoCategorySelected && isNoAccount) {
      // Both cannot be "No" options - need at least one real category or account
      setShowBothNoWarning(true)
      return
    }
    setShowBothNoWarning(false)
    // Apply sign when sign toggle is enabled
    const finalAmount = showSignToggle && isNegative ? -parsedAmount : parsedAmount
    onSubmit({
      date, payee: payee.trim() || undefined,
      categoryId: showCategory ? categoryId : undefined,
      accountId, amount: finalAmount,
      description: description.trim() || undefined,
      cleared: showCleared ? cleared : undefined,
    })
  }

  // Check if both No Category and No Account are selected (invalid state)
  const isNoCategorySelected = categoryId === NO_CATEGORY_ID
  const isNoAccountSelected = accountId === NO_ACCOUNT_ID
  const isBothNoOptions = isNoCategorySelected && isNoAccountSelected

  // Clear warning when user changes selection (derived from state changes)
  if (!isBothNoOptions && showBothNoWarning) {
    setShowBothNoWarning(false)
  }

  const accountSelect = config.showNoAccountOption ? (
    <AccountAutocomplete
      id="txn-account"
      value={accountId}
      onChange={setAccountId}
      accounts={accounts}
      accountGroups={accountGroups}
      placeholder={NO_ACCOUNT_NAME}
      required
      showNoAccountOption={true}
    />
  ) : (
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
      <CategoryAutocomplete
        id="txn-category"
        value={categoryId}
        onChange={setCategoryId}
        categories={categories}
        categoryGroups={categoryGroups}
        placeholder={config.showNoCategoryOption ? NO_CATEGORY_NAME : 'Search...'}
        required
        showNoCategoryOption={config.showNoCategoryOption}
      />
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
        <button type="button" onClick={() => { logUserAction('CLICK', 'Cancel Transaction Form'); onCancel() }} title="Cancel" style={cancelBtnStyle}>✕</button>
        {onDelete && <button type="button" onClick={() => { logUserAction('CLICK', 'Delete Transaction'); onDelete() }} title="Delete" style={deleteBtnStyle}>🗑</button>}
      </div>
    </div>
  )

  const validationWarning = showBothNoWarning ? (
    <div style={{ background: `color-mix(in srgb, ${colors.error} 15%, transparent)`, border: `1px solid ${colors.errorBorder}`, borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: colors.error }}>
      Cannot select both "No Category" and "No Account" — at least one must be a real category or account.
    </div>
  ) : null

  const stackedButtonGroup = (
    <FormButtonGroup>
      <Button type="submit" actionName={submitLabel}>{submitLabel}</Button>
      <Button type="button" variant="secondary" actionName="Cancel Transaction Form" onClick={onCancel}>Cancel</Button>
      {onDelete && <Button type="button" variant="danger" actionName="Delete Transaction" onClick={onDelete}>🗑️ Delete</Button>}
    </FormButtonGroup>
  )

  const hasCategory = showCategory && categories && categoryGroups
  const inputStyle = { fontSize: '0.85rem', padding: '0.5rem' }

  // Stacked layout (default) - one field per line, clean and predictable
  if (!isWide) {
    return (
      <FormWrapper actionName={submitLabel} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField label="Date" htmlFor="txn-date">
              <DateInput id="txn-date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </FormField>
            <FormField label={showSignToggle ? (isNegative ? 'Amount (Expense)' : 'Amount (Refund)') : 'Amount'} htmlFor="txn-amount">
              {showSignToggle ? (
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <button
                    type="button"
                    onClick={() => setIsNegative(!isNegative)}
                    style={signToggleStyle(isNegative)}
                    title={isNegative ? 'Click to make this a refund (+)' : 'Click to make this an expense (-)'}
                  >
                    {isNegative ? '−' : '+'}
                  </button>
                  <div style={{ flex: 1 }}>
                    <CurrencyInput
                      id="txn-amount"
                      value={amount}
                      onChange={setAmount}
                      placeholder="$0.00"
                      required
                      autoFocus
                      style={{
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        borderLeft: 'none',
                        color: isNegative ? colors.error : colors.success,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <CurrencyInput id="txn-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
              )}
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
              <Checkbox id="txn-cleared-stacked" checked={cleared} onChange={(e) => setCleared(e.target.checked)} />
              <label htmlFor="txn-cleared-stacked" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Cleared (appeared in bank account)</label>
            </div>
          )}
          {validationWarning}
          {extraContent}
        </div>
        {stackedButtonGroup}
      </FormWrapper>
    )
  }

  // Wide layout (single row) - only when there's plenty of room (>= 1400px)
  // Use minmax() for consistent column sizing
  // Amount column is wider when sign toggle is shown (to accommodate toggle button)
  const amountWidth = showSignToggle ? '8.25rem' : '6rem'
  const wideGridCols = hasCategory
    ? (showCleared
        ? `6rem minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(8rem, 1fr) ${amountWidth} minmax(10rem, 2fr) auto auto`
        : `6rem minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(8rem, 1fr) ${amountWidth} minmax(10rem, 2fr) auto`)
    : (showCleared
        ? `6rem minmax(10rem, 1fr) minmax(10rem, 1fr) ${amountWidth} minmax(12rem, 2fr) auto auto`
        : `6rem minmax(10rem, 1fr) minmax(10rem, 1fr) ${amountWidth} minmax(12rem, 2fr) auto`)

  return (
    <FormWrapper actionName={submitLabel} onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: wideGridCols, gap: '1rem', alignItems: 'end' }}>
        <FormField label="Date" htmlFor="txn-date">
          <DateInput id="txn-date" value={date} onChange={(e) => setDate(e.target.value)} required style={inputStyle} />
        </FormField>
        <FormField label="Payee" htmlFor="txn-payee">
          <PayeeAutocomplete id="txn-payee" value={payee} onChange={setPayee} payees={payees} placeholder={payeePlaceholder} />
        </FormField>
        {categoryField}
        <FormField label={accountLabel} htmlFor="txn-account">{accountSelect}</FormField>
        <FormField label={showSignToggle ? (isNegative ? 'Amount (−)' : 'Amount (+)') : 'Amount'} htmlFor="txn-amount">
          {showSignToggle ? (
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={() => setIsNegative(!isNegative)}
                style={signToggleStyle(isNegative)}
                title={isNegative ? 'Click to make this a refund (+)' : 'Click to make this an expense (-)'}
              >
                {isNegative ? '−' : '+'}
              </button>
              <div style={{ flex: 1 }}>
                <CurrencyInput
                  id="txn-amount"
                  value={amount}
                  onChange={setAmount}
                  placeholder="$0.00"
                  required
                  autoFocus
                  style={{
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderLeft: 'none',
                    color: isNegative ? colors.error : colors.success,
                  }}
                />
              </div>
            </div>
          ) : (
            <CurrencyInput id="txn-amount" value={amount} onChange={setAmount} placeholder="$0.00" required autoFocus />
          )}
        </FormField>
        <FormField label="Description" htmlFor="txn-description">
          <TextInput id="txn-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={descriptionPlaceholder} style={inputStyle} />
        </FormField>
        {clearedCheckbox}
        {inlineActionButtons}
      </div>
      {validationWarning}
      {extraContent}
    </FormWrapper>
  )
}
