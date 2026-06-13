import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { Item } from '@packing/data/types'

export function useItemMutations() {
  const mutation = usePackingMutation()

  return {
    addItem: (item: Omit<Item, 'name'> & { name: string }) => {
      const id = generateId('itm')
      mutation.mutate({
        updates: { [`items.${id}`]: item },
        description: `adding item "${item.name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          items: { ...prev.items, [id]: item },
        }),
      })
    },

    updateItem: (id: string, item: Item) => {
      mutation.mutate({
        updates: { [`items.${id}`]: item },
        description: `updating item "${item.name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          items: { ...prev.items, [id]: item },
        }),
      })
    },

    deleteItem: (id: string) => {
      mutation.mutate({
        updates: { [`items.${id}`]: deleteField() },
        description: `deleting item "${id}"`,
        optimisticUpdate: (prev) => {
          const items = Object.fromEntries(Object.entries(prev.items).filter(([k]) => k !== id))
          return { ...prev, items }
        },
      })
    },

    isPending: mutation.isPending,
  }
}
