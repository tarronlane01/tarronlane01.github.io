import { useState, type FormEvent } from 'react'
import {
  FormWrapper,
  FormField,
  TextInput,
  SelectInput,
  FormButtonGroup,
  Button,
} from '../../ui'
import type { ExpectedBalanceType } from '@types'
import { ThreeStateCheckbox } from './ThreeStateCheckbox'

export interface GroupFormData {
  name: string
  expected_balance: ExpectedBalanceType
  on_budget?: boolean
  is_active?: boolean
}

interface GroupFormProps {
  initialData?: GroupFormData
  onSubmit: (data: GroupFormData) => void
  onCancel: () => void
  submitLabel: string
}

export function GroupForm({ initialData, onSubmit, onCancel, submitLabel }: GroupFormProps) {
  const [formData, setFormData] = useState<GroupFormData>(initialData || { name: '', expected_balance: 'positive' })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Account Type Name" htmlFor="group-name">
        <TextInput
          id="group-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Checking, Savings, Credit Cards, Investments"
          required
          autoFocus
        />
      </FormField>
      <FormField label="Expected Balance" htmlFor="expected-balance">
        <SelectInput
          id="expected-balance"
          value={formData.expected_balance}
          onChange={(e) => setFormData({ ...formData, expected_balance: e.target.value as ExpectedBalanceType })}
        >
          <option value="positive">Normally Positive (e.g., Checking, Savings)</option>
          <option value="negative">Normally Negative (e.g., Credit Cards, Loans)</option>
          <option value="any">Either (no warnings)</option>
        </SelectInput>
      </FormField>

      {/* Group-level overrides */}
      <div style={{
        padding: '0.75rem',
        background: 'color-mix(in srgb, currentColor 5%, transparent)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>
          Group-Level Overrides <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(applies to all accounts in this type)</span>
        </p>
        <ThreeStateCheckbox
          label="Active status"
          value={formData.is_active}
          onChange={(val) => setFormData({ ...formData, is_active: val })}
          trueLabel="All active"
          falseLabel="All inactive"
          undefinedLabel="Per account"
        />
        <ThreeStateCheckbox
          label="Budget status"
          value={formData.on_budget}
          onChange={(val) => setFormData({ ...formData, on_budget: val })}
          trueLabel="All on budget"
          falseLabel="All off budget"
          undefinedLabel="Per account"
        />
      </div>

      <FormButtonGroup>
        <Button type="submit">{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

