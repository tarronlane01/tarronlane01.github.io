import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Modal, FormButtonGroup } from '@components/ui'
import { usePacking } from '@packing/contexts'
import { usePackingQuery } from '@packing/data/queries'
import { useTripMutations } from '@packing/data/mutations/trips'
import { useItemMutations } from '@packing/data/mutations/items'
import { useCategoryMutations } from '@packing/data/mutations/categories'
import { usePhaseMutations } from '@packing/data/mutations/phases'
import { useFeatureMutations } from '@packing/data/mutations/features'
import { usePersonMutations } from '@packing/data/mutations/persons'
import { useTripItems, useTripTasks } from '@packing/hooks'
import { PackingChecklist } from '@packing/components/trips/PackingChecklist'
import { ItemModal } from '@packing/components/items'
import { TaskModal } from '@packing/components/tasks'
import { useTaskMutations } from '@packing/data/mutations/tasks'
import { createEmptyPackingDocument } from '@packing/data/types'
import type { Item, Task, Trip } from '@packing/data/types'

const EMPTY_TRIP: Trip = {
  name: '', featureIds: [], personIds: [], quantities: {},
  packed: {}, packedPerPerson: {}, skipped: {}, skippedPerPerson: {}, tasksCompleted: {},
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>()
  const navigate = useNavigate()
  const { setPageTitle } = usePacking()
  const { data: packing } = usePackingQuery()
  const { resetTrip, deleteTrip } = useTripMutations()
  const { updateItem, deleteItem } = useItemMutations()
  const { addCategory } = useCategoryMutations()
  const { addPhase } = usePhaseMutations()
  const { addFeature } = useFeatureMutations()
  const { addPerson } = usePersonMutations()
  const { updateTask, deleteTask } = useTaskMutations()

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const safePacking = packing ?? createEmptyPackingDocument([])
  const trip = packing && tripId ? packing.trips[tripId] ?? null : null
  const safeTrip = trip ?? EMPTY_TRIP

  const { phases: itemPhases, skippedItems } = useTripItems(safePacking, safeTrip)
  const taskPhases = useTripTasks(safePacking, safeTrip)

  useEffect(() => {
    setPageTitle(trip?.name ?? 'Trip')
  }, [setPageTitle, trip?.name])

  if (!packing || !tripId || !trip) {
    return <p style={{ opacity: 0.6 }}>Trip not found.</p>
  }

  const editingItem = editingItemId ? packing.items[editingItemId] : null

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

  const editingTask = editingTaskId ? packing.tasks[editingTaskId] : null

  const handleItemSave = (item: Item, id?: string) => {
    if (id) updateItem(id, item)
  }

  const handleTaskSave = (task: Task, id?: string) => {
    if (id) updateTask(id, task)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Button variant="small" onClick={() => setShowResetConfirm(true)}>Reset</Button>
        <Button variant="small" onClick={() => setShowDeleteConfirm(true)}>Delete Trip</Button>
      </div>

      <PackingChecklist
        tripId={tripId}
        packing={packing}
        itemPhases={itemPhases}
        taskPhases={taskPhases}
        skippedItems={skippedItems}
        onEditItem={setEditingItemId}
        onEditTask={setEditingTaskId}
      />

      {editingItem && editingItemId && (
        <ItemModal
          mode="edit"
          initial={{ ...editingItem, id: editingItemId }}
          existingNames={itemNames}
          categories={sortedCategories}
          phases={sortedPhases}
          features={sortedFeatures}
          persons={sortedPersons}
          onSave={handleItemSave}
          onDelete={deleteItem}
          onClose={() => setEditingItemId(null)}
          onAddCategory={addCategory}
          onAddPhase={addPhase}
          onAddFeature={addFeature}
          onAddPerson={addPerson}
        />
      )}

      {editingTask && editingTaskId && (
        <TaskModal
          mode="edit"
          initial={{ ...editingTask, id: editingTaskId }}
          existingNames={taskNames}
          phases={sortedPhases}
          features={sortedFeatures}
          onSave={handleTaskSave}
          onDelete={deleteTask}
          onClose={() => setEditingTaskId(null)}
          onAddPhase={addPhase}
        />
      )}

      {showResetConfirm && (
        <Modal isOpen onClose={() => setShowResetConfirm(false)} title="Reset Trip">
          <p style={{ fontSize: '0.9rem' }}>Uncheck all packed, skipped, and completed items for this trip?</p>
          <FormButtonGroup>
            <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { resetTrip(tripId); setShowResetConfirm(false) }}>Reset</Button>
          </FormButtonGroup>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal isOpen onClose={() => setShowDeleteConfirm(false)} title="Delete Trip">
          <p style={{ fontSize: '0.9rem' }}>Delete &quot;{trip.name}&quot; permanently?</p>
          <FormButtonGroup>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { deleteTrip(tripId); navigate('/packing') }}>Delete</Button>
          </FormButtonGroup>
        </Modal>
      )}

    </div>
  )
}
