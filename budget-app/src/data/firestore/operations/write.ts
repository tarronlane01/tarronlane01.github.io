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
  // Putting this here so that all writes to firebase will always have a console log
  // So I can see how often writes are happening
  logFirebase('WRITE', path, source)
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
      batch.set(docRef, data)
    }

    logFirebase('BATCH_WRITE', `${chunk.length} docs`, source, chunk.length)
    await batch.commit()
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
  // Putting this here so I can easily track firebase reads in the console
  logFirebase('UPDATE', path, source)
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

