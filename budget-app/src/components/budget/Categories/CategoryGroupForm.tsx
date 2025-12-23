import { useState, type FormEvent } from 'react'
import {
  Button,
  FormWrapper,
  FormField,
  TextInput,
  FormButtonGroup,
} from '../../ui'

export interface CategoryGroupFormData {
  name: string
}

interface CategoryGroupFormProps {
  initialData?: CategoryGroupFormData
  onSubmit: (data: CategoryGroupFormData) => void
  onCancel: () => void
  submitLabel: string
}

export function CategoryGroupForm({ initialData, onSubmit, onCancel, submitLabel }: CategoryGroupFormProps) {
  const [formData, setFormData] = useState<CategoryGroupFormData>(initialData || { name: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formData.name.trim()) return
    setIsSubmitting(true)
    onSubmit(formData)
  }

  return (
    <FormWrapper onSubmit={handleSubmit}>
      <FormField label="Group Name" htmlFor="group-name">
        <TextInput
          id="group-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Housing, Transportation, Food"
          required
          autoFocus
        />
      </FormField>
      <FormButtonGroup>
        <Button type="submit" isLoading={isSubmitting}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </FormButtonGroup>
    </FormWrapper>
  )
}

