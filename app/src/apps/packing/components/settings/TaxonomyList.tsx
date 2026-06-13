import { useState } from 'react'
import { Button, Modal, FormField, TextInput, SelectInput, FormButtonGroup } from '@components/ui'
import { isNameUnique } from '@packing/data'

interface TaxonomyItem {
  id: string
  name: string
  sortOrder?: number
}

interface TaxonomyListProps {
  title: string
  items: TaxonomyItem[]
  onAdd: (name: string) => void
  onRename: (id: string, newName: string) => void
  onDelete: (id: string, reassignToId?: string) => void
  onReorder?: (id: string, direction: 'up' | 'down') => void
  /** Whether deletion requires reassignment (Categories/Phases) vs tag stripping (Features/Persons) */
  requiresReassignment?: boolean
  /** Items that reference this taxonomy (for deletion count) */
  usageCount?: (id: string) => number
}

export function TaxonomyList({
  title, items, onAdd, onRename, onDelete, onReorder,
  requiresReassignment = false, usageCount,
}: TaxonomyListProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<TaxonomyItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<TaxonomyItem | null>(null)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <Button variant="small" onClick={() => setShowAddModal(true)}>+ Add</Button>
      </div>

      {items.length === 0 && (
        <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No {title.toLowerCase()} yet.</p>
      )}

      {items.map((item, index) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)',
          minHeight: '2.75rem',
        }}>
          {onReorder && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <button
                onClick={() => onReorder(item.id, 'up')}
                disabled={index === 0}
                style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 0.6, padding: '0.25rem', fontSize: '0.8rem', lineHeight: 1 }}
              >
                ▲
              </button>
              <button
                onClick={() => onReorder(item.id, 'down')}
                disabled={index === items.length - 1}
                style={{ background: 'none', border: 'none', cursor: index === items.length - 1 ? 'default' : 'pointer', opacity: index === items.length - 1 ? 0.3 : 0.6, padding: '0.25rem', fontSize: '0.8rem', lineHeight: 1 }}
              >
                ▼
              </button>
            </div>
          )}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
          <button
            onClick={() => setEditingItem(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.375rem', fontSize: '1.1rem' }}
          >
            ✏️
          </button>
          <button
            onClick={() => setDeletingItem(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.375rem', fontSize: '1.1rem' }}
          >
            🗑️
          </button>
        </div>
      ))}

      {showAddModal && (
        <AddEditModal
          mode="add"
          existingNames={items.map(i => i.name)}
          onSave={(name) => { onAdd(name); setShowAddModal(false) }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingItem && (
        <AddEditModal
          mode="edit"
          initialName={editingItem.name}
          existingNames={items.map(i => i.name)}
          onSave={(name) => { onRename(editingItem.id, name); setEditingItem(null) }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {deletingItem && (
        <DeleteModal
          item={deletingItem}
          items={items}
          requiresReassignment={requiresReassignment}
          usageCount={usageCount?.(deletingItem.id) ?? 0}
          onConfirm={(reassignToId) => { onDelete(deletingItem.id, reassignToId); setDeletingItem(null) }}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  )
}

function AddEditModal({ mode, initialName, existingNames, onSave, onClose }: {
  mode: 'add' | 'edit'
  initialName?: string
  existingNames: string[]
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName ?? '')

  const trimmed = name.trim()
  const isUnique = isNameUnique(trimmed, existingNames, initialName)
  const canSave = trimmed.length > 0 && isUnique

  return (
    <Modal isOpen onClose={onClose} title={mode === 'add' ? 'Add' : 'Edit'}>
      <FormField label="Name" htmlFor="taxonomy-name">
        <TextInput id="taxonomy-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </FormField>
      {!isUnique && trimmed.length > 0 && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', margin: '0.25rem 0' }}>Name already exists.</p>
      )}
      <FormButtonGroup>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!canSave} onClick={() => onSave(trimmed)}>
          {mode === 'add' ? 'Add' : 'Save'}
        </Button>
      </FormButtonGroup>
    </Modal>
  )
}

function DeleteModal({ item, items, requiresReassignment, usageCount, onConfirm, onClose }: {
  item: TaxonomyItem
  items: TaxonomyItem[]
  requiresReassignment: boolean
  usageCount: number
  onConfirm: (reassignToId?: string) => void
  onClose: () => void
}) {
  const [reassignToId, setReassignToId] = useState('')
  const otherItems = items.filter(i => i.id !== item.id)

  const canDelete = !requiresReassignment || usageCount === 0 || reassignToId !== ''

  return (
    <Modal isOpen onClose={onClose} title={`Delete "${item.name}"`}>
      {usageCount > 0 && requiresReassignment ? (
        <>
          <p style={{ fontSize: '0.9rem' }}>
            {usageCount} item(s) use this. Reassign them to:
          </p>
          <SelectInput value={reassignToId} onChange={(e) => setReassignToId(e.target.value)}>
            <option value="">Select...</option>
            {otherItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </SelectInput>
        </>
      ) : usageCount > 0 ? (
        <p style={{ fontSize: '0.9rem' }}>
          This will be removed from {usageCount} item(s).
        </p>
      ) : (
        <p style={{ fontSize: '0.9rem' }}>Are you sure?</p>
      )}
      <FormButtonGroup>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!canDelete} onClick={() => onConfirm(reassignToId || undefined)}>
          Delete
        </Button>
      </FormButtonGroup>
    </Modal>
  )
}
