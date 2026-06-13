import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '@contexts'
import { usePacking } from '@packing/contexts'
import { ContentContainer } from '@components/ui'
import { usePackingQuery } from '@packing/data/queries'
import { useItemMutations } from '@packing/data/mutations/items'
import { useTaskMutations } from '@packing/data/mutations/tasks'
import { useCategoryMutations } from '@packing/data/mutations/categories'
import { useFeatureMutations } from '@packing/data/mutations/features'
import { usePersonMutations } from '@packing/data/mutations/persons'
import { usePhaseMutations } from '@packing/data/mutations/phases'
import { PackingNavBar, FeedbackModal } from '@packing/components/ui'
import { PackingFab } from '@packing/components/trips'
import { ItemModal } from '@packing/components/items'
import { TaskModal } from '@packing/components/tasks'
import { pageContainer } from '@styles/shared'
import type { Item, Task } from '@packing/data/types'

export default function PackingLayout() {
  const { addLoadingHold, removeLoadingHold } = useApp()
  const { isInitialized, pageTitle } = usePacking()
  const location = useLocation()
  const isOnTripDetail = location.pathname.startsWith('/packing/trip/')

  const { data: packing } = usePackingQuery()
  const { addItem } = useItemMutations()
  const { addTask } = useTaskMutations()
  const { addCategory } = useCategoryMutations()
  const { addFeature } = useFeatureMutations()
  const { addPerson } = usePersonMutations()
  const { addPhase } = usePhaseMutations()

  const [showItemModal, setShowItemModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  useEffect(() => {
    if (!isInitialized) {
      addLoadingHold('packing-init', 'Loading packing data...')
    } else {
      removeLoadingHold('packing-init')
    }
  }, [isInitialized, addLoadingHold, removeLoadingHold])

  useEffect(() => {
    return () => removeLoadingHold('packing-init')
  }, [removeLoadingHold])

  const sortedCategories = packing
    ? Object.entries(packing.categories).map(([id, c]) => ({ id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name))
    : []
  const sortedPhases = packing
    ? Object.entries(packing.phases).map(([id, p]) => ({ id, name: p.name, sortOrder: p.sortOrder })).sort((a, b) => a.sortOrder - b.sortOrder)
    : []
  const sortedFeatures = packing
    ? Object.entries(packing.features).map(([id, f]) => ({ id, name: f.name })).sort((a, b) => a.name.localeCompare(b.name))
    : []
  const sortedPersons = packing
    ? Object.entries(packing.persons).map(([id, p]) => ({ id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name))
    : []
  const itemNames = packing ? Object.values(packing.items).map(i => i.name) : []
  const taskNames = packing ? Object.values(packing.tasks).map(t => t.name) : []

  const handleItemSave = (item: Item) => { addItem(item) }
  const handleTaskSave = (task: Task) => { addTask(task) }

  return (
    <div style={{ ...pageContainer, paddingBottom: '5rem' }}>
      <ContentContainer>
        <PackingNavBar title={pageTitle} showBackArrow={isOnTripDetail} />
        {isInitialized && <Outlet />}

        <PackingFab
          onAddItem={() => setShowItemModal(true)}
          onAddTask={() => setShowTaskModal(true)}
          onAddFeedback={() => setShowFeedbackModal(true)}
        />

        {showItemModal && (
          <ItemModal
            mode="add"
            existingNames={itemNames}
            categories={sortedCategories}
            phases={sortedPhases}
            features={sortedFeatures}
            persons={sortedPersons}
            onSave={handleItemSave}
            onClose={() => setShowItemModal(false)}
            onAddCategory={addCategory}
            onAddPhase={addPhase}
            onAddFeature={addFeature}
            onAddPerson={addPerson}
            defaultPhaseId={packing?.defaultPhaseId}
          />
        )}

        {showTaskModal && (
          <TaskModal
            mode="add"
            existingNames={taskNames}
            phases={sortedPhases}
            features={sortedFeatures}
            onSave={handleTaskSave}
            onClose={() => setShowTaskModal(false)}
            onAddPhase={addPhase}
          />
        )}

        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
      </ContentContainer>
    </div>
  )
}
