/**
 * Firestore Write Operations
 *
 * Operations for writing, updating, and deleting documents.
 */

import { doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'
import { getDb } from '@firestore/instance'
import { logFirebase } from '@firestore/logger'
import type { FirestoreData } from '@firestore/types/index'

export async function writeDocByPath(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string,
  options?: { merge?: boolean }
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  // Log before write so we can see what's being written
  logFirebase('WRITE', path, source, 1, undefined, data)
  return setDoc(docRef, data, options ?? {})
}

/** Document to write in a batch */
export interface BatchWriteDoc {
  collectionPath: string
  docId: string
  data: FirestoreData
}

/**
 * Write multiple documents in batches.
 * Firestore limits batches to 500 operations, so this automatically
 * splits larger writes into multiple batches.
 *
 * IMPORTANT: This is a DESTRUCTIVE operation.
 * Uses batch.set() which completely replaces each document.
 * Any existing fields not in the provided data will be removed.
 */
export async function batchWriteDocs(
  docs: BatchWriteDoc[],
  source: string
): Promise<void> {
  const BATCH_SIZE = 500
  const db = getDb()

  // Split into chunks of BATCH_SIZE
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const { collectionPath, docId, data } of chunk) {
      const docRef = doc(db, collectionPath, docId)
      // batch.set() completely replaces the document (no merge)
      batch.set(docRef, data)
    }

    logFirebase('BATCH_WRITE', `${chunk.length} docs`, source, chunk.length, undefined, chunk)
    try {
      await batch.commit()
    } catch (error) {
      console.error(`[Firebase] BATCH_WRITE ERROR in ${source}:`, error)
      console.error(`[Firebase] Failed batch details:`, {
        batchIndex: Math.floor(i / BATCH_SIZE) + 1,
        totalBatches: Math.ceil(docs.length / BATCH_SIZE),
        docsInBatch: chunk.length,
        firstDoc: chunk[0] ? `${chunk[0].collectionPath}/${chunk[0].docId}` : 'none',
      })
      // Re-throw to allow caller to handle
      throw error
    }
  }
}

export async function updateDocByPath(
  collectionPath: string,
  docId: string,
  data: FirestoreData,
  source: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  // Log before update so we can see what's being updated
  logFirebase('UPDATE', path, source, 1, undefined, data)
  return updateDoc(docRef, data)
}

export async function deleteDocByPath(
  collectionPath: string,
  docId: string,
  source: string
): Promise<void> {
  const docRef = doc(getDb(), collectionPath, docId)
  const path = `${collectionPath}/${docId}`
  logFirebase('DELETE', path, source)
  return deleteDoc(docRef)
}

/** Document to delete in a batch */
export interface BatchDeleteDoc {
  collectionPath: string
  docId: string
}

/**
 * Delete multiple documents in batches.
 * Firestore limits batches to 500 operations, so this automatically
 * splits larger deletes into multiple batches.
 *
 * @param docs - Array of documents to delete
 * @param source - Source identifier for logging
 * @param onBatchComplete - Optional callback called after each batch completes with count deleted so far
 */
export async function batchDeleteDocs(
  docs: BatchDeleteDoc[],
  source: string,
  onBatchComplete?: (deletedSoFar: number) => void
): Promise<void> {
  const BATCH_SIZE = 500
  const db = getDb()

  // Split into chunks of BATCH_SIZE
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)

    for (const { collectionPath, docId } of chunk) {
      const docRef = doc(db, collectionPath, docId)
      batch.delete(docRef)
    }

    logFirebase('BATCH_DELETE', `${chunk.length} docs`, source, chunk.length)
    await batch.commit()

    // Report progress after each batch
    onBatchComplete?.(i + chunk.length)
  }
}

