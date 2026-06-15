import { useState } from 'react'
import { Modal, FormField, TextInput, SelectInput, Button, FormButtonGroup } from '@components/ui'
import { isNameUnique } from '@packing/data'
import type { Task } from '@packing/data/types'

interface TaskModalProps {
  mode: 'add' | 'edit'
  initial?: Task & { id: string }
  existingNames: string[]
  phases: { id: string; name: string }[]
  features: { id: string; name: string }[]
  onSave: (task: Task, id?: string) => void
  onDelete?: (id: string) => void
  onClose: () => void
  onAddPhase?: (name: string) => string
  defaultPhaseId?: string
}

export function TaskModal({
  mode, initial, existingNames, phases, features, onSave, onDelete, onClose, onAddPhase, defaultPhaseId,
}: TaskModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phaseId, setPhaseId] = useState(initial?.phaseId ?? defaultPhaseId ?? '')
  const [featureIds, setFeatureIds] = useState<string[]>(initial?.featureIds ?? [])
  const [showNewPhase, setShowNewPhase] = useState(false)
  const [newPhaseName, setNewPhaseName] = useState('')

  const trimmed = name.trim()
  const isUnique = isNameUnique(trimmed, existingNames, initial?.name)
  const canSave = trimmed.length > 0 && isUnique && phaseId !== ''

  const toggleFeature = (id: string) => {
    setFeatureIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = () => {
    const task: Task = { name: trimmed, phaseId, featureIds }
    onSave(task, initial?.id)
    onClose()
  }

  return (
    <Modal isOpen onClose={onClose} title={mode === 'add' ? 'Add Task' : 'Edit Task'}>
      <FormField label="Name" htmlFor="task-name">
        <TextInput id="task-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
      </FormField>
      {!isUnique && trimmed.length > 0 && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0.25rem 0' }}>Name already exists.</p>
      )}

      <FormField label="Phase" htmlFor="task-phase">
        {showNewPhase ? (
          <InlineCreate
            value={newPhaseName}
            onChange={setNewPhaseName}
            existingNames={phases.map(p => p.name)}
            onConfirm={(phaseName) => {
              if (onAddPhase) {
                const newId = onAddPhase(phaseName)
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
              <SelectInput id="task-phase" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                <option value="">Select phase...</option>
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

      {features.length > 0 && (
        <FormField label="Features" htmlFor="task-features">
          {featureIds.length === 0 && (
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', opacity: 0.45 }}>No features — appears on all trips</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {features.map(f => (
              <button
                key={f.id}
                onClick={() => toggleFeature(f.id)}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: '1rem',
                  border: '1px solid var(--border-subtle)',
                  background: featureIds.includes(f.id) ? 'var(--color-primary)' : 'transparent',
                  color: featureIds.includes(f.id) ? 'white' : 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  minHeight: '2.25rem',
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </FormField>
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
