import { useState } from 'react'
import { Modal, FormField, TextInput, SelectInput, Checkbox, Button, FormButtonGroup } from '@components/ui'
import { isNameUnique } from '@packing/data'
import type { Item } from '@packing/data/types'

interface ItemModalProps {
  mode: 'add' | 'edit'
  initial?: Item & { id: string }
  existingNames: string[]
  categories: { id: string; name: string }[]
  phases: { id: string; name: string }[]
  features: { id: string; name: string }[]
  persons: { id: string; name: string }[]
  onSave: (item: Item, id?: string) => void
  onDelete?: (id: string) => void
  onClose: () => void
  onAddCategory?: (name: string) => string
  onAddPhase?: (name: string) => string
  onAddFeature?: (name: string) => string
  onAddPerson?: (name: string) => string
  defaultCategoryId?: string
  defaultPhaseId?: string
}

export function ItemModal({
  mode, initial, existingNames, categories, phases, features, persons,
  onSave, onDelete, onClose, onAddCategory, onAddPhase, onAddFeature, onAddPerson,
  defaultCategoryId, defaultPhaseId,
}: ItemModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? '')
  const [phaseId, setPhaseId] = useState(initial?.phaseId ?? defaultPhaseId ?? '')
  const [featureIds, setFeatureIds] = useState<string[]>(initial?.featureIds ?? [])
  const [personIds, setPersonIds] = useState<string[]>(initial?.personIds ?? [])
  const [perPerson, setPerPerson] = useState(initial?.perPerson ?? false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewPhase, setShowNewPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')
  const [showNewFeature, setShowNewFeature] = useState(false)
  const [newFeatureName, setNewFeatureName] = useState('')
  const [showNewPerson, setShowNewPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')

  const trimmed = name.trim()
  const isUnique = isNameUnique(trimmed, existingNames, initial?.name)
  const canSave = trimmed.length > 0 && isUnique && categoryId !== ''

  const toggleTag = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const handleSave = () => {
    const item: Item = {
      name: trimmed, categoryId, featureIds, personIds, perPerson,
      ...(phaseId ? { phaseId } : {}),
    }
    onSave(item, initial?.id)
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} title={mode === 'add' ? 'Add Item' : 'Edit Item'}>
      <FormField label="Name" htmlFor="item-name">
        <TextInput id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </FormField>
      {!isUnique && trimmed.length > 0 && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0.25rem 0' }}>Name already exists.</p>
      )}

      <FormField label="Category" htmlFor="item-category">
        {showNewCategory ? (
          <InlineCreate
            value={newCategoryName}
            onChange={setNewCategoryName}
            existingNames={categories.map(c => c.name)}
            onConfirm={(catName) => {
              if (onAddCategory) {
                const newId = onAddCategory(catName)
                setCategoryId(newId)
              }
              setShowNewCategory(false)
              setNewCategoryName('')
            }}
            onCancel={() => { setShowNewCategory(false); setNewCategoryName('') }}
            placeholder="Category name"
          />
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SelectInput id="item-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </SelectInput>
            </div>
            {onAddCategory && (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.25rem' }}
              >
                + New
              </button>
            )}
          </div>
        )}
      </FormField>

      <FormField label="Phase (optional)" htmlFor="item-phase">
        {showNewPhase ? (
          <InlineCreate
            value={newPhaseName}
            onChange={setNewPhaseName}
            existingNames={phases.map(p => p.name)}
            onConfirm={(pName) => {
              if (onAddPhase) {
                const newId = onAddPhase(pName)
                setPhaseId(newId)
              }
              setShowNewPhase(false)
              setNewPhaseName('')
            }}
            onCancel={() => { setShowNewPhase(false); setNewPhaseName('') }}
            placeholder="Phase name"
          />
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SelectInput id="item-phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                <option value="">No phase</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </SelectInput>
            </div>
            {onAddPhase && (
              <button
                type="button"
                onClick={() => setShowNewPhase(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.25rem' }}
              >
                + New
              </button>
            )}
          </div>
        )}
      </FormField>

      <FormField label="Features" htmlFor="item-features">
        {showNewFeature ? (
          <InlineCreate
            value={newFeatureName}
            onChange={setNewFeatureName}
            existingNames={features.map(f => f.name)}
            onConfirm={(feaName) => {
              if (onAddFeature) {
                const newId = onAddFeature(feaName)
                setFeatureIds(prev => [...prev, newId])
              }
              setShowNewFeature(false)
              setNewFeatureName('')
            }}
            onCancel={() => { setShowNewFeature(false); setNewFeatureName('') }}
            placeholder="Feature name"
          />
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <TagSelector items={features} selected={featureIds} onToggle={(id) => toggleTag(id, featureIds, setFeatureIds)} />
            {onAddFeature && (
              <button
                type="button"
                onClick={() => setShowNewFeature(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.25rem' }}
              >
                + New
              </button>
            )}
          </div>
        )}
      </FormField>

      <FormField label="Persons" htmlFor="item-persons">
        {showNewPerson ? (
          <InlineCreate
            value={newPersonName}
            onChange={setNewPersonName}
            existingNames={persons.map(p => p.name)}
            onConfirm={(perName) => {
              if (onAddPerson) {
                const newId = onAddPerson(perName)
                setPersonIds(prev => [...prev, newId])
              }
              setShowNewPerson(false)
              setNewPersonName('')
            }}
            onCancel={() => { setShowNewPerson(false); setNewPersonName('') }}
            placeholder="Person name"
          />
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <TagSelector items={persons} selected={personIds} onToggle={(id) => toggleTag(id, personIds, setPersonIds)} />
            {onAddPerson && (
              <button
                type="button"
                onClick={() => setShowNewPerson(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', padding: '0.25rem' }}
              >
                + New
              </button>
            )}
          </div>
        )}
      </FormField>

      {(personIds.length > 0 || persons.length > 0) && (
        <div style={{ marginTop: '0.5rem' }}>
          <Checkbox
            checked={perPerson}
            onChange={(e) => setPerPerson(e.target.checked)}
          >
            Per-person item (one checkbox per person when packing)
          </Checkbox>
        </div>
      )}

      <FormButtonGroup>
        {mode === 'edit' && onDelete && initial && (
          <Button variant="danger" onClick={() => { onDelete(initial.id); onClose() }}>Delete</Button>
        )}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={handleSave}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </FormButtonGroup>
    </Modal>
  )
}

function TagSelector({ items, selected, onToggle }: {
  items: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onToggle(item.id)}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: '1rem',
            border: '1px solid var(--border-subtle)',
            background: selected.includes(item.id) ? 'var(--color-primary)' : 'transparent',
            color: selected.includes(item.id) ? 'white' : 'inherit',
            cursor: 'pointer',
            fontSize: '0.9rem',
            minHeight: '2.25rem',
          }}
        >
          {item.name}
        </button>
      ))}
    </div>
  )
}

function InlineCreate({ value, onChange, existingNames, onConfirm, onCancel, placeholder }: {
  value: string
  onChange: (v: string) => void
  existingNames: string[]
  onConfirm: (name: string) => void
  onCancel: () => void
  placeholder: string
}) {
  const trimmed = value.trim()
  const unique = isNameUnique(trimmed, existingNames)
  const canAdd = trimmed.length > 0 && unique

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <TextInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAdd) onConfirm(trimmed)
              if (e.key === 'Escape') onCancel()
            }}
          />
        </div>
        <Button variant="small" disabled={!canAdd} onClick={() => onConfirm(trimmed)}>Add</Button>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.85rem', padding: '0.25rem' }}
        >
          Cancel
        </button>
      </div>
      {!unique && trimmed.length > 0 && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0.25rem 0' }}>Name already exists.</p>
      )}
    </div>
  )
}
