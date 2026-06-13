import { useEffect, useState } from 'react'
import { CollapsibleSection, Button, Modal, FormField, TextInput, SelectInput, FormButtonGroup } from '@components/ui'
import { usePacking } from '@packing/contexts'
import { usePackingQuery } from '@packing/data/queries'
import { useCategoryMutations } from '@packing/data/mutations/categories'
import { usePhaseMutations } from '@packing/data/mutations/phases'
import { useFeatureMutations } from '@packing/data/mutations/features'
import { usePersonMutations } from '@packing/data/mutations/persons'
import { useUserMutations } from '@packing/data/mutations/users'
import { usePackingMigrations } from '@packing/data/mutations/migrate'
import { readFeedbackItems, toggleFeedbackDone, deleteFeedbackItem } from '@packing/data/mutations/feedback'
import type { FeedbackItem } from '@packing/data/mutations/feedback'
import { TaxonomyList } from '@packing/components/settings'
import type { PackingDocument } from '@packing/data/types'

export default function Settings() {
  const { setPageTitle, isAdmin } = usePacking()
  const { data: packing, isFetched } = usePackingQuery()

  useEffect(() => { setPageTitle('Settings') }, [setPageTitle])

  if (!packing) {
    return <p style={{ opacity: 0.6 }}>{isFetched ? 'Set up packing from the Trips page first.' : 'Loading...'}</p>
  }

  return (
    <div>
      <CategoriesPanel packing={packing} />
      <PhasesPanel packing={packing} />
      <FeaturesPanel packing={packing} />
      <PersonsPanel packing={packing} />
      {isAdmin && <MigrationPanel packing={packing} />}
      {isAdmin && <UserAccessPanel packing={packing} />}
      {isAdmin && <FeedbackPanel />}
      {isAdmin && <DownloadPanel packing={packing} />}
    </div>
  )
}

// --- Categories ---

function CategoriesPanel({ packing }: PanelProps) {
  const { addCategory, updateCategory, deleteCategory } = useCategoryMutations()
  const items = toAlpha(packing.categories)

  const usageCount = (categoryId: string) =>
    Object.values(packing.items).filter(i => i.categoryId === categoryId).length

  return (
    <CollapsibleSection title="Categories" count={items.length} defaultExpanded>
      <TaxonomyList
        title="Categories"
        items={items}
        onAdd={(name) => addCategory(name)}
        onRename={(id, name) => updateCategory(id, name)}
        onDelete={(id, reassignToId) => deleteCategory(id, reassignToId)}
        requiresReassignment
        usageCount={usageCount}
      />
    </CollapsibleSection>
  )
}

// --- Phases ---

function PhasesPanel({ packing }: PanelProps) {
  const { addPhase, updatePhase, deletePhase, reorderPhase, setDefaultPhase } = usePhaseMutations()
  const sorted = toSorted(packing.phases)

  const usageCount = (phaseId: string) => {
    const taskCount = Object.values(packing.tasks).filter(t => t.phaseId === phaseId).length
    const itemCount = Object.values(packing.items).filter(i => i.phaseId === phaseId).length
    return taskCount + itemCount
  }

  const currentDefault = packing.defaultPhaseId ?? ''

  return (
    <CollapsibleSection title="Phases" count={sorted.length}>
      <TaxonomyList
        title="Phases"
        items={sorted}
        onAdd={(name) => addPhase(name)}
        onRename={(id, name) => updatePhase(id, name)}
        onDelete={(id, reassignToId) => deletePhase(id, reassignToId)}
        onReorder={(id, dir) => reorderPhase(id, dir, sorted)}
        requiresReassignment
        usageCount={usageCount}
      />
      {sorted.length > 0 && (
        <FormField label="Default phase for new items" htmlFor="default-phase" style={{ marginTop: '1rem' }}>
          <SelectInput id="default-phase" value={currentDefault} onChange={(e) => setDefaultPhase(e.target.value || undefined)}>
            <option value="">None</option>
            {sorted.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </SelectInput>
        </FormField>
      )}
    </CollapsibleSection>
  )
}

// --- Features ---

function FeaturesPanel({ packing }: PanelProps) {
  const { addFeature, updateFeature, deleteFeature } = useFeatureMutations()
  const items = toAlpha(packing.features)

  const usageCount = (featureId: string) => {
    const itemCount = Object.values(packing.items).filter(i => i.featureIds.includes(featureId)).length
    const taskCount = Object.values(packing.tasks).filter(t => t.featureIds.includes(featureId)).length
    const tripCount = Object.values(packing.trips).filter(t => t.featureIds.includes(featureId)).length
    return itemCount + taskCount + tripCount
  }

  return (
    <CollapsibleSection title="Features" count={items.length}>
      <TaxonomyList
        title="Features"
        items={items}
        onAdd={(name) => addFeature(name)}
        onRename={(id, name) => updateFeature(id, name)}
        onDelete={(id) => deleteFeature(id)}
        usageCount={usageCount}
      />
    </CollapsibleSection>
  )
}

// --- Persons ---

function PersonsPanel({ packing }: PanelProps) {
  const { addPerson, updatePerson, deletePerson } = usePersonMutations()
  const items = toAlpha(packing.persons)

  const usageCount = (personId: string) => {
    const itemCount = Object.values(packing.items).filter(i => i.personIds.includes(personId)).length
    const tripCount = Object.values(packing.trips).filter(t => t.personIds.includes(personId)).length
    return itemCount + tripCount
  }

  return (
    <CollapsibleSection title="Persons" count={items.length}>
      <TaxonomyList
        title="Persons"
        items={items}
        onAdd={(name) => addPerson(name)}
        onRename={(id, name) => updatePerson(id, name)}
        onDelete={(id) => deletePerson(id)}
        usageCount={usageCount}
      />
    </CollapsibleSection>
  )
}

// --- Migration ---

function MigrationPanel({ packing }: PanelProps) {
  const { migrateSectionsToPhases } = usePackingMigrations()
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSections = Object.keys((packing as any).sections ?? {}).length > 0

  if (!hasSections && status === 'idle') return null

  const handleMigrate = async () => {
    setStatus('running')
    await migrateSectionsToPhases(packing)
    setStatus('done')
  }

  return (
    <CollapsibleSection title="Migration" defaultExpanded>
      <div>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Convert legacy sections to phases:
        </p>
        <ul style={{ fontSize: '0.85rem', margin: '0 0 0.75rem', paddingLeft: '1.5rem' }}>
          <li>Create a phase for each section</li>
          <li>Assign phaseId to items based on their category&apos;s section</li>
          <li>Simplify categories (remove section/sort fields)</li>
        </ul>
        {status === 'done' ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-success)' }}>Migration complete.</p>
        ) : (
          <Button
            variant="small"
            disabled={!hasSections || status === 'running'}
            onClick={handleMigrate}
          >
            {status === 'running' ? 'Running...' : 'Run Migration'}
          </Button>
        )}
      </div>
    </CollapsibleSection>
  )
}

// --- User Access ---

function UserAccessPanel({ packing }: PanelProps) {
  const { addUser, removeUser } = useUserMutations()
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUserId, setNewUserId] = useState('')

  return (
    <CollapsibleSection title="User Access" count={packing.userIds.length}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0 }}>Authorized Users</h4>
          <Button variant="small" onClick={() => setShowAddModal(true)}>+ Add</Button>
        </div>

        {packing.userIds.length === 0 && (
          <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No users have access yet.</p>
        )}

        {packing.userIds.map(uid => (
          <div key={uid} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ flex: 1, fontSize: '0.85rem', fontFamily: 'monospace' }}>{uid}</span>
            <button
              onClick={() => removeUser(uid, packing.userIds)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.125rem' }}
            >
              🗑️
            </button>
          </div>
        ))}

        {showAddModal && (
          <Modal isOpen onClose={() => { setShowAddModal(false); setNewUserId('') }} title="Add User">
            <FormField label="User ID (Firebase UID)" htmlFor="user-id-input">
              <TextInput id="user-id-input" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} autoFocus />
            </FormField>
            <FormButtonGroup>
              <Button variant="secondary" onClick={() => { setShowAddModal(false); setNewUserId('') }}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!newUserId.trim()}
                onClick={() => { addUser(newUserId.trim(), packing.userIds); setShowAddModal(false); setNewUserId('') }}
              >
                Add
              </Button>
            </FormButtonGroup>
          </Modal>
        )}
      </div>
    </CollapsibleSection>
  )
}

// --- Feedback ---

function FeedbackPanel() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    readFeedbackItems().then(result => { setItems(result); setIsLoaded(true) })
  }, [])

  const openItems = items.filter(i => !i.isDone).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const doneItems = items.filter(i => i.isDone).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  async function handleToggle(itemId: string, isDone: boolean) {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, isDone } : i))
    await toggleFeedbackDone(itemId, isDone)
  }

  async function handleDelete(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    setConfirmDeleteId(null)
    await deleteFeedbackItem(itemId)
  }

  if (!isLoaded) return null

  return (
    <CollapsibleSection title="Feedback" count={items.length}>
      <div>
        {items.length === 0 && <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No feedback yet.</p>}

        {openItems.map(item => (
          <FeedbackRow
            key={item.id} item={item}
            onToggle={() => handleToggle(item.id, true)}
            onDelete={() => setConfirmDeleteId(item.id)}
          />
        ))}

        {doneItems.length > 0 && (
          <details style={{ marginTop: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', opacity: 0.6 }}>
              Done ({doneItems.length})
            </summary>
            {doneItems.map(item => (
              <FeedbackRow
                key={item.id} item={item}
                onToggle={() => handleToggle(item.id, false)}
                onDelete={() => setConfirmDeleteId(item.id)}
              />
            ))}
          </details>
        )}

        {confirmDeleteId && (
          <Modal isOpen onClose={() => setConfirmDeleteId(null)} title="Delete Feedback">
            <p style={{ fontSize: '0.9rem' }}>Delete this feedback item permanently?</p>
            <FormButtonGroup>
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</Button>
            </FormButtonGroup>
          </Modal>
        )}
      </div>
    </CollapsibleSection>
  )
}

function FeedbackRow({ item, onToggle, onDelete }: {
  item: FeedbackItem; onToggle: () => void; onDelete: () => void
}) {
  const date = new Date(item.createdAt).toLocaleDateString()
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
      padding: '0.5rem', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <input
        type="checkbox" checked={item.isDone} onChange={onToggle}
        style={{ marginTop: '0.2rem', cursor: 'pointer' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.9rem',
          textDecoration: item.isDone ? 'line-through' : 'none',
          opacity: item.isDone ? 0.5 : 1,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {item.text}
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.25rem' }}>
          {item.submittedBy} · {date}
        </div>
      </div>
      <button
        onClick={onDelete}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.125rem' }}
      >
        🗑️
      </button>
    </div>
  )
}

// --- Download ---

function DownloadPanel({ packing }: PanelProps) {
  const handleDownload = () => {
    const json = JSON.stringify(packing, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `packing-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <CollapsibleSection title="Data Export">
      <Button variant="small" onClick={handleDownload}>Download JSON</Button>
    </CollapsibleSection>
  )
}

// --- Helpers ---
interface PanelProps { packing: PackingDocument }
interface SortableItem { id: string; name: string; sortOrder: number }
interface AlphaItem { id: string; name: string }

function toSorted(map: Record<string, { name: string; sortOrder: number } | null>): SortableItem[] {
  return Object.entries(map)
    .filter((_e): _e is [string, { name: string; sortOrder: number }] => _e[1] != null)
    .map(([id, v]) => ({ id, name: v.name, sortOrder: v.sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

function toAlpha(map: Record<string, { name: string } | null>): AlphaItem[] {
  return Object.entries(map)
    .filter((_e): _e is [string, { name: string }] => _e[1] != null)
    .map(([id, v]) => ({ id, name: v.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
