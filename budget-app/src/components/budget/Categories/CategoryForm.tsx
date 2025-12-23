import { useState, type FormEvent } from 'react'
import type { CategoryGroup, DefaultAmountType } from '../../../types/budget'
import {
  Button,
  FormWrapper,
  FormField,
  TextInput,
  TextAreaInput,
  SelectInput,
  FormButtonGroup,
  CurrencyInput,
} from '../../ui'

export interface CategoryFormData {
  name: string
  description?: string
  category_group_id: string | null
  default_monthly_amount?: number
  default_monthly_type?: DefaultAmountType
}

interface CategoryFormProps {
  initialData?: CategoryFormData
  onSubmit: (data: CategoryFormData) => void
  onCancel: () => void
  submitLabel: string
  categoryGroups?: CategoryGroup[]
  showGroupSelector?: boolean
}

export function CategoryForm({ initialData, onSubmit, onCancel, submitLabel, categoryGroups = [], showGroupSelector = false }: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>(initialData || { name: '', category_group_id: null })
  const [defaultAmount, setDefaultAmount] = useState(initialData?.default_monthly_amount?.toString() || '')
  const [defaultType, setDefaultType] = useState<DefaultAmountType>(initialData?.default_monthly_type || 'fixed')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsSubmitting(true)
    const parsedAmount = parseFloat(defaultAmount)
    const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0
    onSubmit({
      ...formData,
      description: formData.description?.trim() || undefined,
      default_monthly_amount: hasValidAmount ? parsedAmount : undefined,
      default_monthly_type: hasValidAmount ? defaultType : undefined,
    })
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Category Name" htmlFor="category-name">
        <TextInput
          id="category-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Groceries, Rent, Gas"
          required
          autoFocus
        />
      </FormField>
      <FormField label="Description (optional)" htmlFor="category-description">
        <TextAreaInput
          id="category-description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What is this category used for?"
          minHeight="3rem"
        />
      </FormField>
      {showGroupSelector && (
        <FormField label="Category Group" htmlFor="category-group">
          <SelectInput
            id="category-group"
            value={formData.category_group_id || 'ungrouped'}
            onChange={(e) => setFormData({
              ...formData,
              category_group_id: e.target.value === 'ungrouped' ? null : e.target.value
            })}
          >
            <option value="ungrouped">Uncategorized</option>
            {categoryGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </SelectInput>
        </FormField>
      )}
      <FormField label="Default Monthly Allocation (optional)" htmlFor="default-amount">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <SelectInput
            id="default-type"
            value={defaultType}
            onChange={(e) => setDefaultType(e.target.value as DefaultAmountType)}
            style={{ width: 'auto', flex: '0 0 auto' }}
          >
            <option value="fixed">Fixed $</option>
            <option value="percentage">% of Prev Income</option>
          </SelectInput>
          {defaultType === 'fixed' ? (
            <CurrencyInput
              id="default-amount"
              value={defaultAmount}
              onChange={setDefaultAmount}
              placeholder="$0.00"
            />
          ) : (
            <TextInput
              id="default-amount"
              type="number"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
              style={{ width: '80px' }}
            />
          )}
          {defaultType === 'percentage' && <span style={{ opacity: 0.6 }}>%</span>}
        </div>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>
          {defaultType === 'fixed'
            ? 'Suggested fixed amount to allocate each month'
            : 'Percentage of previous month\'s total income'}
        </p>
      </FormField>
      <FormButtonGroup>
        <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

