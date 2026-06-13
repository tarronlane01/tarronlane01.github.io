import { useState } from 'react'
import { Modal, FormField, TextInput, Button, FormButtonGroup } from '@components/ui'
import { isNameUnique } from '@packing/data'

interface TripModalProps {
  mode: 'add' | 'edit'
  initialName?: string
  initialFeatureIds?: string[]
  initialPersonIds?: string[]
  existingNames: string[]
  features: { id: string; name: string }[]
  persons: { id: string; name: string }[]
  onSave: (name: string, featureIds: string[], personIds: string[]) => void
  onClose: () => void
}

export function TripModal({
  mode, initialName, initialFeatureIds, initialPersonIds,
  existingNames, features, persons, onSave, onClose,
}: TripModalProps) {
  const [name, setName] = useState(initialName ?? '')
  const [featureIds, setFeatureIds] = useState<string[]>(initialFeatureIds ?? [])
  const [personIds, setPersonIds] = useState<string[]>(initialPersonIds ?? [])

  const trimmed = name.trim()
  const isUnique = isNameUnique(trimmed, existingNames, initialName)
  const canSave = trimmed.length > 0 && isUnique

  const toggleTag = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  return (
    <Modal isOpen onClose={onClose} title={mode === 'add' ? 'Add Trip' : 'Edit Trip'}>
      <FormField label="Name" htmlFor="trip-name">
        <TextInput id="trip-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormField>
      {!isUnique && trimmed.length > 0 && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0.25rem 0' }}>Name already exists.</p>
      )}

      {features.length > 0 && (
        <FormField label="Features" htmlFor="trip-features">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {features.map(f => (
              <button
                key={f.id}
                onClick={() => toggleTag(f.id, featureIds, setFeatureIds)}
                style={{
                  padding: '0.4rem 0.75rem', borderRadius: '1rem',
                  border: '1px solid var(--border-subtle)',
                  background: featureIds.includes(f.id) ? 'var(--color-primary)' : 'transparent',
                  color: featureIds.includes(f.id) ? 'white' : 'inherit',
                  cursor: 'pointer', fontSize: '0.9rem', minHeight: '2.25rem',
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </FormField>
      )}

      {persons.length > 0 && (
        <FormField label="Persons" htmlFor="trip-persons">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {persons.map(p => (
              <button
                key={p.id}
                onClick={() => toggleTag(p.id, personIds, setPersonIds)}
                style={{
                  padding: '0.4rem 0.75rem', borderRadius: '1rem',
                  border: '1px solid var(--border-subtle)',
                  background: personIds.includes(p.id) ? 'var(--color-primary)' : 'transparent',
                  color: personIds.includes(p.id) ? 'white' : 'inherit',
                  cursor: 'pointer', fontSize: '0.9rem', minHeight: '2.25rem',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </FormField>
      )}

      <FormButtonGroup>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={() => { onSave(trimmed, featureIds, personIds); onClose() }}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </FormButtonGroup>
    </Modal>
  )
}
