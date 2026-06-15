import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { Trip } from '@packing/data/types'

export function useTripMutations() {
  const mutation = usePackingMutation()

  return {
    addTrip: (name: string, featureIds: string[]) => {
      const id = generateId('trp')
      const trip: Trip = {
        name, featureIds,
        quantities: {},
        packed: {}, packedPerPerson: {},
        skipped: {}, skippedPerPerson: {},
        permanentlySkipped: {}, permanentlySkippedPerPerson: {},
        tasksCompleted: {}, tasksSkipped: {}, tasksPermanentlySkipped: {},
      }
      mutation.mutate({
        updates: { [`trips.${id}`]: trip },
        description: `adding trip "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          trips: { ...prev.trips, [id]: trip },
        }),
      })
      return id
    },

    updateTrip: (id: string, name: string, featureIds: string[]) => {
      mutation.mutate({
        updates: {
          [`trips.${id}.name`]: name,
          [`trips.${id}.featureIds`]: featureIds,
        },
        description: `updating trip "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          trips: {
            ...prev.trips,
            [id]: { ...prev.trips[id], name, featureIds },
          },
        }),
      })
    },

    deleteTrip: (id: string) => {
      mutation.mutate({
        updates: { [`trips.${id}`]: deleteField() },
        description: `deleting trip "${id}"`,
        optimisticUpdate: (prev) => {
          const trips = Object.fromEntries(Object.entries(prev.trips).filter(([k]) => k !== id))
          return { ...prev, trips }
        },
      })
    },

    resetTrip: (id: string) => {
      mutation.mutate({
        updates: {
          [`trips.${id}.packed`]: {},
          [`trips.${id}.packedPerPerson`]: {},
          [`trips.${id}.skipped`]: {},
          [`trips.${id}.skippedPerPerson`]: {},
          [`trips.${id}.tasksCompleted`]: {},
          [`trips.${id}.tasksSkipped`]: {},
        },
        description: `resetting trip "${id}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          trips: {
            ...prev.trips,
            [id]: {
              ...prev.trips[id],
              packed: {}, packedPerPerson: {},
              skipped: {}, skippedPerPerson: {},
              tasksCompleted: {}, tasksSkipped: {},
            },
          },
        }),
      })
    },

    isPending: mutation.isPending,
  }
}
