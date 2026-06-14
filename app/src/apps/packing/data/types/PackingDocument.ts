/** Root document stored at packing/shared */
export interface PackingDocument {
  userIds: string[]
  categories: Record<string, PackingCategory>
  phases: Record<string, Phase>
  features: Record<string, Feature>
  persons: Record<string, Person>
  items: Record<string, Item>
  tasks: Record<string, Task>
  trips: Record<string, Trip>
  /** Phase pre-selected when adding new items */
  defaultPhaseId?: string
}

/** A mutually exclusive classification for Items (e.g. "Clothes", "Toiletries") */
export interface PackingCategory {
  name: string
}

/** A timing classification for Items and Tasks (e.g. "Days Before", "Right Before") */
export interface Phase {
  name: string
  sortOrder: number
}

/** A trip characteristic tag (e.g. "camping", "water") */
export interface Feature {
  name: string
}

/** A family member who can be associated with Items */
export interface Person {
  name: string
}

/** A physical thing you bring on a trip */
export interface Item {
  name: string
  categoryId: string
  featureIds: string[]
  personIds: string[]
  phaseId?: string
}

/** An action to perform before or during a trip */
export interface Task {
  name: string
  phaseId?: string
  featureIds: string[]
}

/** A reusable saved filter configuration for packing */
export interface Trip {
  name: string
  featureIds: string[]
  personIds: string[]
  /** Per-trip item quantity: { itemId: count }. Missing entries default to 1. */
  quantities: Record<string, number>
  /** Regular item packed state: { itemId: true } */
  packed: Record<string, boolean>
  /** Per-person item packed state: { itemId: { personId: true } } */
  packedPerPerson: Record<string, Record<string, boolean>>
  /** Regular item skipped state: { itemId: true } */
  skipped: Record<string, boolean>
  /** Per-person item skipped state: { itemId: { personId: true } } */
  skippedPerPerson: Record<string, Record<string, boolean>>
  /** Task completed state: { taskId: true } */
  tasksCompleted: Record<string, boolean>
}

/** Empty document for first-time initialization */
export function createEmptyPackingDocument(userIds: string[]): PackingDocument {
  return {
    userIds,
    categories: {},
    phases: {},
    features: {},
    persons: {},
    items: {},
    tasks: {},
    trips: {},
  }
}
