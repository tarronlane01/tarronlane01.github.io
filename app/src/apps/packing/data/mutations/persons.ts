import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { PackingDocument } from '@packing/data/types'

export function usePersonMutations() {
  const mutation = usePackingMutation()

  return {
    addPerson: (name: string): string => {
      const id = generateId('per')
      mutation.mutate({
        updates: { [`persons.${id}`]: { name } },
        description: `adding person "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          persons: { ...prev.persons, [id]: { name } },
        }),
      })
      return id
    },

    updatePerson: (id: string, name: string) => {
      mutation.mutate({
        updates: { [`persons.${id}.name`]: name },
        description: `renaming person to "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          persons: { ...prev.persons, [id]: { name } },
        }),
      })
    },

    deletePerson: (id: string) => {
      mutation.mutate({
        updates: { [`persons.${id}`]: deleteField() },
        description: `deleting person "${id}"`,
        optimisticUpdate: (prev) => stripPersonFromAll(prev, id),
      })
    },

    isPending: mutation.isPending,
  }
}

function stripPersonFromAll(prev: PackingDocument, personId: string): PackingDocument {
  const restPersons = Object.fromEntries(Object.entries(prev.persons).filter(([k]) => k !== personId))

  const items = { ...prev.items }
  for (const [id, item] of Object.entries(items)) {
    if (item.personIds.includes(personId)) {
      items[id] = { ...item, personIds: item.personIds.filter(p => p !== personId) }
    }
  }

  const trips = { ...prev.trips }
  for (const [id, trip] of Object.entries(trips)) {
    const updates: Partial<typeof trip> = {}

    // Clean per-person packed/skipped state
    const packedPerPerson = cleanPerPersonMap(trip.packedPerPerson, personId)
    if (packedPerPerson) updates.packedPerPerson = packedPerPerson

    const skippedPerPerson = cleanPerPersonMap(trip.skippedPerPerson, personId)
    if (skippedPerPerson) updates.skippedPerPerson = skippedPerPerson

    if (Object.keys(updates).length > 0) {
      trips[id] = { ...trip, ...updates }
    }
  }

  return { ...prev, persons: restPersons, items, trips }
}

function cleanPerPersonMap(
  map: Record<string, Record<string, boolean>>,
  personId: string,
): Record<string, Record<string, boolean>> | null {
  let changed = false
  const result = { ...map }

  for (const [itemId, personMap] of Object.entries(result)) {
    if (personId in personMap) {
      const rest = Object.fromEntries(Object.entries(personMap).filter(([k]) => k !== personId))
      result[itemId] = rest
      changed = true
    }
  }

  return changed ? result : null
}
