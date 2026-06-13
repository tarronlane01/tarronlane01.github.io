import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'

export function useCategoryMutations() {
  const mutation = usePackingMutation()

  return {
    addCategory: (name: string): string => {
      const id = generateId('cat')
      const category = { name }
      mutation.mutate({
        updates: { [`categories.${id}`]: category },
        description: `adding category "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          categories: { ...prev.categories, [id]: category },
        }),
      })
      return id
    },

    updateCategory: (id: string, name: string) => {
      mutation.mutate({
        updates: { [`categories.${id}.name`]: name },
        description: `updating category "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          categories: {
            ...prev.categories,
            [id]: { ...prev.categories[id], name },
          },
        }),
      })
    },

    deleteCategory: (id: string, reassignToId?: string) => {
      mutation.mutate({
        updates: { [`categories.${id}`]: deleteField() },
        description: `deleting category "${id}"`,
        optimisticUpdate: (prev) => {
          const restCats = Object.fromEntries(Object.entries(prev.categories).filter(([k]) => k !== id))
          const items = { ...prev.items }
          for (const [itemId, item] of Object.entries(items)) {
            if (item.categoryId === id) {
              items[itemId] = { ...item, categoryId: reassignToId ?? '' }
            }
          }
          return { ...prev, categories: restCats, items }
        },
      })
    },

    isPending: mutation.isPending,
  }
}
