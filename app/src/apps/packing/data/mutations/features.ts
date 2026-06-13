import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { PackingDocument } from '@packing/data/types'

export function useFeatureMutations() {
  const mutation = usePackingMutation()

  return {
    addFeature: (name: string): string => {
      const id = generateId('fea')
      mutation.mutate({
        updates: { [`features.${id}`]: { name } },
        description: `adding feature "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          features: { ...prev.features, [id]: { name } },
        }),
      })
      return id
    },

    updateFeature: (id: string, name: string) => {
      mutation.mutate({
        updates: { [`features.${id}.name`]: name },
        description: `renaming feature to "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          features: { ...prev.features, [id]: { name } },
        }),
      })
    },

    deleteFeature: (id: string) => {
      mutation.mutate({
        updates: { [`features.${id}`]: deleteField() },
        description: `deleting feature "${id}"`,
        optimisticUpdate: (prev) => stripFeatureFromAll(prev, id),
      })
    },

    isPending: mutation.isPending,
  }
}

function stripFeatureFromAll(prev: PackingDocument, featureId: string): PackingDocument {
  const restFeatures = Object.fromEntries(Object.entries(prev.features).filter(([k]) => k !== featureId))

  const items = { ...prev.items }
  for (const [id, item] of Object.entries(items)) {
    if (item.featureIds.includes(featureId)) {
      items[id] = { ...item, featureIds: item.featureIds.filter(f => f !== featureId) }
    }
  }

  const tasks = { ...prev.tasks }
  for (const [id, task] of Object.entries(tasks)) {
    if (task.featureIds.includes(featureId)) {
      tasks[id] = { ...task, featureIds: task.featureIds.filter(f => f !== featureId) }
    }
  }

  const trips = { ...prev.trips }
  for (const [id, trip] of Object.entries(trips)) {
    if (trip.featureIds.includes(featureId)) {
      trips[id] = { ...trip, featureIds: trip.featureIds.filter(f => f !== featureId) }
    }
  }

  return { ...prev, features: restFeatures, items, tasks, trips }
}
