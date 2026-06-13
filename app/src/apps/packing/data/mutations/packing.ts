import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'

export function usePackingActions() {
  const mutation = usePackingMutation()

  return {
    togglePacked: (tripId: string, itemId: string, packed: boolean) => {
      mutation.mutate({
        updates: { [`trips.${tripId}.packed.${itemId}`]: packed ? true : deleteField() },
        description: `${packed ? 'packing' : 'unpacking'} item "${itemId}"`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const newPacked = { ...trip.packed }
          if (packed) { newPacked[itemId] = true } else { delete newPacked[itemId] }
          return { ...prev, trips: { ...prev.trips, [tripId]: { ...trip, packed: newPacked } } }
        },
      })
    },

    togglePackedPerPerson: (tripId: string, itemId: string, personId: string, packed: boolean) => {
      mutation.mutate({
        updates: {
          [`trips.${tripId}.packedPerPerson.${itemId}.${personId}`]: packed ? true : deleteField(),
        },
        description: `${packed ? 'packing' : 'unpacking'} item "${itemId}" for person "${personId}"`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const itemMap = { ...(trip.packedPerPerson[itemId] ?? {}) }
          if (packed) { itemMap[personId] = true } else { delete itemMap[personId] }
          return {
            ...prev,
            trips: {
              ...prev.trips,
              [tripId]: {
                ...trip,
                packedPerPerson: { ...trip.packedPerPerson, [itemId]: itemMap },
              },
            },
          }
        },
      })
    },

    toggleSkipped: (tripId: string, itemId: string, skipped: boolean) => {
      mutation.mutate({
        updates: { [`trips.${tripId}.skipped.${itemId}`]: skipped ? true : deleteField() },
        description: `${skipped ? 'skipping' : 'unskipping'} item "${itemId}"`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const newSkipped = { ...trip.skipped }
          if (skipped) { newSkipped[itemId] = true } else { delete newSkipped[itemId] }
          return { ...prev, trips: { ...prev.trips, [tripId]: { ...trip, skipped: newSkipped } } }
        },
      })
    },

    toggleSkippedPerPerson: (tripId: string, itemId: string, personId: string, skipped: boolean) => {
      mutation.mutate({
        updates: {
          [`trips.${tripId}.skippedPerPerson.${itemId}.${personId}`]: skipped ? true : deleteField(),
        },
        description: `${skipped ? 'skipping' : 'unskipping'} item "${itemId}" for person "${personId}"`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const itemMap = { ...(trip.skippedPerPerson[itemId] ?? {}) }
          if (skipped) { itemMap[personId] = true } else { delete itemMap[personId] }
          return {
            ...prev,
            trips: {
              ...prev.trips,
              [tripId]: {
                ...trip,
                skippedPerPerson: { ...trip.skippedPerPerson, [itemId]: itemMap },
              },
            },
          }
        },
      })
    },

    toggleTaskCompleted: (tripId: string, taskId: string, completed: boolean) => {
      mutation.mutate({
        updates: { [`trips.${tripId}.tasksCompleted.${taskId}`]: completed ? true : deleteField() },
        description: `${completed ? 'completing' : 'uncompleting'} task "${taskId}"`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const newCompleted = { ...trip.tasksCompleted }
          if (completed) { newCompleted[taskId] = true } else { delete newCompleted[taskId] }
          return { ...prev, trips: { ...prev.trips, [tripId]: { ...trip, tasksCompleted: newCompleted } } }
        },
      })
    },

    setQuantity: (tripId: string, itemId: string, quantity: number) => {
      const value = quantity <= 1 ? deleteField() : quantity
      mutation.mutate({
        updates: { [`trips.${tripId}.quantities.${itemId}`]: value },
        description: `setting quantity for item "${itemId}" to ${quantity}`,
        optimisticUpdate: (prev) => {
          const trip = prev.trips[tripId]
          const newQuantities = { ...(trip.quantities ?? {}) }
          if (quantity <= 1) { delete newQuantities[itemId] } else { newQuantities[itemId] = quantity }
          return { ...prev, trips: { ...prev.trips, [tripId]: { ...trip, quantities: newQuantities } } }
        },
      })
    },

    isPending: mutation.isPending,
  }
}
