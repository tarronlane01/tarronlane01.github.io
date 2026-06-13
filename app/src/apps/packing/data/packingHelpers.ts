import type { Item, Task, Trip } from './types'

/** Generate a unique ID with a prefix (e.g. "sec_a1b2c3d4") */
export function generateId(prefix: string): string {
  const random = crypto.randomUUID().slice(0, 8)
  return `${prefix}_${random}`
}

/** Check if a name is unique among existing names (case-insensitive, trimmed) */
export function isNameUnique(
  name: string,
  existingNames: string[],
  excludeName?: string
): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false
  return existingNames.every((existing) => {
    const existingNormalized = existing.trim().toLowerCase()
    if (excludeName && existingNormalized === excludeName.trim().toLowerCase()) {
      return true
    }
    return existingNormalized !== normalized
  })
}

/**
 * Get items that match a trip's features and persons (OR logic).
 * Items with no features and no persons match all trips.
 */
export function getMatchingItems(
  items: Record<string, Item>,
  trip: Trip
): Record<string, Item> {
  const result: Record<string, Item> = {}

  for (const [id, item] of Object.entries(items)) {
    const hasNoTags = item.featureIds.length === 0 && item.personIds.length === 0
    const featureMatch = item.featureIds.some((fId) => trip.featureIds.includes(fId))
    const personMatch = item.personIds.some((pId) => trip.personIds.includes(pId))

    if (hasNoTags || featureMatch || personMatch) {
      result[id] = item
    }
  }

  return result
}

/**
 * Get tasks for a trip. Currently returns all tasks.
 * Future: filter by features when task feature filtering is enabled.
 */
export function getMatchingTasks(
  tasks: Record<string, Task>,
): Record<string, Task> {
  return { ...tasks }
}
