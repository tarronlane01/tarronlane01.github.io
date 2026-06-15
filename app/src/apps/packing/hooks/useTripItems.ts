import { useMemo } from 'react'
import { getMatchingItems } from '@packing/data'
import type { PackingDocument, Item, Trip } from '@packing/data/types'

export interface TripItemEntry {
  id: string
  item: Item
  isPacked: boolean
  isSkipped: boolean
  /** True if this item is permanently skipped (survives reset) */
  isPermanentlySkipped: boolean
  /** For per-person items: packed state per person on this trip */
  perPersonPacked: Record<string, boolean>
  /** For per-person items: skipped state per person on this trip */
  perPersonSkipped: Record<string, boolean>
  /** For per-person items: permanently skipped state per person */
  perPersonPermanentlySkipped: Record<string, boolean>
  /** Persons relevant to this item on this trip */
  relevantPersonIds: string[]
  /** Per-trip quantity, defaults to 1 */
  quantity: number
}

export interface CategoryGroup {
  categoryId: string
  categoryName: string
  items: TripItemEntry[]
  allDone: boolean
}

export interface ItemPhaseGroup {
  phaseId: string
  phaseName: string
  sortOrder: number
  groups: CategoryGroup[]
  allDone: boolean
}

export function useTripItems(packing: PackingDocument, trip: Trip): {
  phases: ItemPhaseGroup[]
  skippedItems: TripItemEntry[]
} {
  return useMemo(() => {
    const matching = getMatchingItems(packing.items, trip)

    const entries: TripItemEntry[] = Object.entries(matching).map(([id, item]) => {
      const relevantPersonIds = [...item.personIds]

      const perPersonPacked: Record<string, boolean> = {}
      const perPersonSkipped: Record<string, boolean> = {}
      const perPersonPermanentlySkipped: Record<string, boolean> = {}
      relevantPersonIds.forEach(pId => {
        perPersonPacked[pId] = trip.packedPerPerson?.[id]?.[pId] ?? false
        perPersonSkipped[pId] =
          (trip.skippedPerPerson?.[id]?.[pId] ?? false) ||
          (trip.permanentlySkippedPerPerson?.[id]?.[pId] ?? false)
        perPersonPermanentlySkipped[pId] = trip.permanentlySkippedPerPerson?.[id]?.[pId] ?? false
      })

      const isPacked = item.personIds.length > 0
        ? relevantPersonIds.length > 0 && relevantPersonIds.every(pId => perPersonPacked[pId])
        : trip.packed[id] ?? false

      const isPermanentlySkipped = item.personIds.length > 0
        ? relevantPersonIds.length > 0 && relevantPersonIds.every(pId => perPersonPermanentlySkipped[pId])
        : trip.permanentlySkipped?.[id] ?? false

      const isSkipped = item.personIds.length > 0
        ? relevantPersonIds.length > 0 && relevantPersonIds.every(pId => perPersonSkipped[pId])
        : (trip.skipped[id] ?? false) || isPermanentlySkipped

      const quantity = trip.quantities?.[id] ?? 1

      return { id, item, isPacked, isSkipped, isPermanentlySkipped, perPersonPacked, perPersonSkipped, perPersonPermanentlySkipped, relevantPersonIds, quantity }
    })

    const skippedItems = entries.filter(e => e.isSkipped)
    const activeEntries = entries.filter(e => !e.isSkipped)

    // Resolve effective phaseId: use item's phase if valid, else default, else unassigned
    const resolvePhaseId = (itemPhaseId?: string): string => {
      if (itemPhaseId && packing.phases[itemPhaseId]) return itemPhaseId
      if (packing.defaultPhaseId && packing.phases[packing.defaultPhaseId]) return packing.defaultPhaseId
      return '_unassigned'
    }

    // Group by phaseId
    const phaseMap = new Map<string, TripItemEntry[]>()
    for (const entry of activeEntries) {
      const pId = resolvePhaseId(entry.item.phaseId)
      if (!phaseMap.has(pId)) phaseMap.set(pId, [])
      phaseMap.get(pId)!.push(entry)
    }

    const phaseGroups: ItemPhaseGroup[] = []
    for (const [phaseId, phaseEntries] of phaseMap) {
      // Sub-group by category (alphabetical)
      const categoryMap = new Map<string, TripItemEntry[]>()
      for (const entry of phaseEntries) {
        const catId = entry.item.categoryId || '_uncategorized'
        if (!categoryMap.has(catId)) categoryMap.set(catId, [])
        categoryMap.get(catId)!.push(entry)
      }

      const groups: CategoryGroup[] = []
      for (const [catId, items] of categoryMap) {
        const cat = packing.categories[catId]
        groups.push({
          categoryId: catId,
          categoryName: cat?.name ?? 'Uncategorized',
          items: items.sort((a, b) => a.item.name.localeCompare(b.item.name)),
          allDone: items.every(e => e.isPacked),
        })
      }
      groups.sort((a, b) => a.categoryName.localeCompare(b.categoryName))

      const phase = packing.phases[phaseId]
      phaseGroups.push({
        phaseId,
        phaseName: phase?.name ?? 'Unassigned',
        sortOrder: phaseId === '_unassigned' ? -Infinity : (phase?.sortOrder ?? 0),
        groups,
        allDone: groups.every(g => g.allDone),
      })
    }

    phaseGroups.sort((a, b) => a.sortOrder - b.sortOrder)

    return { phases: phaseGroups, skippedItems }
  }, [packing, trip])
}
