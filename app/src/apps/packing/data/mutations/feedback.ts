import { readDocByPath, writeDocByPath, arrayUnion } from '@firestore'

// --- Types ---

export interface FeedbackItem {
  id: string
  text: string
  createdAt: string
  isDone: boolean
  submittedBy: string
}

interface FeedbackDocument {
  userIds: string[]
  items: FeedbackItem[]
}

// --- Operations ---

/**
 * Create the feedback document during initial packing setup.
 * Uses the same userIds as the main packing document.
 */
export async function createFeedbackDocument(userIds: string[]): Promise<void> {
  const doc: FeedbackDocument = { userIds, items: [] }
  await writeDocByPath('packing', 'feedback', doc, 'creating packing feedback document')
}

/**
 * Submit a new feedback item. Creates the document if it doesn't exist.
 */
export async function submitFeedback(
  text: string,
  submittedBy: string,
  currentUserIds: string[],
): Promise<void> {
  const item: FeedbackItem = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    isDone: false,
    submittedBy,
  }

  const result = await readDocByPath<FeedbackDocument>('packing', 'feedback', 'check feedback doc exists')

  if (!result.exists) {
    const doc: FeedbackDocument = { userIds: currentUserIds, items: [item] }
    await writeDocByPath('packing', 'feedback', doc, 'creating feedback doc with first item')
  } else {
    await writeDocByPath('packing', 'feedback', {
      items: arrayUnion(item),
    }, 'appending feedback item', { merge: true })
  }
}

/**
 * Read all feedback items. Returns empty array if document doesn't exist.
 */
export async function readFeedbackItems(): Promise<FeedbackItem[]> {
  const result = await readDocByPath<FeedbackDocument>('packing', 'feedback', 'reading feedback items')
  if (!result.exists || !result.data) return []
  return result.data.items ?? []
}

/**
 * Toggle the done status of a feedback item.
 */
export async function toggleFeedbackDone(itemId: string, isDone: boolean): Promise<void> {
  const result = await readDocByPath<FeedbackDocument>('packing', 'feedback', 'reading feedback for toggle')
  if (!result.exists || !result.data) return

  const updatedItems = result.data.items.map(item =>
    item.id === itemId ? { ...item, isDone } : item,
  )
  await writeDocByPath('packing', 'feedback', { items: updatedItems }, 'toggling feedback done', { merge: true })
}

/**
 * Delete a feedback item by ID.
 */
export async function deleteFeedbackItem(itemId: string): Promise<void> {
  const result = await readDocByPath<FeedbackDocument>('packing', 'feedback', 'reading feedback for delete')
  if (!result.exists || !result.data) return

  const updatedItems = result.data.items.filter(item => item.id !== itemId)
  await writeDocByPath('packing', 'feedback', { items: updatedItems }, 'deleting feedback item', { merge: true })
}
