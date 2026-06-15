import { useMemo } from 'react'
import { getMatchingTasks } from '@packing/data'
import type { PackingDocument, Task, Trip } from '@packing/data/types'

export interface TripTaskEntry {
  id: string
  task: Task
  isCompleted: boolean
  isSkipped: boolean
  isPermanentlySkipped: boolean
}

export interface PhaseGroup {
  phaseId: string
  phaseName: string
  sortOrder: number
  tasks: TripTaskEntry[]
  allDone: boolean
}

export function useTripTasks(packing: PackingDocument, trip: Trip): {
  phases: PhaseGroup[]
  skippedTasks: TripTaskEntry[]
} {
  return useMemo(() => {
    const matching = getMatchingTasks(packing.tasks)

    const entries: TripTaskEntry[] = Object.entries(matching).map(([id, task]) => {
      const isPermanentlySkipped = trip.tasksPermanentlySkipped?.[id] ?? false
      const isSkipped = (trip.tasksSkipped?.[id] ?? false) || isPermanentlySkipped
      return { id, task, isCompleted: trip.tasksCompleted[id] ?? false, isSkipped, isPermanentlySkipped }
    })

    const skippedTasks = entries.filter(e => e.isSkipped)
    const activeEntries = entries.filter(e => !e.isSkipped)

    // Resolve effective phaseId: use task's phase if valid, else default, else unassigned
    const resolvePhaseId = (taskPhaseId?: string): string => {
      if (taskPhaseId && packing.phases[taskPhaseId]) return taskPhaseId
      if (packing.defaultPhaseId && packing.phases[packing.defaultPhaseId]) return packing.defaultPhaseId
      return '_unassigned'
    }

    // Group by phase
    const phaseMap = new Map<string, TripTaskEntry[]>()
    for (const entry of activeEntries) {
      const phaseId = resolvePhaseId(entry.task.phaseId)
      if (!phaseMap.has(phaseId)) phaseMap.set(phaseId, [])
      phaseMap.get(phaseId)!.push(entry)
    }

    const phaseGroups: PhaseGroup[] = []
    for (const [phaseId, tasks] of phaseMap) {
      const phase = packing.phases[phaseId]
      phaseGroups.push({
        phaseId,
        phaseName: phase?.name ?? 'Unassigned',
        sortOrder: phaseId === '_unassigned' ? -Infinity : (phase?.sortOrder ?? 0),
        tasks: tasks.sort((a, b) => a.task.name.localeCompare(b.task.name)),
        allDone: tasks.every(t => t.isCompleted),
      })
    }

    phaseGroups.sort((a, b) => a.sortOrder - b.sortOrder)

    return { phases: phaseGroups, skippedTasks }
  }, [packing, trip])
}
