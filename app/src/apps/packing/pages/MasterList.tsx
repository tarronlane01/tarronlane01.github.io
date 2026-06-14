import { useEffect, useState } from 'react'
import { TabNavigation, Button, SelectInput, TextInput } from '@components/ui'
import { usePacking } from '@packing/contexts'
import { usePackingQuery } from '@packing/data/queries'
import { useItemMutations } from '@packing/data/mutations/items'
import { useTaskMutations } from '@packing/data/mutations/tasks'
import { useCategoryMutations } from '@packing/data/mutations/categories'
import { useFeatureMutations } from '@packing/data/mutations/features'
import { usePersonMutations } from '@packing/data/mutations/persons'
import { usePhaseMutations } from '@packing/data/mutations/phases'
import { ItemList } from '@packing/components/items'
import { ItemModal } from '@packing/components/items'
import { TaskList } from '@packing/components/tasks'
import { TaskModal } from '@packing/components/tasks'
import type { Item, Task } from '@packing/data/types'
import { iconButton, searchCloseIndicator } from '@styles/shared'

const tabs = [
  { id: 'items', label: 'Items' },
  { id: 'tasks', label: 'Tasks' },
]

export default function MasterList() {
  const { setPageTitle } = usePacking()
  const { data: packing, isFetched } = usePackingQuery()
  const { addItem, updateItem, deleteItem } = useItemMutations()
  const { addTask, updateTask, deleteTask } = useTaskMutations()
  const { addCategory } = useCategoryMutations()
  const { addFeature } = useFeatureMutations()
  const { addPerson } = usePersonMutations()
  const { addPhase } = usePhaseMutations()

  const [activeTab, setActiveTab] = useState('items')
  const [filterPhaseId, setFilterPhaseId] = useState('')
  const [filterFeatureId, setFilterFeatureId] = useState('')
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<(Item & { id: string }) | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | undefined>()
  const [defaultPhaseId, setDefaultPhaseId] = useState<string | undefined>()
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<(Task & { id: string }) | null>(null)
  const [defaultTaskPhaseId, setDefaultTaskPhaseId] = useState<string | undefined>()
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  useEffect(() => { setPageTitle('Master List') }, [setPageTitle])

  const handleSearchToggle = () => {
    if (showSearch) { setSearchQuery(''); setShowSearch(false) }
    else { setShowSearch(true) }
  }

  if (!packing) {
    return <p style={{ opacity: 0.6 }}>{isFetched ? 'Set up packing from the Trips page first.' : 'Loading...'}</p>
  }

  const sortedCategories = Object.entries(packing.categories)
    .map(([id, c]) => ({ id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const sortedPhases = Object.entries(packing.phases)
    .map(([id, p]) => ({ id, name: p.name, sortOrder: p.sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const sortedFeatures = Object.entries(packing.features)
    .map(([id, f]) => ({ id, name: f.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const sortedPersons = Object.entries(packing.persons)
    .map(([id, p]) => ({ id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const itemNames = Object.values(packing.items).map(i => i.name)
  const taskNames = Object.values(packing.tasks).map(t => t.name)

  const handleItemSave = (item: Item, id?: string) => {
    if (id) { updateItem(id, item) } else { addItem(item) }
  }

  const handleTaskSave = (task: Task, id?: string) => {
    if (id) { updateTask(id, task) } else { addTask(task) }
  }

  return (
    <div>
      <TabNavigation tabs={tabs} activeTab={activeTab} mode="button" onTabChange={setActiveTab} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0', gap: '0.5rem' }}>
        <div style={{ flex: 1, maxWidth: '10rem' }}>
          <SelectInput value={filterPhaseId} onChange={(e) => setFilterPhaseId(e.target.value)}>
            <option value="">All phases</option>
            <option value="_unassigned">Unassigned</option>
            {sortedPhases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectInput>
        </div>
        <div style={{ flex: 1, maxWidth: '10rem' }}>
          <SelectInput value={filterFeatureId} onChange={(e) => setFilterFeatureId(e.target.value)}>
            <option value="">All features</option>
            {sortedFeatures.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </SelectInput>
        </div>
        <button style={{ ...iconButton, position: 'relative' }} onClick={handleSearchToggle} title="Search">
          🔍
          {showSearch && <span style={searchCloseIndicator}>✕</span>}
        </button>
        <Button
          variant="small"
          onClick={() => activeTab === 'items' ? setShowItemModal(true) : setShowTaskModal(true)}
        >
          + Add {activeTab === 'items' ? 'Item' : 'Task'}
        </Button>
      </div>

      {showSearch && (
        <div style={{ marginBottom: '0.75rem' }}>
          <TextInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder={`Search ${activeTab === 'items' ? 'items' : 'tasks'}...`}
            autoFocus
          />
        </div>
      )}

      {activeTab === 'items' && (
        <ItemList packing={packing} filterPhaseId={filterPhaseId} filterFeatureId={filterFeatureId} searchQuery={searchQuery || undefined} onEdit={(id, item) => setEditingItem({ ...item, id })} onAdd={(catId) => { setDefaultCategoryId(catId); setShowItemModal(true) }} />
      )}
      {activeTab === 'tasks' && (
        <TaskList packing={packing} filterPhaseId={filterPhaseId} filterFeatureId={filterFeatureId} searchQuery={searchQuery || undefined} onEdit={(id, task) => setEditingTask({ ...task, id })} onAdd={(phId) => { setDefaultTaskPhaseId(phId); setShowTaskModal(true) }} />
      )}

      {(showItemModal || editingItem) && (
        <ItemModal
          mode={editingItem ? 'edit' : 'add'}
          initial={editingItem ?? undefined}
          existingNames={itemNames}
          categories={sortedCategories}
          phases={sortedPhases}
          features={sortedFeatures}
          persons={sortedPersons}
          onSave={handleItemSave}
          onDelete={deleteItem}
          onClose={() => { setShowItemModal(false); setEditingItem(null); setDefaultCategoryId(undefined); setDefaultPhaseId(undefined) }}
          onAddCategory={addCategory}
          onAddPhase={addPhase}
          onAddFeature={addFeature}
          onAddPerson={addPerson}
          defaultCategoryId={defaultCategoryId}
          defaultPhaseId={defaultPhaseId ?? packing.defaultPhaseId}
        />
      )}

      {(showTaskModal || editingTask) && (
        <TaskModal
          mode={editingTask ? 'edit' : 'add'}
          initial={editingTask ?? undefined}
          existingNames={taskNames}
          phases={sortedPhases}
          features={sortedFeatures}
          onSave={handleTaskSave}
          onDelete={deleteTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null); setDefaultTaskPhaseId(undefined) }}
          onAddPhase={addPhase}
          defaultPhaseId={defaultTaskPhaseId}
        />
      )}

    </div>
  )
}
