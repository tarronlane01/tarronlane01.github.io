import { useState, type FormEvent } from 'react'
import type { ExpenseTransaction, FinancialAccount, AccountGroupsMap, Category, CategoriesMap, CategoryGroup } from '../../../types/budget'
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

export type ExpenseAccountEntry = [string, FinancialAccount]

interface ExpenseFormProps {
  accounts: ExpenseAccountEntry[]
  accountGroups: AccountGroupsMap
  categories: CategoriesMap
  categoryGroups: CategoryGroup[]
  payees: string[]
  initialData?: ExpenseTransaction
  defaultAccountId?: string
  defaultDate?: string // YYYY-MM-DD format
  onSubmit: (amount: number, categoryId: string, accountId: string, date: string, payee?: string, description?: string) => void
  onCancel: () => void
  onDelete?: () => void // Optional delete handler (shown when editing)
  submitLabel: string
  isMobile?: boolean
}

export function ExpenseForm({
  accounts,
  accountGroups,
  categories,
  categoryGroups,
  payees,
  initialData,
  defaultAccountId,
  defaultDate,
  onSubmit,
  onCancel,
  onDelete,
  submitLabel,
  isMobile
}: ExpenseFormProps) {
  // Default to today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [categoryId, setCategoryId] = useState(initialData?.category_id || '')
  const [accountId, setAccountId] = useState(initialData?.account_id || defaultAccountId || (accounts[0] ? accounts[0][0] : ''))
  const [date, setDate] = useState(initialData?.date || defaultDate || today)
  const [payee, setPayee] = useState(initialData?.payee || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Group accounts by their account group for the dropdown
  const accountsByGroup: Record<string, ExpenseAccountEntry[]> = {}
  const ungroupedAccounts: ExpenseAccountEntry[] = []

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

  // Group categories by their category group for the dropdown
  const categoriesByGroup: Record<string, [string, Category][]> = {}
  const ungroupedCategories: [string, Category][] = []

  Object.entries(categories).forEach(([catId, category]) => {
    if (category.category_group_id) {
      if (!categoriesByGroup[category.category_group_id]) {
        categoriesByGroup[category.category_group_id] = []
      }
      categoriesByGroup[category.category_group_id].push([catId, category])
    } else {
      ungroupedCategories.push([catId, category])
    }
  })

  // Sort categories within groups by sort_order
  Object.values(categoriesByGroup).forEach(cats => {
    cats.sort((a, b) => a[1].sort_order - b[1].sort_order)
  })
  ungroupedCategories.sort((a, b) => a[1].sort_order - b[1].sort_order)

  // Sort category groups by sort_order
  const sortedCategoryGroups = [...categoryGroups].sort((a, b) => a.sort_order - b.sort_order)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return
    if (!categoryId) return
    if (!accountId) return
    if (!date) return
    onSubmit(parsedAmount, categoryId, accountId, date, payee.trim() || undefined, description.trim() || undefined)
  }

  const gridStyle = isMobile
    ? { display: 'flex', flexDirection: 'column' as const, gap: '1rem' }
    : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <div style={gridStyle}>
        <FormField label="Amount" htmlFor="expense-amount">
          <CurrencyInput
            id="expense-amount"
            value={amount}
            onChange={setAmount}
            placeholder="$0.00"
            required
            autoFocus
          />
        </FormField>
        <FormField label="Date" htmlFor="expense-date">
          <TextInput
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </FormField>
      </div>
      <div style={gridStyle}>
        <FormField label="Category" htmlFor="expense-category">
          <SelectInput
            id="expense-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select category...</option>
            {/* Render grouped categories with optgroups */}
            {sortedCategoryGroups.map((group) => {
              const groupCats = categoriesByGroup[group.id]
              if (!groupCats || groupCats.length === 0) return null
              return (
                <optgroup key={group.id} label={group.name}>
                  {groupCats.map(([catId, category]) => (
                    <option key={catId} value={catId}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
            {/* Ungrouped categories */}
            {ungroupedCategories.length > 0 && (
              <optgroup label="Other">
                {ungroupedCategories.map(([catId, category]) => (
                  <option key={catId} value={catId}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectInput>
        </FormField>
        <FormField label="Pay From" htmlFor="expense-account">
          <SelectInput
            id="expense-account"
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
      </div>
      <FormField label="Payee" htmlFor="expense-payee">
        <PayeeAutocomplete
          id="expense-payee"
          value={payee}
          onChange={setPayee}
          payees={payees}
          placeholder="e.g., Grocery Store, Restaurant"
        />
      </FormField>
      <FormField label="Description (optional)" htmlFor="expense-description">
        <TextInput
          id="expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Weekly groceries, Dinner with friends"
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

