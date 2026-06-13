import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'
import type { Task } from '@packing/data/types'

export function useTaskMutations() {
  const mutation = usePackingMutation()

  return {
    addTask: (task: Task) => {
      const id = generateId('tsk')
      mutation.mutate({
        updates: { [`tasks.${id}`]: task },
        description: `adding task "${task.name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          tasks: { ...prev.tasks, [id]: task },
        }),
      })
    },

    updateTask: (id: string, task: Task) => {
      mutation.mutate({
        updates: { [`tasks.${id}`]: task },
        description: `updating task "${task.name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          tasks: { ...prev.tasks, [id]: task },
        }),
      })
    },

    deleteTask: (id: string) => {
      mutation.mutate({
        updates: { [`tasks.${id}`]: deleteField() },
        description: `deleting task "${id}"`,
        optimisticUpdate: (prev) => {
          const tasks = Object.fromEntries(Object.entries(prev.tasks).filter(([k]) => k !== id))
          return { ...prev, tasks }
        },
      })
    },

    isPending: mutation.isPending,
  }
}
