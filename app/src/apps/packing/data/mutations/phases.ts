import { deleteField } from '@firestore'
import { usePackingMutation } from './usePackingMutation'
import { generateId } from '@packing/data/packingHelpers'

export function usePhaseMutations() {
  const mutation = usePackingMutation()

  return {
    addPhase: (name: string): string => {
      const id = generateId('pha')
      const phase = { name, sortOrder: Date.now() }
      mutation.mutate({
        updates: { [`phases.${id}`]: phase },
        description: `adding phase "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          phases: { ...prev.phases, [id]: phase },
        }),
      })
      return id
    },

    updatePhase: (id: string, name: string) => {
      mutation.mutate({
        updates: { [`phases.${id}.name`]: name },
        description: `updating phase "${name}"`,
        optimisticUpdate: (prev) => ({
          ...prev,
          phases: {
            ...prev.phases,
            [id]: { ...prev.phases[id], name },
          },
        }),
      })
    },

    deletePhase: (id: string, reassignToId?: string) => {
      mutation.mutate({
        updates: { [`phases.${id}`]: deleteField() },
        description: `deleting phase "${id}"`,
        optimisticUpdate: (prev) => {
          const restPhases = Object.fromEntries(Object.entries(prev.phases).filter(([k]) => k !== id))
          const tasks = { ...prev.tasks }
          for (const [taskId, task] of Object.entries(tasks)) {
            if (task.phaseId === id) {
              tasks[taskId] = { ...task, phaseId: reassignToId ?? '' }
            }
          }
          const items = { ...prev.items }
          for (const [itemId, item] of Object.entries(items)) {
            if (item.phaseId === id) {
              items[itemId] = { ...item, phaseId: reassignToId ?? undefined }
            }
          }
          const defaultPhaseId = prev.defaultPhaseId === id ? undefined : prev.defaultPhaseId
          return { ...prev, phases: restPhases, tasks, items, defaultPhaseId }
        },
      })
    },

    setDefaultPhase: (id: string | undefined) => {
      mutation.mutate({
        updates: { defaultPhaseId: id ?? deleteField() },
        description: id ? `setting default phase to "${id}"` : 'clearing default phase',
        optimisticUpdate: (prev) => ({ ...prev, defaultPhaseId: id }),
      })
    },

    reorderPhase: (id: string, direction: 'up' | 'down', sorted: { id: string; sortOrder: number }[]) => {
      const idx = sorted.findIndex(s => s.id === id)
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= sorted.length) return

      mutation.mutate({
        updates: {
          [`phases.${id}.sortOrder`]: sorted[swapIdx].sortOrder,
          [`phases.${sorted[swapIdx].id}.sortOrder`]: sorted[idx].sortOrder,
        },
        description: `reordering phase "${id}" ${direction}`,
        optimisticUpdate: (prev) => ({
          ...prev,
          phases: {
            ...prev.phases,
            [id]: { ...prev.phases[id], sortOrder: sorted[swapIdx].sortOrder },
            [sorted[swapIdx].id]: { ...prev.phases[sorted[swapIdx].id], sortOrder: sorted[idx].sortOrder },
          },
        }),
      })
    },

    isPending: mutation.isPending,
  }
}
