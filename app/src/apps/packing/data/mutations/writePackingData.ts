import { updateDocByPath, writeDocByPath } from '@firestore'
import type { FirestoreData } from '@firestore'

/**
 * Write updates to the packing document using dot-notation field paths.
 * Uses updateDocByPath for granular, concurrent-safe writes.
 */
export async function writePackingData(params: {
  updates: FirestoreData
  description: string
}): Promise<void> {
  await updateDocByPath('packing', 'shared', params.updates, params.description)
}

/**
 * Create the initial packing document (for first-time setup).
 * Uses writeDocByPath since the document may not exist yet.
 */
export async function createPackingDocument(data: FirestoreData): Promise<void> {
  await writeDocByPath('packing', 'shared', data, 'creating initial packing document')
}
